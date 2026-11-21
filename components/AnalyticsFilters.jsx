"use client";
import { RotateCcw } from "lucide-react";
import { Button, DatePicker, Select } from "@neuctra/ui";
import { useAuth } from "@/app/contexts/AuthContext";
import { useFetch } from "@/hooks/useFetch";

export const emptyRange = { clientId: "all", from: null, to: null };

export default function AnalyticsFilters({ value, onChange }) {
  const { isAdmin } = useAuth();
  const { data } = useFetch("/clients/options", undefined, { enabled: isAdmin });
  const opts = [{ label: "All clients", value: "all" }, ...(data?.items || []).map((c) => ({ label: c.name, value: c.id }))];
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="mb-6 grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
      {isAdmin && <Select label="Client" options={opts} value={value.clientId} onValueChange={(v) => set({ clientId: v })} searchable />}
      <DatePicker label="From" value={value.from} onChange={(d) => set({ from: d })} clearable placeholder="Start date" />
      <DatePicker label="To" value={value.to} onChange={(d) => set({ to: d })} clearable placeholder="End date" />
      <Button variant="outline" iconBefore={<RotateCcw className="size-4" />} onClick={() => onChange(emptyRange)}>Reset</Button>
    </div>
  );
}
