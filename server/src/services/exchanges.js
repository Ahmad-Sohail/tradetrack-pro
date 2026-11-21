import ccxt from "ccxt";

export const EXCHANGES = {
  binance: { label: "Binance", passphrase: false },
  bybit: { label: "Bybit", passphrase: false },
  okx: { label: "OKX", passphrase: true },
  kraken: { label: "Kraken", passphrase: false },
  kucoin: { label: "KuCoin", passphrase: true },
};

// The "fake" exchange exists only outside production, for automated tests.
const fake = () => ({
  async test() {},
  async fetchFills() {
    const t = Date.UTC(2026, 10, 1);
    return [
      { id: "b1", symbol: "BTC/USDT", side: "buy", price: 100, amount: 1, fee: 0, ts: t },
      { id: "b2", symbol: "BTC/USDT", side: "buy", price: 110, amount: 1, fee: 0, ts: t + 3600e3 },
      { id: "s1", symbol: "BTC/USDT", side: "sell", price: 120, amount: 1.5, fee: 0, ts: t + 7200e3 },
    ];
  },
});

const toFill = (t) => {
  const [base, quote] = String(t.symbol).split("/");
  const c = t.fee?.currency, cost = Number(t.fee?.cost) || 0;
  // Fees in the quote or base currency are converted; fees in other coins (for example BNB) are not counted.
  const fee = c === quote ? cost : c === base ? cost * t.price : 0;
  return { id: String(t.id), symbol: t.symbol, side: t.side, price: Number(t.price), amount: Number(t.amount), fee, ts: Number(t.timestamp) };
};

export function makeAdapter(exchange, creds) {
  if (process.env.NODE_ENV !== "production" && exchange === "fake") return fake();
  if (!EXCHANGES[exchange]) throw new Error("Unsupported exchange.");
  const ex = new ccxt[exchange]({ apiKey: creds.apiKey, secret: creds.secret, password: creds.passphrase || undefined, enableRateLimit: true, timeout: 20000 });
  return {
    async test() { await ex.fetchBalance(); },
    async fetchFills(symbols, since) {
      const out = [];
      for (const symbol of symbols) {
        let from = since;
        for (let page = 0; page < 20; page++) {
          const rows = await ex.fetchMyTrades(symbol, from, 500);
          if (!rows.length) break;
          out.push(...rows.map(toFill));
          const last = rows[rows.length - 1].timestamp;
          if (rows.length < 500 || last <= from) break;
          from = last + 1;
        }
      }
      const seen = new Set();
      return out.filter((f) => (seen.has(`${f.symbol}:${f.id}`) ? false : seen.add(`${f.symbol}:${f.id}`)));
    },
  };
}
