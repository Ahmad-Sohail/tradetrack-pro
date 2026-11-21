"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Banknote, CircleDollarSign, Clock, Percent, TrendingDown, TrendingUp, Trophy, UserCheck, Users, Wallet, CandlestickChart, Plus } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Skeleton, Stat } from "@neuctra/ui";
import { useAuth } from "@/app/contexts/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { money, pct, signedMoney } from "@/lib/format";
import { ErrorState, PageHeader, StatsSkeleton } from "./ui-bits";
import { EquityChart, PnlBars, RankBars, WinLossPie } from "./charts";
import TradesTable from "./TradesTable";

const I = (C) => <C className="size-4" aria-hidden="true" />;
const tone = (n) => (n > 0 ? "text-success" : n < 0 ? "text-destructive" : "");

export default function DashboardView({ mode }) {
  const { user } = useAuth();
  const router = useRouter();
  const admin = mode === "admin";
  const a = useFetch("/analytics");
  const t = useFetch("/trades", { limit: 6 });
  if (a.error) return <ErrorState error={a.error} onRetry={a.reload} />;
  const s = a.data?.summary;
  const kpis = !s ? [] : admin ? [
    ["Total clients", s.totalClients, I(Users)], ["Active clients", s.activeClients, I(UserCheck)], ["Total trades", s.totalTrades, I(CandlestickChart)],
    ["Winning trades", s.winningTrades, I(Trophy)], ["Losing trades", s.losingTrades, I(TrendingDown)], ["Open trades", s.openTrades, I(Clock)],
    ["Total profit", <span className="text-success">{money(s.totalProfit)}</span>, I(TrendingUp)], ["Total loss", <span className="text-destructive">{money(s.totalLoss)}</span>, I(TrendingDown)],
    ["Net profit / loss", <span className={tone(s.netPnl)}>{signedMoney(s.netPnl)}</span>, I(CircleDollarSign)], ["Win rate", pct(s.winRate), I(Percent)],
  ] : [
    ["Balance", money(s.balance), I(Wallet)], ["Total invested", money(s.investment), I(Banknote)], ["Net profit / loss", <span className={tone(s.netPnl)}>{signedMoney(s.netPnl)}</span>, I(CircleDollarSign)], ["Win rate", pct(s.winRate), I(Percent)],
    ["Total trades", s.totalTrades, I(CandlestickChart)], ["Winning trades", s.winningTrades, I(Trophy)], ["Losing trades", s.losingTrades, I(TrendingDown)], ["Open trades", s.openTrades, I(Clock)],
  ];
  return (
    <>
      <PageHeader title={admin ? `Welcome back, ${user.name.split(" ")[0]}` : "Your trading performance"}
        description={admin ? "A live view of every client and trade you manage." : "Your balance, results and recent trades, as recorded by your manager."}
        actions={admin ? <Button iconBefore={<Plus className="size-4" />} onClick={() => router.push("/trades/new")}>Add trade</Button> : null} />
      {a.loading && !s ? <StatsSkeleton count={admin ? 10 : 8} /> : (
        <div className={`grid grid-cols-2 gap-4 md:grid-cols-4 ${admin ? "xl:grid-cols-5" : ""}`}>
          {kpis.map(([label, value, icon]) => <Stat key={label} label={label} value={value} icon={icon} bordered />)}
        </div>
      )}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {a.loading && !s ? <><div className="lg:col-span-2"><Skeleton variant="rectangular" height={340} /></div><Skeleton variant="rectangular" height={340} /></> : <>
          <div className="min-w-0 lg:col-span-2"><EquityChart data={a.data.equity} /></div>
          <WinLossPie data={a.data.winLoss} />
          <div className="min-w-0 lg:col-span-2"><PnlBars data={a.data.daily.slice(-30)} xKey="date" title="Daily profit and loss" description="Last 30 closing days" /></div>
          {admin ? <RankBars data={a.data.byClient} nameKey="name" title="Top clients" description="Net P/L by client" /> : <RankBars data={a.data.byAsset} nameKey="symbol" title="Best assets" description="Net P/L by symbol" />}
        </>}
      </div>
      <div className="mt-8">
        <Card>
          <CardHeader title="Recent trades" description="The latest six by opening time" action={<Link href="/trades" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline">View all<ArrowRight className="size-4" /></Link>} />
          {t.loading && !t.data ? <CardBody><Skeleton variant="text" lines={5} /></CardBody>
            : t.error ? <CardBody><ErrorState error={t.error} onRetry={t.reload} /></CardBody>
            : t.data.items.length ? <TradesTable trades={t.data.items} showClient={admin} isAdmin={false} />
            : <CardBody><p className="text-sm text-secondary">No trades recorded yet.</p></CardBody>}
        </Card>
      </div>
    </>
  );
}
