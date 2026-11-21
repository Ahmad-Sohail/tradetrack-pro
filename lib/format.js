const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
export const money = (n) => usd.format(Number(n) || 0);
export const signedMoney = (n) => `${Number(n) > 0 ? "+" : ""}${usd.format(Number(n) || 0)}`;
export const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`;
export const num = (n, d = 4) => (n === null || n === undefined || n === "" ? "n/a" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d }));
export const dt = (v) => (v ? new Date(v).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "n/a");
export const dateOnly = (v) => (v ? new Date(v).toLocaleDateString("en-US", { dateStyle: "medium" }) : "n/a");
export const ago = (v) => {
  const s = Math.floor((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return dateOnly(v);
};
export const duration = (ms) => {
  if (ms == null) return "Still open";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};
export const toIsoDay = (d) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : "");
export const initials = (name = "") => name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
