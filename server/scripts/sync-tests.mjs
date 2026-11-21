import mongoose from "mongoose";
import { matchFills } from "../src/services/fifo.js";
import { encrypt, decrypt } from "../src/utils/crypto.js";
import { syncConnection } from "../src/services/sync.js";
import { BrokerConnection, Client, Trade } from "../src/models/index.js";

const API = process.env.API || "http://localhost:4000";
let fails = 0;
const ok = (c, m, extra) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) { fails++; if (extra !== undefined) console.log("   got", JSON.stringify(extra)); } };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const call = async (path, { method = "GET", token, body } = {}) => {
  const r = await fetch(API + "/api" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, ...(await r.json().catch(() => ({}))) };
};

// ---------- pure logic ----------
const t0 = 1_000_000;
let m = matchFills([
  { id: "b1", symbol: "BTC/USDT", side: "buy", price: 100, amount: 1, fee: 1, ts: t0 },
  { id: "b2", symbol: "BTC/USDT", side: "buy", price: 110, amount: 1, fee: 1, ts: t0 + 1 },
  { id: "s1", symbol: "BTC/USDT", side: "sell", price: 120, amount: 1.5, fee: 1.5, ts: t0 + 2 },
]);
ok(m.closed.length === 1 && near(m.closed[0].entryPrice, 155 / 1.5) && near(m.closed[0].positionSize, 1.5), "FIFO: sell consumes lot 1 fully and half of lot 2", m.closed);
// pnl = (120-103.3333)*1.5 = 25 ; fees = 1 + 0.5 + 1.5 = 3 ; net 22
ok(near(m.closed[0].fees, 3) && near(m.closed[0].profitLoss, 22), "FIFO: P/L is net of buy and sell fees (25 - 3 = 22)", m.closed[0]);
ok(m.open.length === 1 && near(m.open[0].positionSize, 0.5) && m.open[0].externalId === "open:b2", "FIFO: remaining half of lot 2 stays open", m.open);
m = matchFills([{ id: "s9", symbol: "ETH/USDT", side: "sell", price: 10, amount: 1, fee: 0, ts: 1 }, { id: "x", symbol: "ETH/BTC", side: "buy", price: 1, amount: 1, fee: 0, ts: 1 }]);
ok(m.closed.length === 0 && m.unmatchedSells === 1 && m.skippedSymbols.includes("ETH/BTC"), "FIFO: unmatched sells and non-USD quotes are reported, not invented", m);

// ---------- encryption ----------
const blob = encrypt({ apiKey: "KEY-123456", secret: "SECRET-654321" });
ok(!blob.includes("KEY-123456") && decrypt(blob).secret === "SECRET-654321", "encryption round-trips and hides plaintext");
let tampered = false; try { const p = blob.split(":"); p[2] = Buffer.from("x" + Buffer.from(p[2], "base64").toString("latin1").slice(1), "latin1").toString("base64"); decrypt(p.join(":")); } catch { tampered = true; }
ok(tampered, "tampered ciphertext is rejected");

// ---------- DB-level sync stages ----------
await mongoose.connect(process.env.MONGODB_URI);
const reg = await call("/auth/register", { method: "POST", body: { name: "Sync Admin", email: `sa${Date.now()}@t.test`, password: "StrongPass1" } });
const A = reg.token;
const mk = async (n) => (await call("/clients", { method: "POST", token: A, body: { name: n, email: `${n.replace(/\s/g, "").toLowerCase()}${Date.now()}@t.test`, password: "ClientPass1", initialBalance: 1000 } })).client;
const cA = await mk("Sync Alpha"), cB = await mk("Sync Beta");

