import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, Client, Trade, Message, Notification, Counter, nextTradeId } from "../src/models/index.js";

const { MONGODB_URI, SEED_ADMIN_EMAIL, SEED_PASSWORD } = process.env;
if (!MONGODB_URI || !SEED_ADMIN_EMAIL || !SEED_PASSWORD) {
  console.error("Set MONGODB_URI, SEED_ADMIN_EMAIL and SEED_PASSWORD first.");
  process.exit(1);
}
if (process.argv.includes("--reset")) console.log("Resetting collections...");

await mongoose.connect(MONGODB_URI);
if (process.argv.includes("--reset")) await Promise.all([User, Client, Trade, Message, Notification, Counter].map((m) => m.deleteMany({})));

const hash = await bcrypt.hash(SEED_PASSWORD, 12);
if (!(await User.findOne({ email: SEED_ADMIN_EMAIL.toLowerCase() }))) {
  await User.create({ name: "Sample Admin", email: SEED_ADMIN_EMAIL.toLowerCase(), password: hash, role: "admin" });
}

// All names and trades below are SAMPLE data for demos only.
const sample = [
  ["Sample Client Amara", "amara@sample.test", "Nigeria", 25000],
  ["Sample Client Brandon", "brandon@sample.test", "United States", 50000],
  ["Sample Client Chen", "chen@sample.test", "Singapore", 15000],
  ["Sample Client Dara", "dara@sample.test", "Pakistan", 8000],
];
const assets = [["EURUSD", "forex", 1.08], ["BTCUSD", "crypto", 64000], ["AAPL", "stocks", 190], ["XAUUSD", "commodities", 2350], ["SPX", "indices", 5200]];
const strategies = ["Breakout", "Trend following", "Mean reversion", "News play"];
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

for (const [name, email, country, initialBalance] of sample) {
  if (await Client.findOne({ email })) continue;
  const c = await Client.create({ name, email, country, initialBalance, phone: "+000 000 0000", notes: "Sample record" });
  const u = await User.create({ name, email, password: hash, role: "client", clientId: c._id });
  c.userId = u._id; await c.save();
  for (let i = 0; i < 18; i++) {
    const [symbol, marketType, px] = assets[Math.floor(rnd() * assets.length)];
    const direction = rnd() > 0.5 ? "buy" : "sell";
    const size = Math.round((1 + rnd() * 9) * 100) / 100;
    const openedAt = new Date(Date.now() - (60 - i * 3) * 86400000 - rnd() * 3600000 * 10);
    const isOpen = i >= 16;
    const move = (rnd() - 0.42) * 0.03;
    const exitPrice = Math.round(px * (1 + move) * 10000) / 10000;
    const fees = Math.round(rnd() * 15 * 100) / 100;
    const pnl = Math.round(((exitPrice - px) * size * (direction === "buy" ? 1 : -1) * (px > 1000 ? 1 : px > 100 ? 10 : 1000) - fees) * 100) / 100;
    await Trade.create({
      tradeId: await nextTradeId(), clientId: c._id, symbol, marketType, direction, entryPrice: px, exitPrice: isOpen ? null : exitPrice,
      investmentAmount: Math.round(px * size * 0.1), positionSize: size, stopLoss: Math.round(px * 0.98 * 10000) / 10000, takeProfit: Math.round(px * 1.03 * 10000) / 10000,
      profitLoss: isOpen ? 0 : pnl, fees, openedAt, closedAt: isOpen ? null : new Date(openedAt.getTime() + (1 + rnd() * 48) * 3600000),
      status: isOpen ? "open" : "closed", strategy: strategies[i % strategies.length], notes: "Sample trade",
    });
  }
}
console.log("Seed complete. Sign in with", SEED_ADMIN_EMAIL);
await mongoose.disconnect();
