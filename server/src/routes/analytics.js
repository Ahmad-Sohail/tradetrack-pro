import { Router } from "express";
import { Client, Trade, User } from "../models/index.js";
import { asyncHandler, assertId } from "../utils/http.js";
import { requireAuth, scopeClientId } from "../middleware/auth.js";
import { buildAnalytics } from "../utils/analytics.js";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const cid = scopeClientId(req, req.query.clientId);
  const filter = {}; let clients;
  if (cid) { assertId(cid); filter.clientId = cid; clients = await Client.find({ _id: cid }); }
  else clients = await Client.find();
  if (req.query.from || req.query.to) {
    filter.openedAt = {};
    if (req.query.from) filter.openedAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.openedAt.$lte = new Date(new Date(req.query.to).getTime() + 86399999);
  }
  const trades = await Trade.find(filter).lean();
  const opening = clients.reduce((s, c) => s + (c.initialBalance || 0), 0);
  const out = buildAnalytics(trades, clients, opening);
  if (req.user.role === "admin" && !cid) {
    out.summary.totalClients = clients.length;
    out.summary.activeClients = clients.filter((c) => c.status === "active").length;
  } else out.byClient = cid && req.user.role === "admin" ? out.byClient : [];
  res.json(out);
}));

export default router;
