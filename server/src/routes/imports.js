import { Router } from "express";
import { z } from "zod";
import { Client, Trade, nextTradeId } from "../models/index.js";
import { asyncHandler, HttpError, parse } from "../utils/http.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { notifyUsers } from "../utils/notify.js";
import { tradeSchema, finalize } from "./trades.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

const num = (v) => { if (v === undefined || v === null || v === "") return ""; const s = String(v).replace(/[^0-9.\-eE]/g, ""); return s === "" ? "" : s; };
const date = (v) => {
  if (!v) return "";
  let s = String(v).trim();
  if (/^\d{4}\.\d{2}\.\d{2}/.test(s)) s = s.replace(/^(\d{4})\.(\d{2})\.(\d{2})/, "$1-$2-$3"); // MetaTrader style
  s = s.replace(" ", "T");
  const d = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}${/T/.test(s) ? "Z" : ""}`);
  return Number.isNaN(+d) ? "__invalid__" : d.toISOString();
};
const DIR = { buy: "buy", b: "buy", long: "buy", "buy limit": "buy", "buy stop": "buy", sell: "sell", s: "sell", short: "sell", "sell limit": "sell", "sell stop": "sell" };
const MKT = { forex: "forex", fx: "forex", currency: "forex", crypto: "crypto", cryptocurrency: "crypto", stocks: "stocks", stock: "stocks", equity: "stocks", equities: "stocks", commodities: "commodities", commodity: "commodities", metals: "commodities", indices: "indices", index: "indices" };

const normalize = (row, defaults) => {
  const dirRaw = String(row.direction || "").trim().toLowerCase();
  const mktRaw = String(row.marketType || defaults.marketType || "").trim().toLowerCase();
  const st = String(row.status || "").trim().toLowerCase();
  const exit = num(row.exitPrice), closedAt = date(row.closedAt);
  const status = ["open", "closed", "cancelled"].includes(st) ? st : st === "close" ? "closed" : exit !== "" && closedAt ? "closed" : "open";
  const out = {
    symbol: String(row.symbol || "").trim().replace(/[^A-Za-z0-9./_-]/g, ""),
    marketType: MKT[mktRaw] || mktRaw, direction: DIR[dirRaw] || dirRaw,
    entryPrice: num(row.entryPrice), exitPrice: exit, positionSize: num(row.positionSize), investmentAmount: num(row.investmentAmount) || 0,
    stopLoss: num(row.stopLoss), takeProfit: num(row.takeProfit), profitLoss: num(row.profitLoss), fees: num(row.fees) === "" ? 0 : Math.abs(Number(num(row.fees))),
    openedAt: date(row.openedAt), closedAt: closedAt || null, status,
    strategy: String(row.strategy || "").slice(0, 120), notes: String(row.notes || "").slice(0, 4000),
  };
  if (out.openedAt === "__invalid__") out.openedAt = "invalid";
  if (out.closedAt === "__invalid__") out.closedAt = "invalid";
  return out;
};

const bodySchema = z.object({
  clientId: z.string().regex(/^[a-f\d]{24}$/i, "Choose a client."),
  defaultMarketType: z.string().optional().default(""),
  dryRun: z.boolean().optional().default(false),
  rows: z.array(z.record(z.string(), z.any())).min(1, "The file has no rows.").max(1000, "Import at most 1000 rows at a time."),
});

router.post("/trades", asyncHandler(async (req, res) => {
  const b = parse(bodySchema, req.body);
  const client = await Client.findById(b.clientId);
  if (!client) throw new HttpError(400, "Client not found.");
  const existing = new Set((await Trade.find({ clientId: client._id, externalId: { $ne: null } }).select("externalId")).map((t) => t.externalId));
  const seen = new Set();
  const failed = []; let skipped = 0, created = 0, valid = 0;

  for (let i = 0; i < b.rows.length; i++) {
    const row = b.rows[i], line = i + 1;
    const ext = row.externalId ? `csv:${String(row.externalId).trim()}` : null;
    if (ext && (existing.has(ext) || seen.has(ext))) { skipped++; continue; }
    const r = tradeSchema.safeParse({ ...normalize(row, { marketType: b.defaultMarketType }), clientId: String(client._id) });
    if (!r.success) { const iss = r.error.issues[0]; failed.push({ row: line, message: `${iss.path.join(".") || "row"}: ${iss.message}` }); continue; }
    valid++;
    if (ext) seen.add(ext);
    if (b.dryRun) continue;
    await Trade.create({ ...finalize(r.data), tradeId: await nextTradeId(), source: "csv", externalId: ext });
    created++;
  }
  if (!b.dryRun && created && client.userId) notifyUsers([client.userId], { type: "trade_new", title: "Trades imported", body: `${created} trade${created === 1 ? "" : "s"} added to your account`, link: "/trades" }).catch(() => {});
  res.json({ dryRun: b.dryRun, total: b.rows.length, valid, created, skipped, failed: failed.slice(0, 50), failedCount: failed.length });
}));

export default router;
