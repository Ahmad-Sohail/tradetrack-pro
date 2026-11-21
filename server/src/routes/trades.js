import { Router } from "express";
import { z } from "zod";
import { Client, Trade, nextTradeId } from "../models/index.js";
import { asyncHandler, HttpError, parse, escapeRegex, assertId } from "../utils/http.js";
import { requireAuth, requireRole, scopeClientId } from "../middleware/auth.js";
import { notifyUsers } from "../utils/notify.js";

const router = Router();
router.use(requireAuth);

const optNum = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().nullable());
const optDate = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.date().nullable());

export const tradeSchema = z.object({
  clientId: z.string().regex(/^[a-f\d]{24}$/i, "Choose a client."),
  symbol: z.string().trim().min(1, "Enter a symbol.").max(20),
  marketType: z.enum(["forex", "crypto", "stocks", "commodities", "indices"], { message: "Choose a market." }),
  direction: z.enum(["buy", "sell"], { message: "Choose buy or sell." }),
  entryPrice: z.coerce.number({ message: "Enter the entry price." }).positive("Must be greater than 0."),
  exitPrice: optNum,
  investmentAmount: z.coerce.number().min(0, "Cannot be negative.").default(0),
  positionSize: z.coerce.number({ message: "Enter the position size." }).positive("Must be greater than 0."),
  stopLoss: optNum,
  takeProfit: optNum,
  profitLoss: optNum,
  fees: z.coerce.number().min(0, "Cannot be negative.").default(0),
  openedAt: z.coerce.date({ message: "Enter the opening date and time." }),
  closedAt: optDate,
  status: z.enum(["open", "closed", "cancelled"]).default("open"),
  strategy: z.string().trim().max(120).default(""),
  notes: z.string().max(4000).default(""),
}).superRefine((t, ctx) => {
  if (t.status === "closed") {
    if (t.exitPrice == null) ctx.addIssue({ code: "custom", path: ["exitPrice"], message: "Closed trades need an exit price." });
    if (!t.closedAt) ctx.addIssue({ code: "custom", path: ["closedAt"], message: "Closed trades need a closing time." });
  }
  if (t.closedAt && t.closedAt < t.openedAt) ctx.addIssue({ code: "custom", path: ["closedAt"], message: "Closing time must be after opening time." });
});

// profitLoss is stored net of fees. Computed from prices when not supplied on a closed trade.
export const finalize = (t) => {
  if (t.status !== "closed") { if (t.status === "open") { t.profitLoss = 0; t.closedAt = null; t.exitPrice = null; } return t; }
  if (t.profitLoss == null) {
    const gross = (t.exitPrice - t.entryPrice) * t.positionSize * (t.direction === "buy" ? 1 : -1);
    t.profitLoss = Math.round((gross - t.fees) * 100) / 100;
  }
  return t;
};

const shape = (doc) => {
  const o = doc.toJSON();
  if (doc.clientId && doc.clientId._id) { o.client = { id: String(doc.clientId._id), name: doc.clientId.name }; o.clientId = o.client.id; }
  return o;
};

export const buildFilter = (req) => {
  const q = req.query;
  const f = {};
  const cid = scopeClientId(req, q.clientId);
  if (cid) { assertId(cid); f.clientId = cid; }
  for (const k of ["status", "marketType", "direction"]) if (q[k]) f[k] = q[k];
  if (q.symbol) f.symbol = String(q.symbol).toUpperCase();
  if (q.from || q.to) {
    f.openedAt = {};
    if (q.from) f.openedAt.$gte = new Date(q.from);
    if (q.to) f.openedAt.$lte = new Date(new Date(q.to).getTime() + 86399999);
  }
  if (q.q) { const rx = new RegExp(escapeRegex(q.q), "i"); f.$or = [{ symbol: rx }, { tradeId: rx }, { strategy: rx }]; }
  return f;
};

router.get("/", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 10));
  const sortable = ["openedAt", "closedAt", "profitLoss", "symbol", "createdAt"];
  const sortKey = sortable.includes(req.query.sort) ? req.query.sort : "openedAt";
  const dir = req.query.order === "asc" ? 1 : -1;
  const filter = buildFilter(req);
  const total = await Trade.countDocuments(filter);
  const items = await Trade.find(filter).populate("clientId", "name").sort({ [sortKey]: dir }).skip((page - 1) * limit).limit(limit);
  res.json({ items: items.map(shape), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const t = await Trade.findById(req.params.id).populate("clientId", "name");
  if (!t) throw new HttpError(404, "Trade not found.");
  if (req.user.role === "client" && String(t.clientId._id) !== String(req.user.clientId)) throw new HttpError(404, "Trade not found.");
  res.json({ trade: shape(t) });
}));

const tradeLink = (t) => `/trades/${t._id}`;

router.post("/", requireRole("admin"), asyncHandler(async (req, res) => {
  const d = finalize(parse(tradeSchema, req.body));
  const client = await Client.findById(d.clientId);
  if (!client) throw new HttpError(400, "Client not found.", { clientId: "Client not found." });
  const t = await Trade.create({ ...d, tradeId: await nextTradeId() });
  if (client.userId) notifyUsers([client.userId], { type: t.status === "closed" ? "trade_closed" : "trade_new", title: t.status === "closed" ? "Trade closed" : "New trade recorded", body: `${t.symbol} ${t.direction.toUpperCase()} (${t.tradeId})`, link: tradeLink(t) }).catch(() => {});
  res.status(201).json({ trade: shape(await t.populate("clientId", "name")) });
}));

router.patch("/:id", requireRole("admin"), asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const t = await Trade.findById(req.params.id);
  if (!t) throw new HttpError(404, "Trade not found.");
  const wasClosed = t.status === "closed";
  // Trades pulled from a broker are the source of truth: only strategy and notes are editable.
  const body = t.source === "sync" ? { strategy: req.body.strategy ?? t.strategy, notes: req.body.notes ?? t.notes } : req.body;
  const merged = { ...t.toObject(), clientId: String(t.clientId), ...body };
  delete merged._id; delete merged.id; delete merged.tradeId; delete merged.createdAt; delete merged.updatedAt; delete merged.__v;
  // Re-derive P/L when prices change and the caller did not send an explicit value.
  if (t.source !== "sync" && !("profitLoss" in req.body) && t.status === "closed") merged.profitLoss = null;
  const d = finalize(parse(tradeSchema, merged));
  const client = await Client.findById(d.clientId);
  if (!client) throw new HttpError(400, "Client not found.", { clientId: "Client not found." });
  Object.assign(t, d); await t.save();
  const closedNow = !wasClosed && t.status === "closed";
  if (client.userId) notifyUsers([client.userId], { type: closedNow ? "trade_closed" : "trade_update", title: closedNow ? "Trade closed" : "Trade updated", body: `${t.symbol} ${t.direction.toUpperCase()} (${t.tradeId})`, link: tradeLink(t) }).catch(() => {});
  res.json({ trade: shape(await t.populate("clientId", "name")) });
}));

router.delete("/:id", requireRole("admin"), asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const t = await Trade.findByIdAndDelete(req.params.id);
  if (!t) throw new HttpError(404, "Trade not found.");
  res.json({ ok: true });
}));

export default router;
