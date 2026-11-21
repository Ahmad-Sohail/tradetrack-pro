const BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
export const API_URL = BASE;
const KEY = "tt_token";

export const tokenStore = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(t) { try { localStorage.setItem(KEY, t); } catch {} },
  clear() { try { localStorage.removeItem(KEY); } catch {} },
};

export class ApiError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields || {}; }
}

const qs = (query) => {
  const p = new URLSearchParams();
  Object.entries(query || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "" && v !== "all") p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : "";
};

const authHeader = () => { const t = tokenStore.get(); return t ? { Authorization: `Bearer ${t}` } : {}; };

async function handle(res, path) {
  if (res.ok) return res;
  let body = {};
  try { body = await res.json(); } catch {}
  if (res.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
    tokenStore.clear();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("tt:unauthorized"));
  }
  throw new ApiError(res.status, body.message || "Request failed.", body.fields);
}

export async function api(path, { method = "GET", body, query, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}${qs(query)}`, {
      method, signal,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...authHeader() },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  await handle(res, path);
  return res.json();
}

export async function upload(path, file) {
  const fd = new FormData(); fd.append("file", file);
  let res;
  try { res = await fetch(`${BASE}/api${path}`, { method: "POST", headers: authHeader(), body: fd }); }
  catch { throw new ApiError(0, "Cannot reach the server."); }
  await handle(res, path);
  return res.json();
}

export async function download(path, query, filename) {
  const res = await fetch(`${BASE}/api${path}${qs(query)}`, { headers: authHeader() });
  await handle(res, path);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
