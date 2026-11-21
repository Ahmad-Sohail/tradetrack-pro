const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const live = (t) => t.status !== "cancelled";
const closed = (t) => t.status === "closed";
const win = (t) => closed(t) && t.profitLoss > 0;
const loss = (t) => closed(t) && t.profitLoss < 0;

export function summarize(trades) {
  const ts = trades.filter(live);
  const wins = ts.filter(win), losses = ts.filter(loss);
  const totalProfit = wins.reduce((s, t) => s + t.profitLoss, 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + t.profitLoss, 0));
  const decided = wins.length + losses.length;
  return {
    totalTrades: ts.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    openTrades: ts.filter((t) => t.status === "open").length,
    totalProfit: r2(totalProfit),
    totalLoss: r2(totalLoss),
    netPnl: r2(totalProfit - totalLoss),
    winRate: decided ? r2((wins.length / decided) * 100) : 0,
    fees: r2(ts.reduce((s, t) => s + (t.fees || 0), 0)),
    investment: r2(ts.reduce((s, t) => s + (t.investmentAmount || 0), 0)),
  };
}

const day = (d) => new Date(d).toISOString().slice(0, 10);

export function buildAnalytics(trades, clients, openingBalance) {
  const ts = trades.filter(live);
  const cl = ts.filter(closed).sort((a, b) => new Date(a.closedAt) - new Date(b.closedAt));

  const dailyMap = new Map();
  for (const t of cl) {
    const k = day(t.closedAt);
    const d = dailyMap.get(k) || { date: k, pnl: 0, trades: 0 };
    d.pnl += t.profitLoss; d.trades += 1; dailyMap.set(k, d);
  }
  const daily = [...dailyMap.values()].map((d) => ({ ...d, pnl: r2(d.pnl) }));

  let eq = openingBalance;
  const equity = daily.map((d) => { eq += d.pnl; return { date: d.date, equity: r2(eq), pnl: d.pnl }; });

  const monthMap = new Map();
  for (const t of cl) {
    const k = day(t.closedAt).slice(0, 7);
    const m = monthMap.get(k) || { month: k, pnl: 0, wins: 0, losses: 0 };
    m.pnl += t.profitLoss; if (t.profitLoss > 0) m.wins++; else if (t.profitLoss < 0) m.losses++;
    monthMap.set(k, m);
  }
  const monthly = [...monthMap.values()].map((m) => ({ ...m, pnl: r2(m.pnl) }));

  const group = (list, keyFn) => {
    const map = new Map();
    for (const t of list) { const k = keyFn(t); (map.get(k) || map.set(k, []).get(k)).push(t); }
    return map;
  };
  const byAsset = [...group(cl, (t) => t.symbol)].map(([symbol, list]) => {
    const s = summarize(list);
    return { symbol, trades: list.length, pnl: s.netPnl, winRate: s.winRate };
  }).sort((a, b) => b.pnl - a.pnl);

  const nameOf = new Map(clients.map((c) => [String(c._id), c]));
  const byClient = [...group(ts, (t) => String(t.clientId))].map(([cid, list]) => {
    const s = summarize(list);
    const c = nameOf.get(cid);
    return { clientId: cid, name: c ? c.name : "Unknown", trades: s.totalTrades, pnl: s.netPnl, winRate: s.winRate, balance: r2((c?.initialBalance || 0) + s.netPnl) };
  }).sort((a, b) => b.pnl - a.pnl);

  const s = summarize(ts);
  return {
    summary: { ...s, balance: r2(openingBalance + s.netPnl), openingBalance: r2(openingBalance) },
    equity, daily, monthly, byAsset, byClient,
    winLoss: [
      { name: "Winning", value: s.winningTrades },
      { name: "Losing", value: s.losingTrades },
      { name: "Open", value: s.openTrades },
    ],
  };
}

export function clientStats(clients, trades) {
  const by = new Map();
  for (const t of trades) (by.get(String(t.clientId)) || by.set(String(t.clientId), []).get(String(t.clientId))).push(t);
  return new Map(clients.map((c) => {
    const s = summarize(by.get(String(c._id)) || []);
    return [String(c._id), { trades: s.totalTrades, openTrades: s.openTrades, pnl: s.netPnl, winRate: s.winRate, investment: s.investment, balance: r2(c.initialBalance + s.netPnl) }];
  }));
}