const conn = await BrokerConnection.create({ clientId: cA.id, exchange: "binance", symbols: ["BTC/USDT"], historyDays: 30, credentials: encrypt({ apiKey: "STAGE-KEY-1", secret: "STAGE-SECRET-1" }) });
const run = async (fills) => syncConnection(await BrokerConnection.findById(conn._id).select("+credentials"), { adapter: { fetchFills: async () => fills } });
const stage1 = [{ id: "b1", symbol: "BTC/USDT", side: "buy", price: 100, amount: 1, fee: 0, ts: Date.now() - 5000 }, { id: "b2", symbol: "BTC/USDT", side: "buy", price: 110, amount: 1, fee: 0, ts: Date.now() - 4000 }];
let s = await run(stage1);
ok(s.created === 2 && (await Trade.countDocuments({ connectionId: conn._id, status: "open" })) === 2, "sync stage 1: two open trades created", s);
s = await run(stage1); ok(s.created === 0 && s.updated === 0 && s.removed === 0, "re-sync with same data changes nothing (idempotent)", s);
const stage2 = [...stage1, { id: "s1", symbol: "BTC/USDT", side: "sell", price: 120, amount: 1.5, fee: 0, ts: Date.now() - 3000 }];
s = await run(stage2);
const trades = await Trade.find({ connectionId: conn._id }).sort({ externalId: 1 });
const closed = trades.filter((t) => t.status === "closed"), open = trades.filter((t) => t.status === "open");
ok(s.created === 1 && s.removed === 1 && s.updated === 1, "sync stage 2: closed trade created, consumed lot removed, partial lot resized", s);
ok(closed.length === 1 && near(closed[0].profitLoss, 25), "closed trade P/L is 25", closed.map((t) => t.profitLoss));
ok(open.length === 1 && near(open[0].positionSize, 0.5), "remaining open size is 0.5", open.map((t) => t.positionSize));
const raw = await mongoose.connection.db.collection("brokerconnections").findOne({ _id: conn._id });
ok(!JSON.stringify(raw).includes("STAGE-KEY-1") && !JSON.stringify(raw).includes("STAGE-SECRET-1"), "API key and secret are not stored in plaintext");
const failing = await BrokerConnection.findById(conn._id).select("+credentials");
let msg = ""; try { await syncConnection(failing, { adapter: { fetchFills: async () => { throw new Error("denied for key STAGE-SECRET-1"); } } }); } catch (e) { msg = e.message; }
const afterFail = await BrokerConnection.findById(conn._id);
ok(afterFail.status === "error" && !msg.includes("STAGE-SECRET-1") && !afterFail.lastError.includes("STAGE-SECRET-1"), "failed sync is recorded and secrets are scrubbed from the error", afterFail.lastError);

// ---------- HTTP: connections ----------
const login = async (e) => (await call("/auth/login", { method: "POST", body: { email: e, password: "ClientPass1" } })).token;
const CA = await login(cA.email), CB = await login(cB.email);
let r = await call("/connections/exchanges", { token: CA }); ok(r.enabled === true && r.items.some((x) => x.id === "binance"), "exchange list available and sync enabled");
const body = { exchange: "fake", apiKey: "FAKE-KEY-AAAA", secret: "FAKE-SECRET-BBBB", symbols: ["btc/usdt"] };
r = await call("/connections", { method: "POST", token: CA, body: { ...body, symbols: ["BTCUSDT"] } }); ok(r.s === 400 && r.fields?.["symbols.0"], "invalid pair format rejected");
r = await call("/connections", { method: "POST", token: CA, body: { ...body, exchange: "nope" } }); ok(r.s === 400, "unsupported exchange rejected");
r = await call("/connections", { method: "POST", token: CA, body: { ...body, clientId: cB.id } });
ok(r.s === 201 && r.connection.clientId === cA.id, "client cannot attach a connection to another client (forced to self)", r);
ok(!JSON.stringify(r).includes("FAKE-KEY-AAAA") && !JSON.stringify(r).includes("FAKE-SECRET-BBBB") && !("credentials" in r.connection), "API response never contains credentials");
ok(r.summary?.created === 2 && r.connection.status === "ok", "initial sync ran on connect", r.summary);
const cid = r.connection.id;
r = await call("/trades?clientId=" + cA.id + "&limit=50", { token: CA });
const synced = r.items.filter((t) => t.source === "sync" && t.symbol === "BTCUSDT" && t.externalId?.startsWith("sell:"));
ok(synced.length >= 1 && near(synced[0].profitLoss, 25) && synced[0].marketType === "crypto", "synced closed trade visible to the client with correct P/L", synced.map((t) => t.profitLoss));
r = await call(`/connections/${cid}/sync`, { method: "POST", token: CA }); ok(r.s === 200 && r.summary.created === 0, "manual sync is idempotent", r);
r = await call(`/connections/${cid}/sync`, { method: "POST", token: CB }); ok(r.s === 404, "other client cannot sync this connection");
r = await call(`/connections/${cid}`, { method: "DELETE", token: CB }); ok(r.s === 404, "other client cannot delete this connection");
r = await call(`/connections?clientId=${cA.id}`, { token: CB }); ok(r.items.length === 0, "other client only ever sees their own connections");
r = await call(`/connections?clientId=${cA.id}`, { token: A }); ok(r.items.length >= 2, "admin sees the client's connections");
const st = (await call("/trades?clientId=" + cA.id + "&limit=50", { token: A })).items.find((t) => t.source === "sync" && t.status === "closed");
r = await call(`/trades/${st.id}`, { method: "PATCH", token: A, body: { exitPrice: 999, notes: "kept note" } });
ok(r.trade?.notes === "kept note" && near(r.trade.exitPrice, st.exitPrice), "synced trades: notes editable, broker fields protected", r.trade);
r = await call(`/connections/${cid}`, { method: "DELETE", token: CA }); ok(r.ok, "client removes own connection");
ok((await call("/trades?clientId=" + cA.id + "&limit=50", { token: CA })).items.some((t) => t.id === st.id), "removing a connection keeps its trades by default");

