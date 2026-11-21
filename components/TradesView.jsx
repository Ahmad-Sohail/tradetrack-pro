"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CandlestickChart, FileDown, Plus, RotateCcw, Search } from "lucide-react";
import { Button, Card, CardBody, DatePicker, Input, Pagination, Select, Skeleton, toast } from "@neuctra/ui";
import { api } from "@/lib/api";
import { useFetch, useDebounce } from "@/hooks/useFetch";
import { useAuth } from "@/app/contexts/AuthContext";
import { toIsoDay } from "@/lib/format";
import { Empty, ErrorState, PageHeader } from "./ui-bits";
import TradesTable from "./TradesTable";
import ConfirmModal from "./ConfirmModal";

const ALL = (label) => ({ label, value: "all" });
const sorts = [
  { label: "Newest first", value: "openedAt:desc" }, { label: "Oldest first", value: "openedAt:asc" },
  { label: "Highest profit", value: "profitLoss:desc" }, { label: "Biggest loss", value: "profitLoss:asc" },
];
const init = { q: "", status: "all", marketType: "all", direction: "all", clientId: "all", from: null, to: null, sort: "openedAt:desc", page: 1 };

export default function TradesView({ fixedClientId, embedded }) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [f, setF] = useState(init);
  const [del, setDel] = useState(null);
  const q = useDebounce(f.q);
  const set = (patch) => setF((s) => ({ ...s, ...patch, page: patch.page || 1 }));
  const [sort, order] = f.sort.split(":");
  const { data, loading, error, reload } = useFetch("/trades", { q, status: f.status, marketType: f.marketType, direction: f.direction, clientId: fixedClientId || f.clientId, from: toIsoDay(f.from), to: toIsoDay(f.to), sort, order, page: f.page, limit: 10 });
  const { data: cl } = useFetch("/clients/options", undefined, { enabled: isAdmin && !fixedClientId });
  const filtered = q || f.status !== "all" || f.marketType !== "all" || f.direction !== "all" || f.clientId !== "all" || f.from || f.to;

  const remove = async () => { await api(`/trades/${del.id}`, { method: "DELETE" }); toast.success(`Deleted ${del.tradeId}`); reload(); };

  return (
    <>
      {!embedded && <PageHeader title={isAdmin ? "Trade history" : "My trades"} description={isAdmin ? "Search, filter and manage every recorded trade across your clients." : "Every trade your manager has recorded for you."}
        actions={<>
          <Button variant="outline" iconBefore={<FileDown className="size-4" />} onClick={() => router.push("/reports")}>Export</Button>
          {isAdmin && <Button iconBefore={<Plus className="size-4" />} onClick={() => router.push("/trades/new")}>Add trade</Button>}
        </>} />}
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Search" type="search" placeholder="Symbol, trade ID or strategy" value={f.q} onChange={(e) => set({ q: e.target.value })} prefixIcon={Search} />
            <Select label="Status" value={f.status} onValueChange={(v) => set({ status: v })} options={[ALL("All statuses"), { label: "Open", value: "open" }, { label: "Closed", value: "closed" }, { label: "Cancelled", value: "cancelled" }]} />
            <Select label="Market" value={f.marketType} onValueChange={(v) => set({ marketType: v })} options={[ALL("All markets"), ...["forex", "crypto", "stocks", "commodities", "indices"].map((m) => ({ label: m[0].toUpperCase() + m.slice(1), value: m }))]} />
            <Select label="Direction" value={f.direction} onValueChange={(v) => set({ direction: v })} options={[ALL("Buy and sell"), { label: "Buy", value: "buy" }, { label: "Sell", value: "sell" }]} />
            {isAdmin && !fixedClientId && <Select label="Client" searchable value={f.clientId} onValueChange={(v) => set({ clientId: v })} options={[ALL("All clients"), ...(cl?.items || []).map((c) => ({ label: c.name, value: c.id }))]} />}
            <DatePicker label="Opened from" value={f.from} onChange={(d) => set({ from: d })} clearable placeholder="Start date" />
            <DatePicker label="Opened to" value={f.to} onChange={(d) => set({ to: d })} clearable placeholder="End date" />
            <Select label="Sort by" value={f.sort} onValueChange={(v) => set({ sort: v })} options={sorts} />
          </div>
          {filtered && <div className="mt-4"><Button size="sm" variant="ghost" iconBefore={<RotateCcw className="size-4" />} onClick={() => setF(init)}>Clear filters</Button></div>}
        </CardBody>
      </Card>

      <div className="mt-6">
        {error ? <ErrorState error={error} onRetry={reload} />
          : loading && !data ? <Skeleton variant="rectangular" height={360} />
          : !data.items.length ? (
            <Card><CardBody>
              <Empty icon={<CandlestickChart className="size-6" />} title={filtered ? "No trades match these filters" : "No trades recorded yet"}
                description={filtered ? "Try widening the date range or clearing a filter." : isAdmin ? "Record your first trade to start tracking performance." : "Your manager has not recorded any trades for you yet."}
                action={filtered ? <Button variant="outline" onClick={() => setF(init)}>Clear filters</Button> : isAdmin ? <Button onClick={() => router.push("/trades/new")}>Add trade</Button> : null} />
            </CardBody></Card>
          ) : (
            <Card>
              <TradesTable trades={data.items} showClient={isAdmin && !fixedClientId} isAdmin={isAdmin} onDelete={setDel} />
              <div className="flex flex-col items-center justify-between gap-3 border-t border-border p-4 sm:flex-row">
                <p className="text-xs text-muted-foreground">{data.total} trade{data.total === 1 ? "" : "s"}</p>
                {data.pages > 1 && <Pagination page={data.page} totalPages={data.pages} onPageChange={(p) => setF((s) => ({ ...s, page: p }))} />}
              </div>
            </Card>
          )}
      </div>
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Delete trade" confirmLabel="Delete trade"
        message={del ? `This permanently deletes ${del.tradeId} (${del.symbol}) and removes it from all statistics. This cannot be undone.` : ""} onConfirm={remove} />
    </>
  );
}
