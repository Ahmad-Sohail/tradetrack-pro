"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, MessageSquare, TrendingUp, Trash2, UserPlus } from "lucide-react";
import { Button, Card, CardBody, Chip, IconButton, Skeleton, toast } from "@neuctra/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { ago } from "@/lib/format";
import { Empty, ErrorState, PageHeader } from "./ui-bits";

const icons = { trade_new: TrendingUp, trade_update: TrendingUp, trade_closed: TrendingUp, message: MessageSquare, client_new: UserPlus };
const tabs = [["all", "All"], ["unread", "Unread"], ["trades", "Trades"], ["message", "Messages"]];

export default function NotificationsView() {
  const router = useRouter();
  const { setNotifUnread, socket } = useAuth();
  const [tab, setTab] = useState("all");
  const { data, loading, error, reload } = useFetch("/notifications", { limit: 100 });
  // Live updates: reload when a notification arrives.
  useEffect(() => {
    if (!socket) return;
    socket.on("notification", reload);
    return () => socket.off("notification", reload);
  }, [socket, reload]);

  const items = (data?.items || []).filter((n) => tab === "all" || (tab === "unread" && !n.read) || (tab === "trades" && n.type.startsWith("trade")) || (tab === "message" && n.type === "message"));
  const open = async (n) => {
    if (!n.read) { try { await api(`/notifications/${n.id}/read`, { method: "PATCH" }); setNotifUnread((c) => Math.max(0, c - 1)); reload(); } catch {} }
    if (n.link) router.push(n.link);
  };
  const readAll = async () => { try { await api("/notifications/read-all", { method: "POST" }); setNotifUnread(0); reload(); toast.success("All notifications marked as read"); } catch (e) { toast.error(e.message); } };
  const remove = async (n) => { try { await api(`/notifications/${n.id}`, { method: "DELETE" }); if (!n.read) setNotifUnread((c) => Math.max(0, c - 1)); reload(); } catch (e) { toast.error(e.message); } };

  return (
    <>
      <PageHeader title="Notifications" description="New trades, trade updates, closed trades and messages." actions={<Button variant="outline" iconBefore={<CheckCheck className="size-4" />} disabled={!data?.unread} onClick={readAll}>Mark all as read</Button>} />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter notifications">
        {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k} className="min-h-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Chip label={l} variant={tab === k ? "solid" : "outline"} color={tab === k ? "primary" : "neutral"} /></button>)}
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <Skeleton variant="rectangular" height={300} /> : !items.length ? (
        <Card><CardBody><Empty icon={<Bell className="size-6" />} title={tab === "all" ? "You are all caught up" : "Nothing here"} description="New trade activity and messages will show up here as they happen." /></CardBody></Card>
      ) : (
        <Card><ul>
          {items.map((n) => { const Icon = icons[n.type] || Bell; return (
            <li key={n.id} className="flex items-center gap-2 border-b border-border last:border-0">
              <button type="button" onClick={() => open(n)} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${n.read ? "text-secondary" : "font-medium text-foreground"}`}>{n.title}{!n.read && <span className="sr-only"> (unread)</span>}</span>
                  {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{ago(n.createdAt)}</span>
                {!n.read && <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
              </button>
              <div className="pr-2"><IconButton icon={<Trash2 className="size-4" />} variant="ghost" size="sm" aria-label="Delete notification" onClick={() => remove(n)} /></div>
            </li>); })}
        </ul></Card>
      )}
    </>
  );
}
