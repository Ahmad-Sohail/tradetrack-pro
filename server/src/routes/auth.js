import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { config } from "../config.js";
import { User, Client } from "../models/index.js";
import { asyncHandler, HttpError, parse } from "../utils/http.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { notifyAdmins } from "../utils/notify.js";

const router = Router();
const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z.string().min(8, "Use at least 8 characters.").max(128);

const publicUser = async (u) => {
  const o = u.toJSON();
  if (u.clientId) { const c = await Client.findById(u.clientId); o.client = c ? c.toJSON() : null; }
  return o;
};

router.post("/register", asyncHandler(async (req, res) => {
  const d = parse(z.object({ name: z.string().trim().min(2, "Enter your name.").max(80), email, password }), req.body);
  if (await User.findOne({ email: d.email })) throw new HttpError(409, "An account with this email already exists.", { email: "Email already in use." });
  const hash = await bcrypt.hash(d.password, 12);
  const adminExists = await User.exists({ role: "admin" });
  const mayBeAdmin = !adminExists && (!config.adminEmail || config.adminEmail === d.email);
  let user;
  if (mayBeAdmin) {
    user = await User.create({ name: d.name, email: d.email, password: hash, role: "admin" });
  } else {
    const client = await Client.create({ name: d.name, email: d.email });
    user = await User.create({ name: d.name, email: d.email, password: hash, role: "client", clientId: client._id });
    client.userId = user._id; await client.save();
    notifyAdmins({ type: "client_new", title: "New client registered", body: `${d.name} created an account.`, link: `/clients/${client._id}` }).catch(() => {});
  }
  res.status(201).json({ token: signToken(user), user: await publicUser(user) });
}));

router.post("/login", asyncHandler(async (req, res) => {
  const d = parse(z.object({ email, password: z.string().min(1, "Enter your password.") }), req.body);
  const user = await User.findOne({ email: d.email }).select("+password");
  const ok = user && (await bcrypt.compare(d.password, user.password));
  if (!ok) throw new HttpError(401, "Invalid email or password.");
  if (user.role === "client") {
    const c = await Client.findById(user.clientId);
    if (c && c.status === "inactive") throw new HttpError(403, "This account is inactive. Contact your manager.");
  }
  res.json({ token: signToken(user), user: await publicUser(user) });
}));

router.get("/me", requireAuth, asyncHandler(async (req, res) => res.json({ user: await publicUser(req.user) })));

router.patch("/profile", requireAuth, asyncHandler(async (req, res) => {
  const d = parse(z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().max(40).optional(),
    country: z.string().trim().max(60).optional(),
  }), req.body);
  if (d.name) { req.user.name = d.name; await req.user.save(); }
  if (req.user.clientId) await Client.findByIdAndUpdate(req.user.clientId, { $set: d });
  res.json({ user: await publicUser(await User.findById(req.user._id)) });
}));

router.patch("/password", requireAuth, asyncHandler(async (req, res) => {
  const d = parse(z.object({ currentPassword: z.string().min(1, "Enter your current password."), newPassword: password }), req.body);
  const u = await User.findById(req.user._id).select("+password");
  if (!(await bcrypt.compare(d.currentPassword, u.password))) throw new HttpError(400, "Current password is incorrect.", { currentPassword: "Incorrect password." });
  u.password = await bcrypt.hash(d.newPassword, 12); await u.save();
  res.json({ ok: true });
}));

export default router;
