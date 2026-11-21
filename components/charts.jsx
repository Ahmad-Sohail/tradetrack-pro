"use client";
import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody, CardHeader } from "@neuctra/ui";
import { useTheme } from "@/app/contexts/ThemeContext";
import { money } from "@/lib/format";
import { Empty } from "./ui-bits";
import { BarChart3 } from "lucide-react";

const VARS = ["primary", "success", "destructive", "info", "border", "muted-foreground", "foreground", "popover"];
export function useChartColors() {
  const { isDark } = useTheme();
  const [c, setC] = useState({});
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    setC(Object.fromEntries(VARS.map((v) => [v, cs.getPropertyValue(`--${v}`).trim()])));
  }, [isDark]);
  return c;
}

const tip = (c) => ({
  contentStyle: { background: c.popover, border: `1px solid ${c.border}`, borderRadius: 8, color: c.foreground, fontSize: 12 },
  labelStyle: { color: c["muted-foreground"] },
  itemStyle: { color: c.foreground },
  cursor: { fill: c.border, opacity: 0.3 },
});
const axis = (c) => ({ tick: { fill: c["muted-foreground"], fontSize: 12 }, stroke: c.border, tickLine: false });
const short = (s) => (s && s.length > 7 ? s.slice(5) : s);

export function ChartCard({ title, description, children, empty }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody>
        {empty ? <Empty icon={<BarChart3 className="size-6" />} title="No data yet" description="Closed trades will appear here once they are recorded." /> : <div className="h-72 w-full min-w-0">{children}</div>}
      </CardBody>
    </Card>
  );
}

export function EquityChart({ data }) {
  const c = useChartColors();
  return (
    <ChartCard title="Equity curve" description="Account balance after each closing day" empty={!data?.length}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c.primary} stopOpacity={0.3} /><stop offset="100%" stopColor={c.primary} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke={c.border} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} {...axis(c)} minTickGap={24} />
          <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={44} {...axis(c)} domain={["auto", "auto"]} />
          <Tooltip {...tip(c)} formatter={(v) => [money(v), "Equity"]} />
          <Area type="monotone" dataKey="equity" stroke={c.primary} strokeWidth={2} fill="url(#eq)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function PnlBars({ data, xKey, title, description }) {
  const c = useChartColors();
  return (
    <ChartCard title={title} description={description} empty={!data?.length}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid stroke={c.border} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={xKey === "date" ? short : undefined} {...axis(c)} minTickGap={16} />
          <YAxis width={52} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} {...axis(c)} />
          <Tooltip {...tip(c)} formatter={(v) => [money(v), "Profit / loss"]} />
          <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>{(data || []).map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? c.success : c.destructive} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function WinLossPie({ data }) {
  const c = useChartColors();
  const fills = [c.success, c.destructive, c.info];
  const total = (data || []).reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard title="Win and loss ratio" description="Share of trades by outcome" empty={!total}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke={c.border}>
            {(data || []).map((_, i) => <Cell key={i} fill={fills[i]} />)}
          </Pie>
          <Tooltip {...tip(c)} />
          <Legend wrapperStyle={{ color: c["muted-foreground"], fontSize: 12 }} formatter={(v, e) => `${v} (${e.payload.value})`} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function RankBars({ data, nameKey, title, description }) {
  const c = useChartColors();
  const rows = (data || []).slice(0, 8);
  return (
    <ChartCard title={title} description={description} empty={!rows.length}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
          <CartesianGrid stroke={c.border} strokeDasharray="4 4" horizontal={false} />
          <XAxis type="number" {...axis(c)} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
          <YAxis type="category" dataKey={nameKey} width={96} {...axis(c)} tickFormatter={(v) => (String(v).length > 14 ? `${String(v).slice(0, 13)}…` : v)} />
          <Tooltip {...tip(c)} formatter={(v) => [money(v), "Net P/L"]} />
          <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>{rows.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? c.success : c.destructive} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function WinRateBars({ data, nameKey, title, description }) {
  const c = useChartColors();
  const rows = (data || []).slice(0, 8);
  return (
    <ChartCard title={title} description={description} empty={!rows.length}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid stroke={c.border} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey={nameKey} {...axis(c)} tickFormatter={(v) => (String(v).length > 9 ? `${String(v).slice(0, 8)}…` : v)} />
          <YAxis domain={[0, 100]} width={40} tickFormatter={(v) => `${v}%`} {...axis(c)} />
          <Tooltip {...tip(c)} formatter={(v) => [`${v}%`, "Win rate"]} />
          <Bar dataKey="winRate" fill={c.info} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
