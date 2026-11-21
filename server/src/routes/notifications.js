import { Router } from "express";
import { Notification } from "../models/index.js";
import { asyncHandler, HttpError, assertId } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id };
  if (req.query.unread === "true") filter.read = false;
  if (req.query.type) filter.type = req.query.type;
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const [items, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
    Notification.countDocuments({ userId: req.user._id, read: false }),
  ]);
  res.json({ items: items.map((n) => n.toJSON()), unread });
}));

router.post("/read-all", asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
  res.json({ ok: true });
}));

router.patch("/:id/read", asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { $set: { read: true } }, { returnDocument: "after" });
  if (!n) throw new HttpError(404, "Notification not found.");
  res.json({ notification: n.toJSON() });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  assertId(req.params.id);
  await Notification.deleteOne({ _id: req.params.id, userId: req.user._id });
  res.json({ ok: true });
}));

export default router;
