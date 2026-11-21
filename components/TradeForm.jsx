"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button, Card, CardBody, CardHeader, DatePicker, Input, Select, Textarea, TimePicker, toast } from "@neuctra/ui";
import { api, ApiError } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { ErrorState, Field, PageHeader } from "./ui-bits";
import { Callout } from "@neuctra/ui";

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const markets = ["forex", "crypto", "stocks", "commodities", "indices"].map((m) => ({ label: cap(m), value: m }));
const toStr = (v) => (v === null || v === undefined ? "" : String(v));

function DateTime({ label, value, onChange, error, helper, disabled }) {
  const setDate = (d) => { if (!d) return onChange(null); const n = new Date(d); const b = value || new Date(); n.setHours(b.getHours(), b.getMinutes(), 0, 0); onChange(n); };
  const setTime = (t) => { if (!t) return; const n = value ? new Date(value) : new Date(); n.setHours(t.getHours(), t.getMinutes(), 0, 0); onChange(n); };
  return (
    <div className="sm:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DatePicker label={`${label} date`} value={value} onChange={setDate} error={error} helperText={helper} placeholder="Pick a date" disabled={disabled} />
      <TimePicker label={`${label} time`} value={value} onChange={setTime} step={15} placeholder="Pick a time" disabled={disabled} />
    </div>
  );
}

const blank = (clientId = "") => ({ clientId, symbol: "", marketType: "", direction: "", status: "open", entryPrice: "", exitPrice: "", investmentAmount: "", positionSize: "", stopLoss: "", takeProfit: "", profitLoss: "", fees: "0", openedAt: new Date(), closedAt: null, strategy: "", notes: "" });

