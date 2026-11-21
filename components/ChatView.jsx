"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, FileText, Paperclip, Send, X } from "lucide-react";
import { Avatar, Badge, Button, Card, IconButton, Skeleton, Textarea, toast } from "@neuctra/ui";
import { api, upload } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { ago, initials } from "@/lib/format";
import { Empty, ErrorState, PageHeader } from "./ui-bits";
import { MessageSquare } from "lucide-react";

const time = (v) => new Date(v).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const day = (v) => new Date(v).toLocaleDateString("en-US", { dateStyle: "medium" });

function Bubble({ m, mine }) {
  const img = m.attachment?.type?.startsWith("image/");
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 sm:max-w-[70%] ${mine ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"}`}>
        {m.attachment && (
          <a href={m.attachment.url} target="_blank" rel="noopener noreferrer" className="mb-1 block underline">
            {img ? <img src={m.attachment.url} alt={m.attachment.name} className="max-h-48 rounded-md object-cover" /> : <span className="flex items-center gap-2 text-sm"><FileText className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{m.attachment.name}</span></span>}
          </a>
        )}
        {m.body && <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>}
        <p className={`mt-1 flex items-center justify-end gap-1 text-xs ${mine ? "text-primary-foreground" : "text-muted-foreground"}`}>
          {time(m.createdAt)}
          {mine && (m.readAt ? <><CheckCheck className="size-3" aria-hidden="true" /><span>Read</span></> : <><Check className="size-3" aria-hidden="true" /><span>Sent</span></>)}
        </p>
      </div>
    </div>
  );
}

