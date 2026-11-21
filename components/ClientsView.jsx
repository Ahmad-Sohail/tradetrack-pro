"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, MessageSquare, MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { Avatar, Button, Card, CardBody, Dropdown, IconButton, Input, Pagination, Select, Skeleton, Table, TBody, TD, TH, THead, TRow, toast } from "@neuctra/ui";
import { api } from "@/lib/api";
import { useFetch, useDebounce } from "@/hooks/useFetch";
import { initials, money, pct } from "@/lib/format";
import { Empty, ErrorState, PageHeader, Pnl, StatusChip } from "./ui-bits";
import ClientFormModal from "./ClientFormModal";
import ConfirmModal from "./ConfirmModal";

export default function ClientsView() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ open: false, client: null });
  const [del, setDel] = useState(null);
  const dq = useDebounce(q);
  const { data, loading, error, reload } = useFetch("/clients", { q: dq, status, page, limit: 10 });
  const remove = async () => { await api(`/clients/${del.id}`, { method: "DELETE" }); toast.success(`Deleted ${del.name}`); reload(); };
  const menu = (c) => [
    { label: "View profile", icon: <Eye className="size-4" />, onClick: () => router.push(`/clients/${c.id}`) },
    { label: "Edit client", icon: <Pencil className="size-4" />, onClick: () => setForm({ open: true, client: c }) },
    { label: "Message", icon: <MessageSquare className="size-4" />, onClick: () => router.push(`/chat?client=${c.id}`) },
    { separator: true },
    { label: "Delete client", icon: <Trash2 className="size-4" />, danger: true, onClick: () => setDel(c) },
  ];
  return (
    <>
      <PageHeader title="Clients" description="Everyone you manage, with balance and performance at a glance." actions={<Button iconBefore={<Plus className="size-4" />} onClick={() => setForm({ open: true, client: null })}>Add client</Button>} />
      <Card><CardBody>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
          <Input label="Search" type="search" placeholder="Name, email or country" prefixIcon={Search} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <Select label="Status" value={status} onValueChange={(v) => { setStatus(v); setPage(1); }} options={[{ label: "All clients", value: "all" }, { label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }]} />
        </div>
      </CardBody></Card>
      <div className="mt-6">
        {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <Skeleton variant="rectangular" height={360} />
          : !data.items.length ? (
            <Card><CardBody><Empty icon={<Users className="size-6" />} title={dq || status !== "all" ? "No clients match your search" : "No clients yet"}
              description={dq || status !== "all" ? "Try a different name or clear the status filter." : "Add your first client to give them a portal and start recording trades."}
              action={<Button onClick={() => setForm({ open: true, client: null })}>Add client</Button>} /></CardBody></Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table hoverable>
                  <THead><TRow><TH>Client</TH><TH>Status</TH><TH>Balance</TH><TH>Profit / loss</TH><TH>Win rate</TH><TH>Trades</TH><TH><span className="sr-only">Actions</span></TH></TRow></THead>
                  <TBody>
                    {data.items.map((c) => (
                      <TRow key={c.id} onClick={() => router.push(`/clients/${c.id}`)}>
                        <TD><div className="flex items-center gap-3"><Avatar fallback={initials(c.name)} size="sm" alt={c.name} /><div className="min-w-0"><p className="truncate font-medium text-foreground">{c.name}</p><p className="truncate text-xs text-muted-foreground">{c.email}</p></div></div></TD>
                        <TD><StatusChip status={c.status} /></TD>
                        <TD><span className="tabular-nums">{money(c.stats.balance)}</span></TD>
                        <TD><Pnl value={c.stats.pnl} /></TD>
                        <TD><span className="tabular-nums">{pct(c.stats.winRate)}</span></TD>
                        <TD><span className="tabular-nums">{c.stats.trades}</span></TD>
                        <TD><Dropdown items={menu(c)} width={190} trigger={<IconButton icon={<MoreHorizontal className="size-4" />} variant="ghost" size="sm" aria-label={`Actions for ${c.name}`} />} /></TD>
                      </TRow>
                    ))}
                  </TBody>
                </Table>
              </div>
              <div className="flex flex-col items-center justify-between gap-3 border-t border-border p-4 sm:flex-row">
                <p className="text-xs text-muted-foreground">{data.total} client{data.total === 1 ? "" : "s"}</p>
                {data.pages > 1 && <Pagination page={data.page} totalPages={data.pages} onPageChange={setPage} />}
              </div>
            </Card>
          )}
      </div>
      <ClientFormModal open={form.open} client={form.client} onClose={() => setForm({ open: false, client: null })} onSaved={reload} />
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Delete client" confirmLabel="Delete client"
        message={del ? `This permanently deletes ${del.name}, their portal login, all of their trades and their messages. This cannot be undone.` : ""} onConfirm={remove} />
    </>
  );
}
