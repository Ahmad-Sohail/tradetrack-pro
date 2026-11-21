"use client";
import { useState } from "react";
import { Link2, Plus, RefreshCw, Trash2, Unplug } from "lucide-react";
import { Button, Callout, Card, CardBody, CardHeader, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, Skeleton, toast } from "@neuctra/ui";
import { api, ApiError } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { ago } from "@/lib/format";
import { Empty, ErrorState } from "./ui-bits";
import ConfirmModal from "./ConfirmModal";

const PAIR = /^[A-Z0-9]{2,10}\/(USDT|USDC|USD|BUSD|FDUSD)$/;
const blank = { exchange: "", label: "", apiKey: "", secret: "", passphrase: "", symbols: "", historyDays: "90" };

function ConnectModal({ open, onClose, clientId, exchanges, onDone }) {
  const [v, setV] = useState(blank);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const ex = exchanges.find((e) => e.id === v.exchange);
  const set = (k) => (val) => { setV((s) => ({ ...s, [k]: val })); setErrs((e) => ({ ...e, [k]: undefined })); };
  const inp = (k) => ({ value: v[k], error: errs[k], onChange: (e) => set(k)(e.target.value) });

  const submit = async () => {
    const symbols = v.symbols.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    const e = {};
    if (!v.exchange) e.exchange = "Choose an exchange.";
    if (v.apiKey.trim().length < 5) e.apiKey = "Enter the API key.";
    if (v.secret.trim().length < 5) e.secret = "Enter the API secret.";
    if (ex?.passphrase && !v.passphrase.trim()) e.passphrase = "This exchange needs the API passphrase.";
    if (!symbols.length) e.symbols = "Add at least one pair, for example BTC/USDT.";
    else if (symbols.some((s) => !PAIR.test(s))) e.symbols = "Use pairs like BTC/USDT, quoted in USDT, USDC or USD.";
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await api("/connections", { method: "POST", body: { clientId, exchange: v.exchange, label: v.label, apiKey: v.apiKey.trim(), secret: v.secret.trim(), passphrase: v.passphrase.trim(), symbols, historyDays: Number(v.historyDays) } });
      if (r.syncError) toast.error(`Connected, but the first sync failed: ${r.syncError}`);
      else toast.success(`Connected. ${r.summary.created} trade${r.summary.created === 1 ? "" : "s"} imported.`);
      setV(blank); onDone(); onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrs(err.fields);
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal isOpen={open} onClose={busy ? () => {} : onClose} ariaLabel="Connect an exchange">
      <ModalContent maxWidth="max-w-xl">
        <ModalHeader title="Connect an exchange" onClose={onClose} />
        <ModalBody className="max-h-[70vh] overflow-y-auto">
          <div className="flex flex-col gap-4">
            <Callout type="warning" title="Use a read-only API key">
              <p className="text-sm">Create the key with only the &quot;Read&quot; permission. Turn off trading and withdrawals. If possible, restrict the key to this server&apos;s IP address.</p>
            </Callout>
            <Select label="Exchange" required placeholder="Choose an exchange" value={v.exchange} error={errs.exchange} onValueChange={set("exchange")} options={exchanges.map((e) => ({ label: e.label, value: e.id }))} />
            <Input label="Label" placeholder="Optional, for example Main account" {...inp("label")} />
            <Input label="API key" required type="password" placeholder="Paste the API key" autoComplete="off" {...inp("apiKey")} />
            <Input label="API secret" required type="password" placeholder="Paste the API secret" autoComplete="off" {...inp("secret")} />
            {ex?.passphrase && <Input label="API passphrase" required type="password" placeholder="Passphrase set when the key was created" autoComplete="off" {...inp("passphrase")} />}
            <Input label="Trading pairs to track" required placeholder="BTC/USDT, ETH/USDT" helperText="Spot pairs only. Separate pairs with commas." {...inp("symbols")} />
            <Select label="History to import" value={v.historyDays} onValueChange={set("historyDays")} options={[["30", "Last 30 days"], ["90", "Last 90 days"], ["180", "Last 180 days"], ["365", "Last 365 days"]].map(([value, label]) => ({ value, label }))} />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button loading={busy} loadingText="Connecting" iconBefore={<Link2 className="size-4" />} onClick={submit}>Connect and sync</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default function ConnectionsPanel({ clientId }) {
  const list = useFetch("/connections", { clientId });
  const ex = useFetch("/connections/exchanges");
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(null);
  const [syncing, setSyncing] = useState("");
  const label = (id) => ex.data?.items.find((e) => e.id === id)?.label || id;

  const sync = async (c) => {
    setSyncing(c.id);
    try { const r = await api(`/connections/${c.id}/sync`, { method: "POST" }); toast.success(`Synced. ${r.summary.created} new, ${r.summary.updated} updated.`); }
    catch (e) { toast.error(e.message); }
    finally { setSyncing(""); list.reload(); }
  };
  const remove = async () => { await api(`/connections/${del.id}`, { method: "DELETE" }); toast.success("Connection removed. Existing trades were kept."); list.reload(); };

  return (
    <Card>
      <CardHeader title="Connected accounts" description="Trades are pulled from the exchange automatically. Nothing here can place or cancel orders."
        action={<Button size="sm" iconBefore={<Plus className="size-4" />} disabled={!ex.data?.enabled} onClick={() => setOpen(true)}>Connect exchange</Button>} />
      <CardBody>
        {ex.data && !ex.data.enabled && <div className="mb-4"><Callout type="info" title="Not set up on the server"><p className="text-sm">Exchange sync needs an ENCRYPTION_KEY in the server environment. Add it and restart the API.</p></Callout></div>}
        {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <Skeleton variant="text" lines={3} /> : !list.data.items.length ? (
          <Empty icon={<Unplug className="size-6" />} title="No exchange connected" description="Connect a read-only API key and trades will appear here without manual entry." />
        ) : (
          <ul className="flex flex-col gap-3">
            {list.data.items.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{label(c.exchange)}{c.label ? ` · ${c.label}` : ""}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Chip label={c.status === "ok" ? "Connected" : c.status === "error" ? "Error" : "Pending"} color={c.status === "ok" ? "success" : c.status === "error" ? "destructive" : "neutral"} variant="soft" size="sm" />
                      {c.symbols.map((s) => <Chip key={s} label={s} variant="outline" color="neutral" size="sm" />)}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{c.lastSyncAt ? `Last synced ${ago(c.lastSyncAt)}` : "Not synced yet"} · history {c.historyDays} days</p>
                    {c.status === "error" && c.lastError && <p className="mt-2 text-sm text-destructive">{c.lastError}</p>}
                    {c.lastSummary?.unmatchedSells > 0 && <p className="mt-2 text-xs text-muted-foreground">{c.lastSummary.unmatchedSells} sell order(s) had no matching buy in this history window and were skipped. Increase the history window to include them.</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" iconBefore={<RefreshCw className="size-4" />} loading={syncing === c.id} loadingText="Syncing" onClick={() => sync(c)}>Sync now</Button>
                    <Button size="sm" variant="ghost" iconBefore={<Trash2 className="size-4" />} onClick={() => setDel(c)}>Remove</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <ConnectModal open={open} onClose={() => setOpen(false)} clientId={clientId} exchanges={ex.data?.items || []} onDone={list.reload} />
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Remove connection" confirmLabel="Remove" message="The API key is deleted from this server and syncing stops. Trades already imported stay in your history." onConfirm={remove} />
    </Card>
  );
}
