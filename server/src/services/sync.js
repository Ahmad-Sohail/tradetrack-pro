import { BrokerConnection, Client, Trade, nextTradeId } from "../models/index.js";
import { decrypt } from "../utils/crypto.js";
import { notifyAdmins, notifyUsers } from "../utils/notify.js";
import { makeAdapter, EXCHANGES } from "./exchanges.js";
import { matchFills } from "./fifo.js";

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const close = (a, b, tol = 1e-8) => (a == null && b == null) || Math.abs((a ?? 0) - (b ?? 0)) <= tol * Math.max(1, Math.abs(a ?? 0));
const same = (t, d) => ["entryPrice", "exitPrice", "positionSize", "fees", "profitLoss", "investmentAmount"].every((k) => close(t[k], d[k])) && t.status === d.status
  && +t.openedAt === +d.openedAt && (+t.closedAt || 0) === (+d.closedAt || 0);

const scrub = (msg, creds) => { let m = String(msg || "Sync failed"); for (const v of Object.values(creds || {})) if (v && String(v).length > 5) m = m.split(String(v)).join("***"); return m.slice(0, 300); };

export async function syncConnection(conn, { adapter } = {}) {
  let creds = {};
  try {
    creds = decrypt(conn.credentials);
    const ad = adapter || makeAdapter(conn.exchange, creds);
    const since = Date.now() - conn.historyDays * 86400e3;
    const fills = await ad.fetchFills(conn.symbols, since);
    const { closed, open, unmatchedSells, skippedSymbols } = matchFills(fills);

    const existing = await Trade.find({ connectionId: conn._id });
    const byExt = new Map(existing.map((t) => [t.externalId, t]));
    const keep = new Set();
    let created = 0, updated = 0, removed = 0;

    for (const [list, status] of [[closed, "closed"], [open, "open"]]) {
      for (const r of list) {
        keep.add(r.externalId);
        const d = {
          clientId: conn.clientId, connectionId: conn._id, source: "sync", externalId: r.externalId, status,
          symbol: r.symbol.replace("/", ""), marketType: "crypto", direction: "buy",
          entryPrice: r.entryPrice, exitPrice: status === "closed" ? r.exitPrice : null, positionSize: r.positionSize,
          investmentAmount: r2(r.entryPrice * r.positionSize), fees: r.fees, profitLoss: status === "closed" ? r.profitLoss : 0,
          openedAt: new Date(r.openedAt), closedAt: status === "closed" ? new Date(r.closedAt) : null,
        };
        const ex = byExt.get(r.externalId);
        if (!ex) { await Trade.create({ ...d, tradeId: await nextTradeId(), strategy: "", notes: "" }); created++; }
        else if (!same(ex, d)) { Object.assign(ex, d); await ex.save(); updated++; }
      }
    }
    // An open lot disappears once later sells consume it; its closed round trip replaces it.
    for (const t of existing) if (t.status === "open" && !keep.has(t.externalId)) { await t.deleteOne(); removed++; }

    const summary = { fills: fills.length, created, updated, removed, unmatchedSells, skippedSymbols };
    conn.status = "ok"; conn.lastError = ""; conn.lastSyncAt = new Date(); conn.lastSummary = summary;
    await conn.save();

    if (created > 0) {
      const client = await Client.findById(conn.clientId);
      const label = EXCHANGES[conn.exchange]?.label || conn.exchange;
      const note = { type: "trade_new", title: "Trades synced", body: `${created} new trade${created === 1 ? "" : "s"} from ${label}${client ? ` for ${client.name}` : ""}`, link: "/trades" };
      if (client?.userId) await notifyUsers([client.userId], note);
      await notifyAdmins(note);
    }
    return summary;
  } catch (e) {
    conn.status = "error"; conn.lastError = scrub(e.message, creds);
    await conn.save().catch(() => {});
    const err = new Error(conn.lastError); err.status = 502; throw err;
  }
}

let running = false;
export async function runAllSyncs() {
  if (running) return;
  running = true;
  try {
    const conns = await BrokerConnection.find().select("+credentials");
    for (const c of conns) { try { await syncConnection(c); } catch (e) { console.warn(`Sync failed for ${c.exchange} ${c._id}: ${e.message}`); } }
  } finally { running = false; }
}
