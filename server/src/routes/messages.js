import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import { Client, Message, User } from "../models/index.js";
import { asyncHandler, HttpError, parse, assertId } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { config, cloudinaryEnabled } from "../config.js";
import { emitTo } from "../utils/io.js";
import { notifyAdmins, notifyUsers } from "../utils/notify.js";

const router = Router();
router.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const ALLOWED = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/(plain|csv))$/;

const access = (req, clientId) => {
  assertId(clientId);
  if (req.user.role === "client" && String(req.user.clientId) !== clientId) throw new HttpError(403, "You can only access your own conversation.");
};
const other = (role) => (role === "admin" ? "client" : "admin");

router.get("/config", (_req, res) => res.json({ uploadsEnabled: cloudinaryEnabled(), maxFileMb: 8 }));

router.get("/conversations", asyncHandler(async (req, res) => {
  const clients = req.user.role === "client" ? await Client.find({ _id: req.user.clientId }) : await Client.find().sort({ name: 1 });
  const items = await Promise.all(clients.map(async (c) => {
    const [last] = await Message.find({ clientId: c._id }).sort({ createdAt: -1 }).limit(1);
    const unread = await Message.countDocuments({ clientId: c._id, senderRole: other(req.user.role), readAt: null });
    return { clientId: String(c._id), name: c.name, status: c.status, lastMessage: last ? last.toJSON() : null, unread };
  }));
  items.sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
  res.json({ items });
}));

router.post("/upload", upload.single("file"), asyncHandler(async (req, res) => {
  if (!cloudinaryEnabled()) throw new HttpError(503, "File uploads are not configured on this server.");
  if (!req.file) throw new HttpError(400, "Choose a file to upload.");
  if (!ALLOWED.test(req.file.mimetype)) throw new HttpError(400, "Only images, PDF, TXT and CSV files are allowed.");
  cloudinary.config({ ...config.cloudinary, secure: true });
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ folder: "tradetrack/chat", resource_type: "auto" }, (e, r) => (e ? reject(e) : resolve(r))).end(req.file.buffer);
  });
  res.status(201).json({ attachment: { url: result.secure_url, name: req.file.originalname.slice(0, 120), type: req.file.mimetype, size: req.file.size } });
}));

router.get("/:clientId", asyncHandler(async (req, res) => {
  access(req, req.params.clientId);
  const items = await Message.find({ clientId: req.params.clientId }).sort({ createdAt: 1 }).limit(500);
  const now = new Date();
  const r = await Message.updateMany({ clientId: req.params.clientId, senderRole: other(req.user.role), readAt: null }, { $set: { readAt: now } });
  if (r.modifiedCount) {
    const payload = { clientId: req.params.clientId, by: req.user.role, readAt: now };
    emitTo(`client:${req.params.clientId}`, "messages:read", payload);
    emitTo("admins", "messages:read", payload);
  }
  res.json({ items: items.map((m) => m.toJSON()) });
}));

const sendSchema = z.object({
  body: z.string().trim().max(4000).optional().default(""),
  attachment: z.object({ url: z.string().url().refine((u) => u.startsWith("https://res.cloudinary.com/"), "Invalid attachment."), name: z.string().max(120), type: z.string().max(80), size: z.coerce.number().max(8 * 1024 * 1024) }).optional(),
}).refine((d) => d.body || d.attachment, { message: "Write a message or attach a file.", path: ["body"] });

router.post("/:clientId", asyncHandler(async (req, res) => {
  access(req, req.params.clientId);
  const d = parse(sendSchema, req.body);
  if (d.attachment) {
    if (!cloudinaryEnabled()) throw new HttpError(400, "Attachments are not enabled on this server.", { body: "Attachments are not enabled." });
    if (!d.attachment.url.startsWith(`https://res.cloudinary.com/${config.cloudinary.cloud_name}/`)) throw new HttpError(400, "Invalid attachment.", { body: "Invalid attachment." });
  }
  const client = await Client.findById(req.params.clientId);
  if (!client) throw new HttpError(404, "Client not found.");
  const msg = await Message.create({ clientId: client._id, senderId: req.user._id, senderRole: req.user.role, body: d.body, attachment: d.attachment });
  const json = msg.toJSON();
  emitTo(`client:${client._id}`, "message:new", json);
  emitTo("admins", "message:new", json);
  const preview = d.body ? d.body.slice(0, 80) : "Sent an attachment";
  if (req.user.role === "admin") {
    if (client.userId) notifyUsers([client.userId], { type: "message", title: "New message", body: preview, link: "/chat" }).catch(() => {});
  } else {
    notifyAdmins({ type: "message", title: `New message from ${client.name}`, body: preview, link: `/chat?client=${client._id}` }).catch(() => {});
  }
  res.status(201).json({ message: json });
}));

export default router;
