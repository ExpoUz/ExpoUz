"use client";

import { ReactNode } from "react";

/**
 * KPI card shared by both admin panels. `delta` renders a coloured growth badge
 * (green when it starts with "+", red otherwise); `hint` is neutral sub-text.
 */
export function StatCard({
  label,
  value,
  hint,
  delta,
  accent = "#00C853",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string;
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</span>
        {icon != null && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: `${accent}1A`, color: accent }}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-[#0D1117]">{value}</div>
      <div className="flex items-center gap-2 mt-1">
        {delta && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              delta.startsWith("+") ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
            }`}
          >
            {delta}
          </span>
        )}
        {hint && <span className="text-xs text-[#6B7280]">{hint}</span>}
      </div>
    </div>
  );
}
