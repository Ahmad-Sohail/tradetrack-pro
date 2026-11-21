"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Skeleton, toast } from "@neuctra/ui";
import { api } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useAuth } from "@/app/contexts/AuthContext";
import { dt, duration, money, num } from "@/lib/format";
import { ErrorState, PageHeader, Pnl, StatusChip } from "./ui-bits";
import ConfirmModal from "./ConfirmModal";

const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-right text-sm text-foreground">{children}</dd>
  </div>
);

export default function TradeDetailView({ id }) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { data, loading, error, reload } = useFetch(`/trades/${id}`);
  const [del, setDel] = useState(false);
  if (error) return <><Link href="/trades" className="mb-6 inline-flex items-center gap-2 text-sm text-secondary hover:text-foreground"><ArrowLeft className="size-4" />Back to trades</Link><ErrorState error={error} onRetry={error.status === 404 ? undefined : reload} /></>;
  if (loading && !data) return <Skeleton variant="rectangular" height={420} />;
  const t = data.trade;
  const remove = async () => { await api(`/trades/${t.id}`, { method: "DELETE" }); toast.success("Trade deleted"); router.replace("/trades"); };
  return (
    <>
      <Link href="/trades" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-secondary hover:text-foreground"><ArrowLeft className="size-4" />Back to trades</Link>
      <PageHeader title={`${t.symbol} ${t.direction === "buy" ? "buy" : "sell"}`} description={`${t.tradeId} · ${t.marketType}${t.strategy ? ` · ${t.strategy}` : ""}`}
        actions={isAdmin ? <><Button variant="outline" iconBefore={<Pencil className="size-4" />} onClick={() => router.push(`/trades/${t.id}/edit`)}>Edit</Button><Button variant="destructive" iconBefore={<Trash2 className="size-4" />} onClick={() => setDel(true)}>Delete</Button></> : null} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card><CardHeader title="Result" /><CardBody>
          <p className="text-xl font-semibold sm:text-2xl"><Pnl value={t.profitLoss} closed={t.status === "closed"} /></p>
          <div className="mt-3 flex gap-2"><StatusChip status={t.status} /><StatusChip status={t.direction} /></div>
          <dl className="mt-4"><Row label="Fees">{money(t.fees)}</Row><Row label="Duration">{duration(t.durationMs)}</Row></dl>
        </CardBody></Card>
        <Card><CardHeader title="Pricing" /><CardBody><dl>
          <Row label="Entry price">{num(t.entryPrice)}</Row><Row label="Exit price">{num(t.exitPrice)}</Row><Row label="Stop loss">{num(t.stopLoss)}</Row><Row label="Take profit">{num(t.takeProfit)}</Row>
          <Row label="Position size">{num(t.positionSize, 2)}</Row><Row label="Investment">{money(t.investmentAmount)}</Row>
        </dl></CardBody></Card>
        <Card><CardHeader title="Timeline" /><CardBody><dl>
          {isAdmin && <Row label="Client"><Link className="text-primary hover:underline" href={`/clients/${t.clientId}`}>{t.client?.name}</Link></Row>}
          <Row label="Opened">{dt(t.openedAt)}</Row><Row label="Closed">{dt(t.closedAt)}</Row><Row label="Recorded">{dt(t.createdAt)}</Row><Row label="Source">{t.source === "sync" ? "Synced from exchange" : t.source === "csv" ? "Imported from CSV" : "Entered manually"}</Row>
        </dl></CardBody></Card>
        <div className="lg:col-span-3"><Card><CardHeader title="Notes" /><CardBody><p className="max-w-prose whitespace-pre-wrap text-sm text-secondary">{t.notes || "No notes were added to this trade."}</p></CardBody></Card></div>
      </div>
      <ConfirmModal open={del} onClose={() => setDel(false)} title="Delete trade" confirmLabel="Delete trade" message={`This permanently deletes ${t.tradeId} and removes it from all statistics.`} onConfirm={remove} />
    </>
  );
}
