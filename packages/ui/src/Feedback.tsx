"use client";

import { ReactNode } from "react";
import { STATUS_STYLES } from "./tokens";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0D1117]">{title}</h1>
        {subtitle && <p className="text-sm text-[#6B7280] mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-[#6B7280] text-sm gap-2">
      <span className="w-4 h-4 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
      {label}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-[#E5E7EB] py-16 text-center">
      <p className="text-[#0D1117] font-medium">{title}</p>
      {hint && <p className="text-sm text-[#6B7280] mt-1">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-[#6B7280]/15 text-[#374151]";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status?.replace(/_/g, " ")}
    </span>
  );
}
