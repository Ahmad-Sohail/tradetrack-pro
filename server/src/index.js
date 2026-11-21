import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { config } from "./config.js";
import { User } from "./models/index.js";
import { verifyToken } from "./middleware/auth.js";
import { setIo } from "./utils/io.js";
import { HttpError } from "./utils/http.js";
import auth from "./routes/auth.js";
import clients from "./routes/clients.js";
import trades from "./routes/trades.js";
import analytics from "./routes/analytics.js";
import messages from "./routes/messages.js";
import notifications from "./routes/notifications.js";
import reports from "./routes/reports.js";
import connections from "./routes/connections.js";
import imports from "./routes/imports.js";
import { encryptionEnabled } from "./utils/crypto.js";
import { runAllSyncs } from "./services/sync.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
const corsOrigin = (origin, cb) => (!origin || config.clientUrls.includes(origin) ? cb(null, true) : cb(new HttpError(403, "Origin not allowed.")));
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: "Too many attempts. Try again later." } });
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth", auth);
app.use("/api/clients", clients);
app.use("/api/trades", trades);
app.use("/api/analytics", analytics);
app.use("/api/messages", messages);
app.use("/api/notifications", notifications);
app.use("/api/reports", reports);
app.use("/api/connections", connections);
app.use("/api/imports", imports);

app.use((_req, _res, next) => next(new HttpError(404, "Route not found.")));
app.use((err, _req, res, _next) => {
  if (err.name === "MulterError") err = new HttpError(400, err.code === "LIMIT_FILE_SIZE" ? "File is larger than 8 MB." : err.message);
  if (err.code === 11000) err = new HttpError(409, "That value already exists.");
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? "Something went wrong on the server." : err.message, fields: err.details });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.clientUrls } });
setIo(io);
io.use(async (socket, next) => {
  try {
    const p = verifyToken(socket.handshake.auth?.token || "");
    const user = await User.findById(p.sub);
    if (!user) return next(new Error("unauthorized"));
    socket.data.user = { id: String(user._id), role: user.role, clientId: user.clientId ? String(user.clientId) : null };
    next();
  } catch { next(new Error("unauthorized")); }
});
io.on("connection", (socket) => {
  const u = socket.data.user;
  socket.join(`user:${u.id}`);
  socket.join(u.role === "admin" ? "admins" : `client:${u.clientId}`);
  socket.on("typing", ({ clientId } = {}) => {
    const cid = u.role === "client" ? u.clientId : clientId;
    if (!cid) return;
    const room = u.role === "admin" ? `client:${cid}` : "admins";
    socket.to(room).emit("typing", { clientId: cid, role: u.role });
  });
});

await mongoose.connect(config.mongoUri);
await Promise.all([User.init()]);
server.listen(config.port, () => console.log(`API listening on :${config.port}`));
if (encryptionEnabled() && config.syncIntervalMin > 0) {
  setInterval(() => runAllSyncs().catch((e) => console.warn("Sync run failed:", e.message)), config.syncIntervalMin * 60_000);
  console.log(`Exchange sync every ${config.syncIntervalMin} min`);
}
