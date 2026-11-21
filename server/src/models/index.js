import mongoose from "mongoose";
const { Schema, model } = mongoose;
const oid = Schema.Types.ObjectId;

const clean = {
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_d, r) => { r.id = String(r._id); delete r._id; delete r.password; delete r.credentials; return r; },
  },
};

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin", "client"], required: true },
  clientId: { type: oid, ref: "Client", default: null },
}, { timestamps: true, ...clean });

const clientSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: "" },
  country: { type: String, default: "" },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  initialBalance: { type: Number, default: 0 },
  notes: { type: String, default: "" },
  userId: { type: oid, ref: "User" },
}, { timestamps: true, ...clean });

const tradeSchema = new Schema({
  tradeId: { type: String, unique: true },
  clientId: { type: oid, ref: "Client", required: true, index: true },
  symbol: { type: String, required: true, uppercase: true, trim: true },
  marketType: { type: String, enum: ["forex", "crypto", "stocks", "commodities", "indices"], required: true },
  direction: { type: String, enum: ["buy", "sell"], required: true },
  entryPrice: { type: Number, required: true },
  exitPrice: { type: Number, default: null },
  investmentAmount: { type: Number, default: 0 },
  positionSize: { type: Number, required: true },
  stopLoss: { type: Number, default: null },
  takeProfit: { type: Number, default: null },
  profitLoss: { type: Number, default: 0 },
  fees: { type: Number, default: 0 },
  openedAt: { type: Date, required: true },
  closedAt: { type: Date, default: null },
  status: { type: String, enum: ["open", "closed", "cancelled"], default: "open" },
  strategy: { type: String, default: "" },
  notes: { type: String, default: "" },
  source: { type: String, enum: ["manual", "csv", "sync"], default: "manual" },
  externalId: { type: String, default: null, index: true },
  connectionId: { type: oid, ref: "BrokerConnection", default: null, index: true },
}, { timestamps: true, ...clean });
tradeSchema.virtual("durationMs").get(function () {
  return this.closedAt && this.openedAt ? this.closedAt - this.openedAt : null;
});

const messageSchema = new Schema({
  clientId: { type: oid, ref: "Client", required: true, index: true },
  senderId: { type: oid, ref: "User", required: true },
  senderRole: { type: String, enum: ["admin", "client"], required: true },
  body: { type: String, default: "" },
  attachment: { type: new Schema({ url: String, name: String, type: String, size: Number }, { _id: false }), default: undefined },
  readAt: { type: Date, default: null },
}, { timestamps: true, ...clean });

const notificationSchema = new Schema({
  userId: { type: oid, ref: "User", required: true, index: true },
  type: { type: String, enum: ["trade_new", "trade_update", "trade_closed", "message", "client_new"], required: true },
  title: { type: String, required: true },
  body: { type: String, default: "" },
  link: { type: String, default: "" },
  read: { type: Boolean, default: false },
}, { timestamps: true, ...clean });

const connectionSchema = new Schema({
  clientId: { type: oid, ref: "Client", required: true, index: true },
  createdBy: { type: oid, ref: "User" },
  exchange: { type: String, required: true },
  label: { type: String, default: "" },
  symbols: [String],
  historyDays: { type: Number, default: 90 },
  credentials: { type: String, required: true, select: false },
  status: { type: String, enum: ["pending", "ok", "error"], default: "pending" },
  lastSyncAt: Date,
  lastError: { type: String, default: "" },
  lastSummary: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true, ...clean });

const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });

export const User = model("User", userSchema);
export const Client = model("Client", clientSchema);
export const Trade = model("Trade", tradeSchema);
export const Message = model("Message", messageSchema);
export const Notification = model("Notification", notificationSchema);
export const BrokerConnection = model("BrokerConnection", connectionSchema);
export const Counter = model("Counter", counterSchema);
export const nextTradeId = async () => {
  const c = await Counter.findOneAndUpdate({ _id: "trade" }, { $inc: { seq: 1 } }, { returnDocument: "after", upsert: true });
  return `TT-${String(c.seq).padStart(6, "0")}`;
};
