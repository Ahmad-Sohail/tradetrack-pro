"use client";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import { FileUp, Upload } from "lucide-react";
import { Button, Callout, Card, CardBody, CardHeader, Select, Skeleton, Stat, Table, TBody, TD, TH, THead, TRow, toast } from "@neuctra/ui";
import { api } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { ErrorState, PageHeader } from "./ui-bits";

const FIELDS = [
  ["symbol", "Symbol", true, ["symbol", "instrument", "pair", "item", "asset"]],
  ["direction", "Direction (buy or sell)", true, ["type", "direction", "side", "action"]],
  ["entryPrice", "Entry price", true, ["openprice", "entryprice", "entry", "buyprice", "price"]],
  ["positionSize", "Position size", true, ["volume", "size", "lots", "lot", "quantity", "qty", "amount"]],
  ["openedAt", "Opening time", true, ["opentime", "opendate", "openedat", "entrytime", "timeopen", "time"]],
  ["exitPrice", "Exit price", false, ["closeprice", "exitprice", "exit", "sellprice"]],
  ["closedAt", "Closing time", false, ["closetime", "closedate", "closedat", "exittime", "timeclose"]],
  ["profitLoss", "Profit or loss", false, ["profit", "pnl", "pl", "profitloss", "realizedpnl", "netprofit"]],
  ["fees", "Fees or commission", false, ["commission", "fee", "fees"]],
  ["externalId", "Trade ID or ticket", false, ["ticket", "order", "orderid", "positionid", "deal", "tradeid", "id"]],
  ["status", "Status", false, ["status", "state"]],
  ["marketType", "Market type", false, ["market", "markettype", "assetclass"]],
  ["stopLoss", "Stop loss", false, ["sl", "stoploss"]],
  ["takeProfit", "Take profit", false, ["tp", "takeprofit"]],
  ["strategy", "Strategy", false, ["strategy", "comment"]],
  ["notes", "Notes", false, ["notes", "note", "remarks"]],
];
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const NONE = "__none__";

