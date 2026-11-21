"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { Avatar, Button, Card, CardBody, CardHeader, Skeleton, Stat, Tab, TabList, TabPanel, TabPanels, Tabs, toast } from "@neuctra/ui";
import { api } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { dateOnly, initials, money, pct, signedMoney } from "@/lib/format";
import { ErrorState, PageHeader, StatsSkeleton, StatusChip } from "./ui-bits";
import { EquityChart, PnlBars, RankBars, WinLossPie } from "./charts";
import TradesView from "./TradesView";
import ConnectionsPanel from "./ConnectionsPanel";
import ClientFormModal from "./ClientFormModal";
import ConfirmModal from "./ConfirmModal";

const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
    <dt className="text-sm text-muted-foreground">{label}</dt><dd className="min-w-0 break-words text-right text-sm text-foreground">{children || "n/a"}</dd>
  </div>
);

export default function ClientProfileView({ id }) {
  const router = useRouter();
  const c = useFetch(`/clients/${id}`);
  const a = useFetch("/analytics", { clientId: id });
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const back = <Link href="/clients" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-secondary hover:text-foreground"><ArrowLeft className="size-4" />Back to clients</Link>;
  if (c.error) return <>{back}<ErrorState error={c.error} onRetry={c.error.status === 404 ? undefined : c.reload} /></>;
  if (c.loading && !c.data) return <>{back}<Skeleton variant="rectangular" height={420} /></>;
  const cl = c.data.client; const s = a.data?.summary;
  const remove = async () => { await api(`/clients/${cl.id}`, { method: "DELETE" }); toast.success("Client deleted"); router.replace("/clients"); };
  const kpis = s ? [["Balance", money(s.balance)], ["Invested", money(s.investment)], ["Net profit / loss", <span className={s.netPnl > 0 ? "text-success" : s.netPnl < 0 ? "text-destructive" : ""}>{signedMoney(s.netPnl)}</span>], ["Win rate", pct(s.winRate)], ["Trades", s.totalTrades], ["Open trades", s.openTrades]] : [];
  return (
    <>
      {back}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar fallback={initials(cl.name)} size="xl" alt={cl.name} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{cl.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-secondary"><StatusChip status={cl.status} /><span className="truncate">{cl.email}</span></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" iconBefore={<MessageSquare className="size-4" />} onClick={() => router.push(`/chat?client=${cl.id}`)}>Message</Button>
          <Button variant="outline" iconBefore={<Plus className="size-4" />} onClick={() => router.push(`/trades/new?client=${cl.id}`)}>Add trade</Button>
          <Button variant="outline" iconBefore={<Pencil className="size-4" />} onClick={() => setEdit(true)}>Edit</Button>
          <Button variant="destructive" iconBefore={<Trash2 className="size-4" />} onClick={() => setDel(true)}>Delete</Button>
        </div>
      </div>
      <Tabs variant="underline" mobileVariant="scroll">
        <TabList><Tab>Performance</Tab><Tab>Trade history</Tab><Tab>Connected accounts</Tab><Tab>Profile</Tab></TabList>
        <TabPanels>
          <TabPanel>
            <div className="pt-6">
              {a.error ? <ErrorState error={a.error} onRetry={a.reload} /> : !s ? <StatsSkeleton count={6} /> : (<>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{kpis.map(([l, v]) => <Stat key={l} label={l} value={v} bordered />)}</div>
                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="min-w-0 lg:col-span-2"><EquityChart data={a.data.equity} /></div>
                  <WinLossPie data={a.data.winLoss} />
                  <div className="min-w-0 lg:col-span-2"><PnlBars data={a.data.monthly} xKey="month" title="Monthly profit and loss" description="Net result by closing month" /></div>
                  <RankBars data={a.data.byAsset} nameKey="symbol" title="By asset" description="Net P/L by symbol" />
                </div></>)}
            </div>
          </TabPanel>
          <TabPanel><div className="pt-6"><TradesView fixedClientId={cl.id} embedded /></div></TabPanel>
          <TabPanel><div className="pt-6"><ConnectionsPanel clientId={cl.id} /></div></TabPanel>
          <TabPanel>
            <div className="grid grid-cols-1 gap-6 pt-6 lg:grid-cols-2">
              <Card><CardHeader title="Contact" /><CardBody><dl><Row label="Email">{cl.email}</Row><Row label="Phone">{cl.phone}</Row><Row label="Country">{cl.country}</Row><Row label="Client since">{dateOnly(cl.createdAt)}</Row></dl></CardBody></Card>
              <Card><CardHeader title="Account" /><CardBody><dl><Row label="Starting balance">{money(cl.initialBalance)}</Row><Row label="Current balance">{money(cl.stats.balance)}</Row><Row label="Status"><StatusChip status={cl.status} /></Row></dl>
                <p className="mt-4 max-w-prose whitespace-pre-wrap text-sm text-secondary">{cl.notes || "No internal notes."}</p></CardBody></Card>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
      <ClientFormModal open={edit} client={cl} onClose={() => setEdit(false)} onSaved={() => { c.reload(); a.reload(); }} />
      <ConfirmModal open={del} onClose={() => setDel(false)} title="Delete client" confirmLabel="Delete client" message={`This permanently deletes ${cl.name}, their portal login, trades and messages. This cannot be undone.`} onConfirm={remove} />
    </>
  );
}
