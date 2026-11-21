import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User } from "../models/index.js";
import { HttpError, asyncHandler } from "../utils/http.js";

export const signToken = (u) =>
  jwt.sign({ sub: String(u._id), role: u.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

export const verifyToken = (token) => jwt.verify(token, config.jwtSecret);

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) throw new HttpError(401, "Authentication required.");
  let payload;
  try { payload = verifyToken(token); } catch { throw new HttpError(401, "Session expired. Please sign in again."); }
  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, "Account no longer exists.");
  req.user = user;
  next();
});

export const requireRole = (role) => (req, _res, next) =>
  req.user?.role === role ? next() : next(new HttpError(403, "You do not have permission to do that."));

// Returns the clientId a request may read. Clients are always pinned to their own id.
export const scopeClientId = (req, requested) => {
  if (req.user.role === "client") return String(req.user.clientId);
  return requested || null;
};