export default function ImportView() {
  const clients = useFetch("/clients/options");
  const [clientId, setClientId] = useState("");
  const [market, setMarket] = useState("forex");
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [map, setMap] = useState({});
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState("");

  const onFile = (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Choose a file under 5 MB."); return; }
    Papa.parse(f, {
      header: true, skipEmptyLines: true,
      complete: (r) => {
        const cols = r.meta.fields || [];
        if (!cols.length || !r.data.length) { toast.error("This file has no rows."); return; }
        const m = {}; const used = new Set();
        for (const [key, , , aliases] of FIELDS) {
          const hit = cols.find((c) => !used.has(c) && aliases.includes(norm(c)));
          if (hit) { m[key] = hit; used.add(hit); }
        }
        setFile(f); setParsed({ cols, rows: r.data }); setMap(m); setCheck(null);
      },
      error: () => toast.error("Could not read this file as CSV."),
    });
  };

  const rows = useMemo(() => (parsed ? parsed.rows.map((r) => Object.fromEntries(FIELDS.filter(([k]) => map[k]).map(([k]) => [k, r[map[k]]]))) : []), [parsed, map]);
  const missing = FIELDS.filter(([k, , req]) => req && !map[k]).map(([, l]) => l);
  const ready = clientId && parsed && !missing.length;

  const send = async (dryRun) => {
    setBusy(dryRun ? "check" : "import");
    try {
      const total = { total: 0, valid: 0, created: 0, skipped: 0, failedCount: 0, failed: [] };
      for (let i = 0; i < rows.length; i += 1000) {
        const r = await api("/imports/trades", { method: "POST", body: { clientId, defaultMarketType: market, dryRun, rows: rows.slice(i, i + 1000) } });
        total.total += r.total; total.valid += r.valid; total.created += r.created; total.skipped += r.skipped; total.failedCount += r.failedCount;
        total.failed.push(...r.failed.map((f) => ({ ...f, row: f.row + i })));
      }
      setCheck({ ...total, dryRun });
      if (!dryRun) toast.success(`${total.created} trade${total.created === 1 ? "" : "s"} imported`);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(""); }
  };

  const colOpts = parsed ? [{ label: "Not in this file", value: NONE }, ...parsed.cols.map((c) => ({ label: c, value: c }))] : [];

  return (
    <>
      <PageHeader title="Import trades" description="Upload a CSV exported from MetaTrader, your broker or an exchange. Columns are matched automatically and you can fix any match before importing." />
      {clients.error ? <ErrorState error={clients.error} onRetry={clients.reload} /> : (
        <div className="flex flex-col gap-6">
          <Card><CardHeader title="1. Choose client and file" /><CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Client" required searchable placeholder="Choose a client" value={clientId} onValueChange={setClientId} options={(clients.data?.items || []).map((c) => ({ label: c.name, value: c.id }))} />
              <Select label="Market type when the file has none" value={market} onValueChange={setMarket} options={["forex", "crypto", "stocks", "commodities", "indices"].map((m) => ({ label: m[0].toUpperCase() + m.slice(1), value: m }))} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input id="csv" type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
              <Button variant="outline" iconBefore={<FileUp className="size-4" />} onClick={() => document.getElementById("csv").click()}>{file ? "Choose another file" : "Choose CSV file"}</Button>
              {file && <p className="text-sm text-secondary">{file.name} · {parsed.rows.length} rows</p>}
            </div>
            <p className="mt-3 max-w-prose text-xs text-muted-foreground">Numbers use a dot for decimals (1,234.50). MetaTrader dates such as 2026.11.02 09:15:00 are supported and read as UTC. Rows with the same trade ID are skipped, so re-importing a file is safe.</p>
          </CardBody></Card>

          {parsed && (<>
            <Card><CardHeader title="2. Match columns" description="Required fields are marked." /><CardBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {FIELDS.map(([key, label, req]) => (
                  <Select key={key} label={label} required={req} value={map[key] || NONE} options={colOpts}
                    onValueChange={(v) => { setMap((m) => { const n = { ...m }; if (v === NONE) delete n[key]; else n[key] = v; return n; }); setCheck(null); }} />
                ))}
              </div>
              {missing.length > 0 && <div className="mt-4"><Callout type="warning" title="Match the required columns"><p className="text-sm">Still needed: {missing.join(", ")}.</p></Callout></div>}
            </CardBody></Card>

            <Card><CardHeader title="Preview" description="First 5 rows as they will be read" />
              <div className="overflow-x-auto"><Table><THead><TRow>{FIELDS.filter(([k]) => map[k]).map(([k, l]) => <TH key={k}>{l}</TH>)}</TRow></THead>
                <TBody>{rows.slice(0, 5).map((r, i) => <TRow key={i}>{FIELDS.filter(([k]) => map[k]).map(([k]) => <TD key={k}><span className="whitespace-nowrap text-xs">{String(r[k] ?? "")}</span></TD>)}</TRow>)}</TBody></Table></div>
            </Card>

            <Card><CardHeader title="3. Check and import" /><CardBody>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" disabled={!ready} loading={busy === "check"} loadingText="Checking" onClick={() => send(true)}>Check file</Button>
                <Button iconBefore={<Upload className="size-4" />} disabled={!ready || !check?.dryRun || check.valid === 0} loading={busy === "import"} loadingText="Importing" onClick={() => send(false)}>Import {check?.dryRun ? `${check.valid} trades` : "trades"}</Button>
              </div>
              {busy && !check && <div className="mt-4"><Skeleton variant="text" lines={2} /></div>}
              {check && (<div className="mt-6">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat label="Rows in file" value={check.total} bordered />
                  <Stat label={check.dryRun ? "Ready to import" : "Imported"} value={check.dryRun ? check.valid : check.created} bordered />
                  <Stat label="Already imported" value={check.skipped} bordered />
                  <Stat label="Need attention" value={check.failedCount} bordered />
                </div>
                {check.failed.length > 0 && (
                  <div className="mt-4"><Callout type="error" title={`${check.failedCount} row${check.failedCount === 1 ? "" : "s"} could not be read`}>
                    <ul className="mt-2 list-disc pl-5 text-sm">{check.failed.slice(0, 10).map((f) => <li key={f.row}>Row {f.row}: {f.message}</li>)}</ul>
                    {check.failedCount > 10 && <p className="mt-2 text-sm">And {check.failedCount - 10} more.</p>}
                  </Callout></div>
                )}
              </div>)}
            </CardBody></Card>
          </>)}
        </div>
      )}
    </>
  );
}
