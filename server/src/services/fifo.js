const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const EPS = 1e-12;
export const QUOTES = ["USDT", "USDC", "USD", "BUSD", "FDUSD"];

// Turns spot fills into round-trip trades using FIFO lot matching.
// fill: { id, symbol: "BTC/USDT", side: "buy"|"sell", price, amount, fee (in quote currency), ts (ms) }
// Spot cannot be short, so a sell with no prior buy inside the history window is counted as unmatched.
export function matchFills(fills) {
  const closed = [], open = [];
  let unmatchedSells = 0, skippedSymbols = new Set();
  const bySymbol = new Map();
  for (const f of fills) {
    const quote = String(f.symbol).split("/")[1];
    if (!QUOTES.includes(quote)) { skippedSymbols.add(f.symbol); continue; }
    (bySymbol.get(f.symbol) || bySymbol.set(f.symbol, []).get(f.symbol)).push(f);
  }
  for (const [symbol, list] of bySymbol) {
    list.sort((a, b) => a.ts - b.ts || String(a.id).localeCompare(String(b.id)));
    const lots = [];
    for (const f of list) {
      if (f.side === "buy") { lots.push({ id: f.id, price: f.price, amount: f.amount, feePer: f.amount ? f.fee / f.amount : 0, ts: f.ts }); continue; }
      let remaining = f.amount, cost = 0, qty = 0, buyFee = 0, first = null;
      while (remaining > EPS && lots.length) {
        const lot = lots[0], take = Math.min(lot.amount, remaining);
        cost += take * lot.price; qty += take; buyFee += take * lot.feePer; first = first === null ? lot.ts : Math.min(first, lot.ts);
        lot.amount -= take; remaining -= take;
        if (lot.amount <= EPS) lots.shift();
      }
      if (remaining > EPS) unmatchedSells++;
      if (qty > EPS) {
        const entry = cost / qty, fees = buyFee + (f.amount ? f.fee * (qty / f.amount) : 0);
        closed.push({ externalId: `sell:${f.id}`, symbol, entryPrice: entry, exitPrice: f.price, positionSize: qty, fees: r2(fees), profitLoss: r2((f.price - entry) * qty - fees), openedAt: first, closedAt: f.ts });
      }
    }
    for (const lot of lots) open.push({ externalId: `open:${lot.id}`, symbol, entryPrice: lot.price, positionSize: lot.amount, fees: r2(lot.feePer * lot.amount), openedAt: lot.ts });
  }
  return { closed, open, unmatchedSells, skippedSymbols: [...skippedSymbols] };
}
