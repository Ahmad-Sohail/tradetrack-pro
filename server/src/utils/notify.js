import { Notification, User } from "../models/index.js";
import { emitTo } from "./io.js";

export async function notifyUsers(userIds, { type, title, body = "", link = "" }) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return;
  const docs = await Notification.insertMany(ids.map((userId) => ({ userId, type, title, body, link })));
  for (const d of docs) emitTo(`user:${d.userId}`, "notification", d.toJSON());
}
export async function notifyAdmins(payload) {
  const admins = await User.find({ role: "admin" }).select("_id");
  return notifyUsers(admins.map((a) => a._id), payload);
}
