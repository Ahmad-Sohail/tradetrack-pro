"use client";
import { useState } from "react";
import { PageHeader, ErrorState, StatsSkeleton } from "./ui-bits";
import AnalyticsFilters, { emptyRange } from "./AnalyticsFilters";
import { useFetch } from "@/hooks/useFetch";
import { toIsoDay } from "@/lib/format";
import { EquityChart, PnlBars, RankBars, WinLossPie, WinRateBars } from "./charts";
import { Skeleton } from "@neuctra/ui";
import { useAuth } from "@/app/contexts/AuthContext";

function useAnalytics() {
  const [f, setF] = useState(emptyRange);
  const res = useFetch("/analytics", { clientId: f.clientId, from: toIsoDay(f.from), to: toIsoDay(f.to) });
  return { f, setF, ...res };
}

function Loading() { return <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={340} />)}</div>; }

export function PnlAnalyticsView() {
  const { f, setF, data, loading, error, reload } = useAnalytics();
  const { isAdmin } = useAuth();
  return (
    <>
      <PageHeader title="Profit and loss analytics" description="Daily and monthly results, plus performance by asset. Figures use closed trades only and are net of fees." />
      <AnalyticsFilters value={f} onChange={setF} />
      {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PnlBars data={data.daily} xKey="date" title="Daily profit and loss" description="Net result by closing day" />
          <PnlBars data={data.monthly} xKey="month" title="Monthly profit and loss" description="Net result by closing month" />
          <RankBars data={data.byAsset} nameKey="symbol" title="Asset-wise performance" description="Net P/L by symbol" />
          <WinRateBars data={data.byAsset} nameKey="symbol" title="Win rate by asset" description="Share of closed trades that made money" />
          {isAdmin && f.clientId === "all" && <div className="lg:col-span-2"><RankBars data={data.byClient} nameKey="name" title="Client-wise comparison" description="Net P/L by client" /></div>}
        </div>
      )}
    </>
  );
}

export function ChartsView() {
  const { f, setF, data, loading, error, reload } = useAnalytics();
  const { isAdmin } = useAuth();
  return (
    <>
      <PageHeader title="Charts and graphs" description="Equity growth, outcome ratio and comparisons across the filters you choose." />
      <AnalyticsFilters value={f} onChange={setF} />
      {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2"><EquityChart data={data.equity} /></div>
          <WinLossPie data={data.winLoss} />
          <div className="lg:col-span-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PnlBars data={data.daily} xKey="date" title="Daily profit and loss" description="Net result by closing day" />
            {isAdmin && f.clientId === "all"
              ? <RankBars data={data.byClient} nameKey="name" title="Client comparison" description="Net P/L by client" />
              : <RankBars data={data.byAsset} nameKey="symbol" title="Asset comparison" description="Net P/L by symbol" />}
          </div>
        </div>
      )}
    </>
  );
}
