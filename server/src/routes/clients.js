import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Client, User, Trade, Message, Notification } from "../models/index.js";
import { asyncHandler, HttpError, parse, escapeRegex, assertId } from "../utils/http.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { clientStats } from "../utils/analytics.js";

const router = Router();
router.use(requireAuth);

const fields = {
  name: z.string().trim().min(2, "Enter the client name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z.string().trim().max(40),
  country: z.string().trim().max(60),
  status: z.enum(["active", "inactive"]),
  initialBalance: z.coerce.number().min(0, "Balance cannot be negative."),
  notes: z.string().max(2000),
};
const pw = z.string().min(8, "Use at least 8 characters.").max(128);
// Create applies defaults. Update must NOT, or a partial PATCH would reset omitted fields.
const createSchema = z.object({
  ...fields,
  phone: fields.phone.default(""), country: fields.country.default(""), status: fields.status.default("active"),
  initialBalance: fields.initialBalance.default(0), notes: fields.notes.default(""), password: pw,
});
const updateSchema = z.object(fields).partial().extend({ password: pw.optional() });

const withStats = async (clients) => {
  const trades = await Trade.find({ clientId: { $in: clients.map((c) => c._id) } }).lean();
  const stats = clientStats(clients, trades);
  return clients.map((c) => ({ ...c.toJSON(), stats: stats.get(String(c._id)) }));
};

router.get("/", requireRole("admin"), asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const filter = {};
  if (req.query.status === "active" || req.query.status === "inactive") filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), "i");
    filter.$or = [{ name: rx }, { email: rx }, { country: rx }];
  }
  const total = await Client.countDocuments(filter);
  const items = await Client.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  res.json({ items: await withStats(items), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));

// Lightweight list for pickers and filters.
router.get("/options", requireRole("admin"), asyncHandler(async (_req, res) => {
  const items = await Client.find().sort({ name: 1 }).select("name email status");
  res.json({ items });
}));

router.post("/", requireRole("admin"), asyncHandler(async (req, res) => {
  const d = parse(createSchema, req.body);
  const { password, ...profile } = d;
  if (await User.findOne({ email: d.email })) throw new HttpError(409, "A user with this email already exists.", { email: "Email already in use." });
  const client = await Client.create(profile);
  try {
    const user = await User.create({ name: d.name, email: d.email, password: await bcrypt.hash(password, 12), role: "client", clientId: client._id });
    client.userId = user._id; await client.save();
  } catch (e) { await Client.deleteOne({ _id: client._id }); throw e; }
  res.status(201).json({ client: (await withStats([client]))[0] });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  assertId(req.params.id);
  if (req.user.role === "client" && String(req.user.clientId) !== req.params.id) throw new HttpError(403, "You can only view your own profile.");
  const c = await Client.findById(req.params.id);
  if (!c) throw new HttpError(404, "Client not found.");
  res.json({ client: (await withStats([c]))[0] });
}));

router.patch("/:id", requireRole("admin"), asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const c = await Client.findById(req.params.id);
  if (!c) throw new HttpError(404, "Client not found.");
  const { password, ...d } = parse(updateSchema, req.body);
  if (d.email && d.email !== c.email && (await User.findOne({ email: d.email, _id: { $ne: c.userId } }))) {
    throw new HttpError(409, "A user with this email already exists.", { email: "Email already in use." });
  }
  Object.assign(c, d); await c.save();
  const u = await User.findById(c.userId);
  if (u) {
    if (d.name) u.name = d.name;
    if (d.email) u.email = d.email;
    if (password) u.password = await bcrypt.hash(password, 12);
    await u.save();
  }
  res.json({ client: (await withStats([c]))[0] });
}));

router.delete("/:id", requireRole("admin"), asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const c = await Client.findById(req.params.id);
  if (!c) throw new HttpError(404, "Client not found.");
  await Promise.all([
    Trade.deleteMany({ clientId: c._id }),
    Message.deleteMany({ clientId: c._id }),
    c.userId ? Notification.deleteMany({ userId: c.userId }) : null,
    c.userId ? User.deleteOne({ _id: c.userId }) : null,
  ]);
  await c.deleteOne();
  res.json({ ok: true });
}));

export default router;
