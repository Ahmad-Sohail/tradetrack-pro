"use client";
import { useRouter } from "next/navigation";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Dropdown, IconButton, Table, TBody, TD, TH, THead, TRow } from "@neuctra/ui";
import { dt, num } from "@/lib/format";
import { Pnl, StatusChip } from "./ui-bits";

export default function TradesTable({ trades, showClient, isAdmin, onDelete }) {
  const router = useRouter();
  const menu = (t) => [
    { label: "View details", icon: <Eye className="size-4" />, onClick: () => router.push(`/trades/${t.id}`) },
    ...(isAdmin ? [
      { label: "Edit trade", icon: <Pencil className="size-4" />, onClick: () => router.push(`/trades/${t.id}/edit`) },
      { separator: true },
      { label: "Delete trade", icon: <Trash2 className="size-4" />, danger: true, onClick: () => onDelete?.(t) },
    ] : []),
  ];
  return (
    <div className="overflow-x-auto">
      <Table hoverable>
        <THead>
          <TRow>
            <TH>Trade</TH>{showClient && <TH>Client</TH>}<TH>Symbol</TH><TH>Side</TH><TH>Entry</TH><TH>Exit</TH><TH>Profit / loss</TH><TH>Status</TH><TH>Opened</TH><TH><span className="sr-only">Actions</span></TH>
          </TRow>
        </THead>
        <TBody>
          {trades.map((t) => (
            <TRow key={t.id} onClick={() => router.push(`/trades/${t.id}`)}>
              <TD><span className="text-xs text-muted-foreground">{t.tradeId}</span>{t.source && t.source !== "manual" && <span className="block text-xs text-muted-foreground">{t.source === "sync" ? "Synced" : "Imported"}</span>}</TD>
              {showClient && <TD>{t.client?.name || "n/a"}</TD>}
              <TD><span className="font-medium text-foreground">{t.symbol}</span><span className="block text-xs capitalize text-muted-foreground">{t.marketType}</span></TD>
              <TD><StatusChip status={t.direction} /></TD>
              <TD><span className="tabular-nums">{num(t.entryPrice)}</span></TD>
              <TD><span className="tabular-nums">{num(t.exitPrice)}</span></TD>
              <TD><Pnl value={t.profitLoss} closed={t.status === "closed"} /></TD>
              <TD><StatusChip status={t.status} /></TD>
              <TD><span className="whitespace-nowrap text-xs text-muted-foreground">{dt(t.openedAt)}</span></TD>
              <TD>
                <Dropdown items={menu(t)} width={190} trigger={<IconButton icon={<MoreHorizontal className="size-4" />} variant="ghost" size="sm" aria-label={`Actions for ${t.tradeId}`} />} />
              </TD>
            </TRow>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