// ---------- HTTP: CSV import ----------
const rows = [
  { externalId: "T1", symbol: "eurusd", direction: "Buy", entryPrice: "1.1000", exitPrice: "1.1200", positionSize: "1,000", fees: "2", openedAt: "2026.11.01 09:00:00", closedAt: "2026.11.02 09:00:00" },
  { externalId: "T2", symbol: "XAUUSD", direction: "sell", entryPrice: "2,350.50", positionSize: "1", openedAt: "2026-11-03 10:00" },
  { externalId: "T1", symbol: "EURUSD", direction: "buy", entryPrice: "1", positionSize: "1", openedAt: "2026-11-01" },
  { symbol: "", direction: "up", entryPrice: "abc", positionSize: "1", openedAt: "not a date" },
];
r = await call("/imports/trades", { method: "POST", token: A, body: { clientId: cB.id, defaultMarketType: "fx", dryRun: true, rows } });
ok(r.s === 200 && r.valid === 2 && r.skipped === 1 && r.failedCount === 1 && r.created === 0, "import dry run: 2 valid, 1 duplicate, 1 invalid, nothing written", r);
r = await call("/imports/trades", { method: "POST", token: A, body: { clientId: cB.id, defaultMarketType: "fx", rows } });
ok(r.created === 2 && r.failed[0].row === 4, "import creates valid rows and reports the failing row number", r);
r = await call("/trades?clientId=" + cB.id + "&limit=20", { token: A });
const t1 = r.items.find((t) => t.symbol === "EURUSD");
ok(t1 && t1.source === "csv" && t1.status === "closed" && near(t1.profitLoss, 18) && t1.marketType === "forex", "imported closed trade: P/L computed (20 - 2 fees = 18), market mapped from 'fx'", t1);
const t2 = r.items.find((t) => t.symbol === "XAUUSD"); ok(t2 && t2.status === "open" && near(t2.entryPrice, 2350.5) && t2.direction === "sell", "imported open trade parsed (commas stripped, status inferred)", t2);
r = await call("/imports/trades", { method: "POST", token: A, body: { clientId: cB.id, defaultMarketType: "fx", rows } }); ok(r.created === 0 && r.skipped === 3, "re-importing the same file creates no duplicates", r);
r = await call("/imports/trades", { method: "POST", token: CA, body: { clientId: cA.id, rows } }); ok(r.s === 403, "clients cannot import trades");

await mongoose.disconnect();
console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
