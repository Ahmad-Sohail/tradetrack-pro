import { io } from "socket.io-client";
const API = process.env.API || "http://localhost:4000";
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };
const call = async (path, { method = "GET", token, body, raw } = {}) => {
  const r = await fetch(API + "/api" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (raw) return r;
  const j = await r.json().catch(() => ({})); return { s: r.status, ...j };
};
const stamp = Date.now();

// auth
let r = await call("/auth/register", { method: "POST", body: { name: "Admin", email: `admin${stamp}@t.test`, password: "short" } });
ok(r.s === 400 && r.fields?.password, "register rejects weak password with field error");
const first = await call("/auth/register", { method: "POST", body: { name: "Admin One", email: `admin${stamp}@t.test`, password: "StrongPass1" } });
const adminExisted = first.user?.role !== "admin";
const admin = adminExisted ? await call("/auth/login", { method: "POST", body: { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_PASSWORD } }) : first;
ok(!!admin.token && admin.user.role === "admin", "admin token (first user or seeded admin)");
const A = admin.token;
r = await call("/auth/login", { method: "POST", body: { email: `x${stamp}@t.test`, password: "nope12345" } });
ok(r.s === 401, "login with unknown account is 401");
r = await call("/clients"); ok(r.s === 401, "protected route without token is 401");

// clients
r = await call("/clients", { method: "POST", token: A, body: { name: "Smoke Alpha", email: `a${stamp}@t.test`, password: "ClientPass1", initialBalance: 10000 } });
ok(r.s === 201, "admin creates client A"); const cA = r.client.id;
r = await call("/clients", { method: "POST", token: A, body: { name: "Smoke Beta", email: `b${stamp}@t.test`, password: "ClientPass1", initialBalance: 5000 } });
const cB = r.client.id;
r = await call("/clients", { method: "POST", token: A, body: { name: "Dup", email: `a${stamp}@t.test`, password: "ClientPass1" } });
ok(r.s === 409, "duplicate client email is 409");
r = await call(`/clients?q=Smoke+Alpha`, { token: A }); ok(r.items?.length === 1 && r.items[0].id === cA, "client search");
r = await call(`/clients/${cA}`, { method: "PATCH", token: A, body: { phone: "+1 555 0100" } }); ok(r.client?.phone === "+1 555 0100" && r.client.initialBalance === 10000 && r.client.stats.balance === 10000, "client edit keeps other fields (partial update)");

// trades
const base = { clientId: cA, symbol: "eurusd", marketType: "forex", direction: "buy", entryPrice: 1.1, positionSize: 1000, investmentAmount: 1100, openedAt: "2026-11-01T09:00:00Z", fees: 2 };
r = await call("/trades", { method: "POST", token: A, body: { ...base, status: "closed" } });
ok(r.s === 400 && r.fields?.exitPrice, "closed trade without exit price is rejected");
r = await call("/trades", { method: "POST", token: A, body: { ...base, status: "closed", exitPrice: 1.12, closedAt: "2026-11-02T09:00:00Z" } });
ok(r.s === 201 && r.trade.profitLoss === 18 && r.trade.tradeId?.startsWith("TT-") && r.trade.symbol === "EURUSD", "closed trade computes net P/L (20 gross - 2 fees)");
const t1 = r.trade.id;
r = await call("/trades", { method: "POST", token: A, body: { ...base, clientId: cB, direction: "sell", status: "closed", exitPrice: 1.12, closedAt: "2026-11-03T09:00:00Z" } });
ok(r.trade.profitLoss === -22, "sell trade loss computed"); const tB = r.trade.id;
r = await call("/trades", { method: "POST", token: A, body: { ...base, symbol: "BTCUSD", marketType: "crypto" } });
ok(r.trade.status === "open", "open trade created");
r = await call(`/trades/${t1}`, { method: "PATCH", token: A, body: { notes: "edited", exitPrice: 1.13 } });
ok(r.trade?.notes === "edited" && r.trade.profitLoss === 28, "trade edit re-derives P/L");
r = await call(`/trades?clientId=${cA}&status=closed&q=eur`, { token: A }); ok(r.total === 1, "trade filter + search");

// client portal + isolation
const cl = await call("/auth/login", { method: "POST", body: { email: `a${stamp}@t.test`, password: "ClientPass1" } });
ok(cl.user?.role === "client", "client login"); const C = cl.token;
r = await call("/trades", { token: C }); ok(r.total === 2 && r.items.every((t) => t.clientId === cA), "client only sees own trades");
r = await call("/trades?clientId=" + cB, { token: C }); ok(r.items.every((t) => t.clientId === cA), "client cannot widen scope via query");
r = await call(`/trades/${tB}`, { token: C }); ok(r.s === 404, "client cannot open another client's trade");
r = await call("/trades", { method: "POST", token: C, body: base }); ok(r.s === 403, "client cannot create trades");
r = await call(`/trades/${t1}`, { method: "DELETE", token: C }); ok(r.s === 403, "client cannot delete trades");
r = await call("/clients", { token: C }); ok(r.s === 403, "client cannot list clients");
r = await call(`/clients/${cB}`, { token: C }); ok(r.s === 403, "client cannot read another client");
r = await call("/analytics", { token: C }); ok(r.summary.totalTrades === 2 && r.byClient.length === 0, "client analytics scoped, no client comparison");
r = await call("/messages/" + cB, { token: C }); ok(r.s === 403, "client cannot read another conversation");

// analytics (admin)
r = await call("/analytics", { token: A });
ok(r.summary.totalClients >= 2 && r.equity.length > 0 && r.byAsset.length > 0 && r.byClient.length >= 2, "admin analytics include all breakdowns");
r = await call(`/analytics?clientId=${cA}`, { token: A });
ok(r.summary.winningTrades === 1 && r.summary.openTrades === 1 && r.summary.winRate === 100 && r.summary.balance === 10028, "client analytics numbers (balance 10000 + 28)"); if (r.summary.balance !== 10028) console.log("   got", JSON.stringify(r.summary));

// notifications
r = await call("/notifications", { token: C }); ok(r.items.length >= 3 && r.unread >= 3, "client received trade notifications");
const nid = r.items[0].id;
r = await call(`/notifications/${nid}/read`, { method: "PATCH", token: C }); ok(r.notification?.read === true, "mark notification read");
r = await call("/notifications/read-all", { method: "POST", token: C }); r = await call("/notifications", { token: C }); ok(r.unread === 0, "mark all read");

// chat + sockets
const sockA = io(API, { auth: { token: A }, transports: ["websocket"] });
const sockC = io(API, { auth: { token: C }, transports: ["websocket"] });
const badSock = io(API, { auth: { token: "bad" }, transports: ["websocket"], reconnection: false });
const bad = await new Promise((res) => { badSock.on("connect_error", () => res(true)); setTimeout(() => res(false), 3000); });
ok(bad, "socket with invalid token is rejected");
const whenUp = (s) => new Promise((r) => (s.connected ? r() : s.on("connect", r)));
await Promise.race([Promise.all([whenUp(sockA), whenUp(sockC)]), new Promise((_, rej) => setTimeout(() => rej(new Error("sockets did not connect")), 5000))]);
const gotC = new Promise((res) => sockC.on("message:new", res));
const gotA = new Promise((res) => sockA.on("message:new", res));
await call("/messages/" + cA, { method: "POST", token: A, body: { body: "Welcome aboard" } });
const mC = await Promise.race([gotC, new Promise((r) => setTimeout(() => r(null), 3000))]);
ok(mC?.body === "Welcome aboard", "client receives admin message in real time");
const readEvt = new Promise((res) => sockA.on("messages:read", res));
r = await call("/messages/" + cA, { token: C }); ok(r.items.length === 1, "client loads history");
const re = await Promise.race([readEvt, new Promise((r) => setTimeout(() => r(null), 3000))]);
ok(re?.by === "client", "admin gets read receipt event");
await call("/messages/" + cA, { method: "POST", token: C, body: { body: "Thanks" } });
const mA = await Promise.race([gotA, new Promise((r) => setTimeout(() => r(null), 3000))]);
ok(mA?.body === "Welcome aboard" || mA?.body === "Thanks", "admin receives messages in real time");
r = await call("/messages/conversations", { token: A }); const conv = r.items.find((i) => i.clientId === cA);
ok(conv?.lastMessage && conv.unread === 1, "admin conversation list shows unread count");
r = await call("/messages/" + cA, { method: "POST", token: C, body: { body: "", attachment: { url: "https://evil.test/x.png", name: "x", type: "image/png", size: 1 } } });
ok(r.s === 400, "attachment from non-Cloudinary host rejected");
r = await fetch(API + "/api/messages/upload", { method: "POST", headers: { Authorization: `Bearer ${C}` } }); ok(r.status === 503, "upload reports not configured when Cloudinary env is unset");
r = await call("/messages/config", { token: C }); ok(r.uploadsEnabled === false, "chat config reports uploads disabled without Cloudinary env");
sockA.close(); sockC.close();

// reports
let rep = await call(`/reports/trades.csv?clientId=${cA}`, { token: A, raw: true });
const csv = await rep.text(); ok(rep.status === 200 && csv.split("\n").length === 3 && csv.includes("EURUSD"), "CSV export (header + closed + open trade)");
rep = await call(`/reports/trades.xlsx`, { token: A, raw: true });
const buf = Buffer.from(await rep.arrayBuffer()); ok(rep.status === 200 && buf.slice(0, 2).toString() === "PK", "XLSX export is a valid zip");
rep = await call(`/reports/trades.csv`, { token: C, raw: true }); const ccsv = await rep.text(); ok(ccsv.includes("Smoke Alpha") && !ccsv.includes("Smoke Beta") && ccsv.split("\n").length === 3, "client CSV only contains own trades");

// delete cascade
r = await call(`/trades/${t1}`, { method: "DELETE", token: A }); ok(r.ok === true, "admin deletes trade");
r = await call(`/clients/${cA}`, { method: "DELETE", token: A }); ok(r.ok === true, "admin deletes client"); if (!r.ok) console.log("   got", JSON.stringify(r));
r = await call("/auth/login", { method: "POST", body: { email: `a${stamp}@t.test`, password: "ClientPass1" } }); ok(r.s === 401, "deleted client can no longer log in");
await call(`/clients/${cB}`, { method: "DELETE", token: A });

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