export default function ChatView() {
  const { user, isAdmin, socket, refreshCounts } = useAuth();
  const params = useSearchParams();
  const [convs, setConvs] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(isAdmin ? params.get("client") : user.clientId);
  const [msgs, setMsgs] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadsOn, setUploadsOn] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const bottom = useRef(null);
  const fileRef = useRef(null);
  const activeRef = useRef(active); activeRef.current = active;
  const lastTyping = useRef(0);

  const loadConvs = useCallback(async () => {
    try { const r = await api("/messages/conversations"); setConvs(r.items); setError(null); } catch (e) { setError(e); }
  }, []);
  useEffect(() => { loadConvs(); }, [loadConvs]);
  useEffect(() => { api("/messages/config").then((r) => setUploadsOn(r.uploadsEnabled)).catch(() => {}); }, []);

  const openConv = useCallback(async (id) => {
    setLoadingMsgs(true);
    try { const r = await api(`/messages/${id}`); setMsgs(r.items); loadConvs(); refreshCounts(); }
    catch (e) { toast.error(e.message); }
    finally { setLoadingMsgs(false); }
  }, [loadConvs, refreshCounts]);
  useEffect(() => { if (active) openConv(active); else setMsgs([]); }, [active, openConv]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (m) => {
      if (m.clientId === activeRef.current) {
        setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        if (m.senderRole !== user.role) api(`/messages/${m.clientId}`).then(() => { loadConvs(); refreshCounts(); }).catch(() => {});
        else loadConvs();
      } else loadConvs();
    };
    const onRead = (p) => { if (p.clientId === activeRef.current && p.by !== user.role) setMsgs((cur) => cur.map((m) => (m.senderRole === user.role && !m.readAt ? { ...m, readAt: p.readAt } : m))); };
    let t;
    const onTyping = (p) => { if (p.clientId === activeRef.current && p.role !== user.role) { setTyping(true); clearTimeout(t); t = setTimeout(() => setTyping(false), 2500); } };
    socket.on("message:new", onNew); socket.on("messages:read", onRead); socket.on("typing", onTyping);
    return () => { socket.off("message:new", onNew); socket.off("messages:read", onRead); socket.off("typing", onTyping); clearTimeout(t); };
  }, [socket, user.role, loadConvs, refreshCounts]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, typing]);

  const send = async () => {
    if ((!text.trim() && !pending) || !active || sending) return;
    setSending(true);
    try {
      const r = await api(`/messages/${active}`, { method: "POST", body: { body: text.trim(), attachment: pending || undefined } });
      setMsgs((cur) => (cur.some((x) => x.id === r.message.id) ? cur : [...cur, r.message]));
      setText(""); setPending(null); loadConvs();
    } catch (e) { toast.error(e.message); }
    finally { setSending(false); }
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setUploading(true);
    try { const r = await upload("/messages/upload", f); setPending(r.attachment); }
    catch (err) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const onType = (e) => {
    setText(e.target.value);
    if (socket && Date.now() - lastTyping.current > 1500) { lastTyping.current = Date.now(); socket.emit("typing", { clientId: active }); }
  };

  const current = convs?.find((c) => c.clientId === active);
  const showList = isAdmin;
  return (
    <>
      <PageHeader title={isAdmin ? "Client chat" : "Message your manager"} description="Private, real-time messages. Only you and the other party can see this conversation." />
      {error ? <ErrorState error={error} onRetry={loadConvs} /> : !convs ? <Skeleton variant="rectangular" height={520} /> : (
        <Card className="overflow-hidden">
          <div className={`grid h-[calc(100vh-14rem)] min-h-[28rem] ${showList ? "lg:grid-cols-[20rem_1fr]" : ""}`}>
            {showList && (
              <div className={`min-h-0 flex-col overflow-y-auto border-border lg:flex lg:border-r ${active ? "hidden" : "flex"}`}>
                {convs.length === 0 ? <div className="p-4"><Empty icon={<MessageSquare className="size-6" />} title="No clients yet" description="Add a client to start a conversation." /></div> : convs.map((c) => (
                  <button key={c.clientId} type="button" onClick={() => setActive(c.clientId)} aria-current={c.clientId === active}
                    className={`flex min-h-16 items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${c.clientId === active ? "bg-accent" : ""}`}>
                    <Avatar fallback={initials(c.name)} size="sm" alt={c.name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-foreground">{c.name}</span>{c.lastMessage && <span className="shrink-0 text-xs text-muted-foreground">{ago(c.lastMessage.createdAt)}</span>}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.lastMessage ? (c.lastMessage.body || "Attachment") : "No messages yet"}</span>
                    </span>
                    {c.unread > 0 && <Badge text={String(c.unread)} variant="solid" size="sm" rounded />}
                  </button>
                ))}
              </div>
            )}
            <div className={`min-h-0 flex-col ${showList && !active ? "hidden lg:flex" : "flex"}`}>
              {!active ? <div className="flex flex-1 items-center justify-center p-6"><Empty icon={<MessageSquare className="size-6" />} title="Select a conversation" description="Choose a client on the left to read and send messages." /></div> : (<>
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  {showList && <div className="lg:hidden"><IconButton icon={<ArrowLeft className="size-5" />} variant="ghost" aria-label="Back to conversations" onClick={() => setActive(null)} /></div>}
                  <Avatar fallback={initials(isAdmin ? current?.name : "Manager")} size="sm" alt="" />
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{isAdmin ? current?.name : "Your manager"}</p><p className="text-xs text-muted-foreground" aria-live="polite">{typing ? "Typing..." : "Messages are delivered instantly"}</p></div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4" role="log" aria-label="Messages">
                  {loadingMsgs && !msgs.length ? <Skeleton variant="text" lines={4} /> : msgs.length === 0 ? <div className="m-auto"><Empty title="No messages yet" description="Say hello to start the conversation." /></div> :
                    msgs.map((m, i) => (<div key={m.id} className="flex flex-col gap-3">
                      {(i === 0 || day(msgs[i - 1].createdAt) !== day(m.createdAt)) && <p className="text-center text-xs text-muted-foreground">{day(m.createdAt)}</p>}
                      <Bubble m={m} mine={m.senderRole === user.role} />
                    </div>))}
                  <div ref={bottom} />
                </div>
                <div className="border-t border-border p-3">
                  {pending && <div className="mb-2 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-secondary"><FileText className="size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{pending.name}</span><IconButton icon={<X className="size-4" />} size="xs" variant="ghost" aria-label="Remove attachment" onClick={() => setPending(null)} /></div>}
                  <div className="flex items-end gap-2">
                    <input ref={fileRef} type="file" className="sr-only" tabIndex={-1} accept="image/*,.pdf,.txt,.csv" onChange={onFile} aria-label="Attach a file" />
                    <IconButton icon={<Paperclip className="size-5" />} variant="ghost" aria-label={uploadsOn ? "Attach a file" : "Attachments are not configured"} disabled={uploading || !uploadsOn} onClick={() => fileRef.current?.click()} />
                    <div className="min-w-0 flex-1"><Textarea placeholder="Write a message" aria-label="Message" minRows={1} maxRows={4} maxLength={4000} value={text} onChange={onType} submitOnEnter onSubmit={send} /></div>
                    <Button iconBefore={<Send className="size-4" />} loading={sending} onClick={send} disabled={!text.trim() && !pending}>Send</Button>
                  </div>
                </div>
              </>)}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
