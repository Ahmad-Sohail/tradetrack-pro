import { Router } from "express";
import ExcelJS from "exceljs";
import { Trade } from "../models/index.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { buildFilter } from "./trades.js";
import { summarize } from "../utils/analytics.js";

const router = Router();
router.use(requireAuth);

const COLS = [
  ["Trade ID", "tradeId"], ["Client", "clientName"], ["Symbol", "symbol"], ["Market", "marketType"], ["Direction", "direction"],
  ["Entry", "entryPrice"], ["Exit", "exitPrice"], ["Investment", "investmentAmount"], ["Position size", "positionSize"],
  ["Stop loss", "stopLoss"], ["Take profit", "takeProfit"], ["Profit/Loss", "profitLoss"], ["Fees", "fees"],
  ["Duration (min)", "durationMin"], ["Opened", "openedAt"], ["Closed", "closedAt"], ["Status", "status"], ["Strategy", "strategy"], ["Notes", "notes"],
];

const load = async (req) => {
  const docs = await Trade.find(buildFilter(req)).populate("clientId", "name").sort({ openedAt: -1 }).limit(5000);
  return docs.map((d) => {
    const o = d.toJSON();
    return {
      ...o, clientName: d.clientId?.name || "",
      durationMin: d.durationMs != null ? Math.round(d.durationMs / 60000) : "",
      openedAt: d.openedAt?.toISOString() || "", closedAt: d.closedAt ? d.closedAt.toISOString() : "",
    };
  });
};

// Guards against spreadsheet formula injection from user-entered text.
const safe = (v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v);

router.get("/trades.csv", asyncHandler(async (req, res) => {
  const rows = await load(req);
  const esc = (v) => { const s = String(safe(v ?? "")); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [COLS.map((c) => c[0]).join(","), ...rows.map((r) => COLS.map((c) => esc(r[c[1]])).join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="tradetrack-trades.csv"');
  res.send(csv);
}));

router.get("/trades.xlsx", asyncHandler(async (req, res) => {
  const rows = await load(req);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Trades");
  ws.columns = COLS.map(([header, key]) => ({ header, key, width: Math.max(12, header.length + 2) }));
  rows.forEach((r) => ws.addRow(Object.fromEntries(COLS.map(([, k]) => [k, safe(r[k] ?? "")]))));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const s = summarize(rows);
  const ss = wb.addWorksheet("Summary");
  ss.columns = [{ header: "Metric", key: "m", width: 24 }, { header: "Value", key: "v", width: 18 }];
  Object.entries(s).forEach(([m, v]) => ss.addRow({ m, v }));
  ss.getRow(1).font = { bold: true };
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="tradetrack-trades.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}));

// Data for client-side PDF generation (jsPDF).
router.get("/trades.json", asyncHandler(async (req, res) => {
  const rows = await load(req);
  res.json({ items: rows, summary: summarize(rows), generatedAt: new Date().toISOString() });
}));

export default router;