export default function TradeForm({ tradeId, defaultClientId = "" }) {
  const router = useRouter();
  const editing = !!tradeId;
  const { data: cl } = useFetch("/clients/options");
  const existing = useFetch(`/trades/${tradeId}`, undefined, { enabled: editing });
  const [v, setV] = useState(blank(defaultClientId));
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = existing.data?.trade;
    if (!t) return;
    setV({ ...blank(), ...Object.fromEntries(["clientId", "symbol", "marketType", "direction", "status", "strategy", "notes"].map((k) => [k, t[k] || ""])),
      ...Object.fromEntries(["entryPrice", "exitPrice", "investmentAmount", "positionSize", "stopLoss", "takeProfit", "fees"].map((k) => [k, toStr(t[k])])),
      profitLoss: t.status === "closed" ? toStr(t.profitLoss) : "", openedAt: new Date(t.openedAt), closedAt: t.closedAt ? new Date(t.closedAt) : null });
  }, [existing.data]);

  const set = (k) => (val) => { setV((s) => ({ ...s, [k]: val })); setErrs((e) => ({ ...e, [k]: undefined })); };
  const inp = (k) => ({ value: v[k], error: errs[k], onChange: (e) => set(k)(e.target.value) });

  const validate = () => {
    const e = {};
    if (!v.clientId) e.clientId = "Choose a client.";
    if (!v.symbol.trim()) e.symbol = "Enter a symbol.";
    if (!v.marketType) e.marketType = "Choose a market.";
    if (!v.direction) e.direction = "Choose buy or sell.";
    if (!(Number(v.entryPrice) > 0)) e.entryPrice = "Enter a price above 0.";
    if (!(Number(v.positionSize) > 0)) e.positionSize = "Enter a size above 0.";
    if (!v.openedAt) e.openedAt = "Pick when the trade opened.";
    if (v.status === "closed") {
      if (!(Number(v.exitPrice) > 0)) e.exitPrice = "Closed trades need an exit price.";
      if (!v.closedAt) e.closedAt = "Closed trades need a closing time.";
      else if (v.openedAt && v.closedAt < v.openedAt) e.closedAt = "Closing time must be after opening time.";
    }
    for (const k of ["investmentAmount", "fees"]) if (v[k] !== "" && Number(v[k]) < 0) e[k] = "Cannot be negative.";
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate(); setErrs(e);
    if (Object.keys(e).length) { toast.error("Please fix the highlighted fields."); return; }
    setBusy(true);
    const body = { ...v, openedAt: v.openedAt.toISOString(), closedAt: v.status === "closed" && v.closedAt ? v.closedAt.toISOString() : null,
      investmentAmount: v.investmentAmount === "" ? 0 : v.investmentAmount, fees: v.fees === "" ? 0 : v.fees };
    try {
      const r = await api(editing ? `/trades/${tradeId}` : "/trades", { method: editing ? "PATCH" : "POST", body });
      toast.success(editing ? "Trade updated" : `Trade ${r.trade.tradeId} recorded`);
      router.push(`/trades/${r.trade.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrs(err.fields);
      toast.error(err.message);
      setBusy(false);
    }
  };

  if (editing && existing.error) return <ErrorState error={existing.error} onRetry={existing.reload} />;
  const lock = existing.data?.trade?.source === "sync";
  const closed = v.status === "closed";
  return (
    <form onSubmit={submit} noValidate>
      <PageHeader title={editing ? "Edit trade" : "Add new trade"} description="Trades are records of activity. Nothing here places an order with a broker or exchange."
        actions={<><Button type="button" variant="outline" onClick={() => router.back()} disabled={busy}>Cancel</Button><Button type="submit" loading={busy} loadingText="Saving" iconBefore={<Save className="size-4" />}>{editing ? "Save changes" : "Record trade"}</Button></>} />
      {lock && <div className="mb-6"><Callout type="info" title="Synced from an exchange"><p className="text-sm">Prices, size and times come from the exchange and cannot be edited. You can still change the strategy and notes.</p></Callout></div>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card><CardHeader title="Trade details" /><CardBody>
            <Field>
              <Select label="Client" disabled={lock} required searchable placeholder="Choose a client" value={v.clientId} error={errs.clientId} onValueChange={set("clientId")} options={(cl?.items || []).map((c) => ({ label: c.name, value: c.id }))} />
              <Input label="Asset or symbol" disabled={lock} required placeholder="e.g. EURUSD" {...inp("symbol")} />
              <Select label="Market type" disabled={lock} required placeholder="Choose a market" value={v.marketType} error={errs.marketType} onValueChange={set("marketType")} options={markets} />
              <Select label="Direction" disabled={lock} required placeholder="Buy or sell" value={v.direction} error={errs.direction} onValueChange={set("direction")} options={[{ label: "Buy", value: "buy" }, { label: "Sell", value: "sell" }]} />
              <Input label="Entry price" disabled={lock} required type="number" step={0.0001} placeholder="e.g. 1.0850" {...inp("entryPrice")} />
              <Input label="Exit price" disabled={lock} type="number" step={0.0001} placeholder="Required when closed" {...inp("exitPrice")} />
              <Input label="Position size" disabled={lock} required type="number" step={0.01} placeholder="e.g. 2.5" {...inp("positionSize")} />
              <Input label="Investment amount" disabled={lock} type="number" step={0.01} prefix="$" placeholder="e.g. 1500" {...inp("investmentAmount")} />
              <Input label="Stop loss" disabled={lock} type="number" step={0.0001} placeholder="Optional" {...inp("stopLoss")} />
              <Input label="Take profit" disabled={lock} type="number" step={0.0001} placeholder="Optional" {...inp("takeProfit")} />
            </Field>
          </CardBody></Card>
          <Card><CardHeader title="Timing and result" /><CardBody>
            <Field>
              <DateTime disabled={lock} label="Opened" value={v.openedAt} onChange={set("openedAt")} error={errs.openedAt} />
              {closed && <DateTime disabled={lock} label="Closed" value={v.closedAt} onChange={set("closedAt")} error={errs.closedAt} />}
              <Input label="Fees" disabled={lock} type="number" step={0.01} prefix="$" placeholder="0.00" {...inp("fees")} />
              {closed && <Input label="Profit or loss" disabled={lock} type="number" step={0.01} prefix="$" placeholder="Auto-calculated" helperText="Leave blank to calculate from prices, net of fees." {...inp("profitLoss")} />}
            </Field>
          </CardBody></Card>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Card><CardHeader title="Status and strategy" /><CardBody>
            <div className="flex flex-col gap-4">
              <Select label="Status" disabled={lock} value={v.status} onValueChange={set("status")} options={[{ label: "Open", value: "open" }, { label: "Closed", value: "closed" }, { label: "Cancelled", value: "cancelled" }]} />
              <Input label="Strategy" placeholder="e.g. Breakout" {...inp("strategy")} />
              <Textarea label="Notes" placeholder="Rationale, market context, lessons learned" maxLength={4000} value={v.notes} onChange={(e) => set("notes")(e.target.value)} />
            </div>
          </CardBody></Card>
        </div>
      </div>
    </form>
  );
}
