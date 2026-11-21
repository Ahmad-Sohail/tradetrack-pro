"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "@neuctra/ui";
import { api, API_URL, tokenStore } from "@/lib/api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [notifUnread, setNotifUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const userRef = useRef(null);
  userRef.current = user;

  const refreshCounts = useCallback(async () => {
    try {
      const [n, c] = await Promise.all([api("/notifications", { query: { limit: 1 } }), api("/messages/conversations")]);
      setNotifUnread(n.unread);
      setChatUnread(c.items.reduce((s, i) => s + i.unread, 0));
    } catch {}
  }, []);

  useEffect(() => {
    const t = tokenStore.get();
    if (!t) { setLoading(false); return; }
    api("/auth/me").then((r) => setUser(r.user)).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onUnauth = () => { setUser(null); };
    window.addEventListener("tt:unauthorized", onUnauth);
    return () => window.removeEventListener("tt:unauthorized", onUnauth);
  }, []);

  // One realtime connection per signed-in session.
  useEffect(() => {
    if (!user) { setSocket(null); setNotifUnread(0); setChatUnread(0); return; }
    const s = io(API_URL, { auth: { token: tokenStore.get() }, transports: ["websocket", "polling"] });
    setSocket(s);
    refreshCounts();
    s.on("notification", (n) => { setNotifUnread((c) => c + 1); toast.info(n.title); });
    s.on("message:new", (m) => { if (m.senderRole !== userRef.current?.role) setChatUnread((c) => c + 1); });
    s.on("messages:read", () => refreshCounts());
    return () => { s.close(); };
  }, [user?.id, refreshCounts]);

  const finish = (r) => { tokenStore.set(r.token); setUser(r.user); return r.user; };
  const login = async (email, password) => finish(await api("/auth/login", { method: "POST", body: { email, password } }));
  const register = async (name, email, password) => finish(await api("/auth/register", { method: "POST", body: { name, email, password } }));
  const logout = () => { tokenStore.clear(); setUser(null); };
  const refreshUser = async () => { const r = await api("/auth/me"); setUser(r.user); };

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshUser, setUser, socket, notifUnread, setNotifUnread, chatUnread, setChatUnread, refreshCounts, isAdmin: user?.role === "admin" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading, socket, notifUnread, chatUnread, refreshCounts]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
