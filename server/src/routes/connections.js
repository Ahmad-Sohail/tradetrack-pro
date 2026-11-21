import { Router } from "express";
import { z } from "zod";
import { BrokerConnection, Client, Trade } from "../models/index.js";
import { asyncHandler, HttpError, parse, assertId } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { encrypt, encryptionEnabled } from "../utils/crypto.js";
import { EXCHANGES, makeAdapter } from "../services/exchanges.js";
import { syncConnection } from "../services/sync.js";

const router = Router();
router.use(requireAuth);

const isFake = (id) => process.env.NODE_ENV !== "production" && id === "fake";
const createSchema = z.object({
  clientId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  exchange: z.string().refine((v) => EXCHANGES[v] || isFake(v), "Choose a supported exchange."),
  label: z.string().trim().max(60).optional().default(""),
  apiKey: z.string().trim().min(5, "Enter the API key.").max(300),
  secret: z.string().trim().min(5, "Enter the API secret.").max(300),
  passphrase: z.string().trim().max(200).optional().default(""),
  symbols: z.array(z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,10}\/(USDT|USDC|USD|BUSD|FDUSD)$/, "Use pairs like BTC/USDT.")).min(1, "Add at least one trading pair.").max(20),
  historyDays: z.coerce.number().int().min(7).max(365).optional().default(90),
});

const load = async (req, id, withCreds = false) => {
  assertId(id);
  const q = BrokerConnection.findById(id);
  const c = await (withCreds ? q.select("+credentials") : q);
  if (!c || (req.user.role === "client" && String(c.clientId) !== String(req.user.clientId))) throw new HttpError(404, "Connection not found.");
  return c;
};

router.get("/exchanges", (_req, res) => res.json({ enabled: encryptionEnabled(), items: Object.entries(EXCHANGES).map(([id, e]) => ({ id, label: e.label, passphrase: e.passphrase })) }));

router.get("/", asyncHandler(async (req, res) => {
  const cid = req.user.role === "client" ? req.user.clientId : req.query.clientId;
  if (!cid) throw new HttpError(400, "clientId is required.");
  assertId(String(cid));
  const items = await BrokerConnection.find({ clientId: cid }).sort({ createdAt: -1 });
  res.json({ items: items.map((c) => c.toJSON()) });
}));

router.post("/", asyncHandler(async (req, res) => {
  if (!encryptionEnabled()) throw new HttpError(503, "Account connections are not configured on this server (missing ENCRYPTION_KEY).");
  const d = parse(createSchema, req.body);
  const clientId = req.user.role === "client" ? String(req.user.clientId) : d.clientId;
  if (!clientId) throw new HttpError(400, "Choose a client.", { clientId: "Choose a client." });
  if (!(await Client.exists({ _id: clientId }))) throw new HttpError(400, "Client not found.");
  if (EXCHANGES[d.exchange]?.passphrase && !d.passphrase) throw new HttpError(400, "This exchange needs an API passphrase.", { passphrase: "Enter the API passphrase." });

  const creds = { apiKey: d.apiKey, secret: d.secret, passphrase: d.passphrase };
  try { await makeAdapter(d.exchange, creds).test(); }
  catch (e) { throw new HttpError(400, `Could not connect: ${String(e.message).split(d.secret).join("***").split(d.apiKey).join("***").slice(0, 200)}`); }

  const conn = await BrokerConnection.create({ clientId, createdBy: req.user._id, exchange: d.exchange, label: d.label, symbols: d.symbols, historyDays: d.historyDays, credentials: encrypt(creds) });
  let summary = null, syncError = null;
  try { summary = await syncConnection(await BrokerConnection.findById(conn._id).select("+credentials")); } catch (e) { syncError = e.message; }
  res.status(201).json({ connection: (await BrokerConnection.findById(conn._id)).toJSON(), summary, syncError });
}));

router.post("/:id/sync", asyncHandler(async (req, res) => {
  const c = await load(req, req.params.id, true);
  const summary = await syncConnection(c);
  res.json({ connection: (await BrokerConnection.findById(c._id)).toJSON(), summary });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const c = await load(req, req.params.id);
  if (req.query.deleteTrades === "true") await Trade.deleteMany({ connectionId: c._id });
  else await Trade.updateMany({ connectionId: c._id }, { $set: { connectionId: null } });
  await c.deleteOne();
  res.json({ ok: true });
}));

export default router;
