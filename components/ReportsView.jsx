"use client";
import { useState } from "react";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Select, Skeleton, Stat, toast } from "@neuctra/ui";
import { api, download } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { dt, money, num, pct, signedMoney, toIsoDay } from "@/lib/format";
import { DatePicker } from "@neuctra/ui";
import { PageHeader } from "./ui-bits";

async function buildPdf(query) {
  const [{ jsPDF }, { default: autoTable }, data] = await Promise.all([import("jspdf"), import("jspdf-autotable"), api("/reports/trades.json", { query })]);
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16); doc.text("TradeTrack Pro: trade report", 14, 16);
  doc.setFontSize(9); doc.setTextColor(100);
  doc.text(`Generated ${new Date(data.generatedAt).toLocaleString("en-US")}`, 14, 22);
  const s = data.summary;
  doc.text(`Trades ${s.totalTrades}  |  Wins ${s.winningTrades}  |  Losses ${s.losingTrades}  |  Open ${s.openTrades}  |  Win rate ${s.winRate}%  |  Net P/L ${s.netPnl}  |  Fees ${s.fees}`, 14, 28);
  autoTable(doc, {
    startY: 33, styles: { fontSize: 8 }, headStyles: { fillColor: [15, 23, 42] },
    head: [["Trade", "Client", "Symbol", "Side", "Entry", "Exit", "P/L", "Fees", "Status", "Opened"]],
    body: data.items.map((t) => [t.tradeId, t.clientName, t.symbol, t.direction, t.entryPrice, t.exitPrice ?? "", t.status === "closed" ? t.profitLoss : "", t.fees, t.status, new Date(t.openedAt).toLocaleString("en-US")]),
  });
  doc.save("tradetrack-report.pdf");
}

export default function ReportsView() {
  const { isAdmin } = useAuth();
  const [f, setF] = useState({ clientId: "all", status: "all", from: null, to: null });
  const [busy, setBusy] = useState("");
  const q = { clientId: f.clientId, status: f.status, from: toIsoDay(f.from), to: toIsoDay(f.to) };
  const { data: cl } = useFetch("/clients/options", undefined, { enabled: isAdmin });
  const { data: a, loading } = useFetch("/analytics", { clientId: f.clientId, from: q.from, to: q.to });
  const run = (kind, fn) => async () => { setBusy(kind); try { await fn(); toast.success(`${kind} report ready`); } catch (e) { toast.error(e.message || "Could not create the report."); } finally { setBusy(""); } };
  const s = a?.summary;
  return (
    <>
      <PageHeader title="Reports and export" description="Download your trade records as PDF, Excel or CSV. Filters below apply to every format." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card><CardHeader title="Report filters" /><CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isAdmin && <Select label="Client" searchable value={f.clientId} onValueChange={(v) => setF({ ...f, clientId: v })} options={[{ label: "All clients", value: "all" }, ...(cl?.items || []).map((c) => ({ label: c.name, value: c.id }))]} />}
              <Select label="Status" value={f.status} onValueChange={(v) => setF({ ...f, status: v })} options={[{ label: "All statuses", value: "all" }, { label: "Open", value: "open" }, { label: "Closed", value: "closed" }, { label: "Cancelled", value: "cancelled" }]} />
              <DatePicker label="Opened from" value={f.from} onChange={(d) => setF({ ...f, from: d })} clearable placeholder="Start date" />
              <DatePicker label="Opened to" value={f.to} onChange={(d) => setF({ ...f, to: d })} clearable placeholder="End date" />
            </div>
          </CardBody></Card>
          <Card><CardHeader title="Download" description="Reports include every trade that matches the filters." /><CardBody>
            <div className="flex flex-wrap gap-3">
              <Button iconBefore={<FileText className="size-4" />} loading={busy === "PDF"} loadingText="Building PDF" onClick={run("PDF", () => buildPdf(q))}>Download PDF</Button>
              <Button variant="outline" iconBefore={<FileSpreadsheet className="size-4" />} loading={busy === "Excel"} loadingText="Building Excel" onClick={run("Excel", () => download("/reports/trades.xlsx", q, "tradetrack-trades.xlsx"))}>Download Excel</Button>
              <Button variant="outline" iconBefore={<FileDown className="size-4" />} loading={busy === "CSV"} loadingText="Building CSV" onClick={run("CSV", () => download("/reports/trades.csv", q, "tradetrack-trades.csv"))}>Download CSV</Button>
            </div>
          </CardBody></Card>
        </div>
        <Card><CardHeader title="Summary" description="Based on the client and date filters" /><CardBody>
          {loading && !s ? <Skeleton variant="text" lines={5} /> : s && (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Trades" value={s.totalTrades} bordered /><Stat label="Win rate" value={pct(s.winRate)} bordered />
              <Stat label="Net P/L" value={signedMoney(s.netPnl)} bordered /><Stat label="Fees" value={money(s.fees)} bordered />
            </div>
          )}
        </CardBody></Card>
      </div>
    </>
  );
}
