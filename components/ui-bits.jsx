"use client";
import { AlertTriangle } from "lucide-react";
import { Button, Callout, Card, CardBody, Chip, EmptyState, Skeleton } from "@neuctra/ui";
import { signedMoney } from "@/lib/format";

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground text-balance sm:text-2xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-secondary text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <Callout type="error" title="Something went wrong" icon={<AlertTriangle className="size-4" />}>
      <p className="text-sm">{error?.message || "Please try again."}</p>
      {onRetry && <div className="mt-3"><Button size="sm" variant="outline" onClick={onRetry}>Try again</Button></div>}
    </Callout>
  );
}

export function CardSkeleton({ rows = 5 }) {
  return <Card><CardBody><Skeleton variant="text" lines={rows} /></CardBody></Card>;
}

export function StatsSkeleton({ count = 8 }) {
  return <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({ length: count }).map((_, i) => <Skeleton key={i} variant="rectangular" height={96} />)}</div>;
}

export function Empty({ icon, title, description, action }) {
  return <EmptyState icon={icon} title={title} description={description} action={action} />;
}

export function Pnl({ value, closed = true }) {
  if (!closed) return <span className="text-muted-foreground">Open</span>;
  const v = Number(value) || 0;
  return <span className={`tabular-nums ${v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-secondary"}`}>{signedMoney(v)}</span>;
}

export function StatusChip({ status }) {
  const color = { open: "primary", closed: "neutral", cancelled: "destructive", active: "success", inactive: "neutral", buy: "success", sell: "destructive" }[status] || "neutral";
  return <Chip label={status} color={color} variant="soft" size="sm" className="capitalize" />;
}

export function Field({ children }) { return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>; }
