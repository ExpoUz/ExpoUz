"use client";

import { ReactNode } from "react";
import { Spinner, EmptyState } from "./Feedback";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

/**
 * Consistent table for both admin panels: same card frame, header style, row
 * hover, and built-in loading/empty states. Search/filter/pagination live
 * around it (see Toolbar / Pagination) so behaviour is uniform.
 */
export function DataTable<T>({
  columns,
  rows,
  keyOf,
  loading,
  empty,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  loading?: boolean;
  empty?: { title: string; hint?: string };
  onRowClick?: (row: T) => void;
}) {
  if (loading) return <Spinner />;
  if (!rows.length) return <EmptyState title={empty?.title ?? "Nothing here yet"} hint={empty?.hint} />;

  const alignCls = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 font-semibold text-[#6B7280] text-xs uppercase tracking-wide ${alignCls(c.align)} ${c.className ?? ""}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={keyOf(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-[#F3F4F6] last:border-0 ${onRowClick ? "cursor-pointer hover:bg-[#F9FAFB]" : ""}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 text-[#0D1117] ${alignCls(c.align)} ${c.className ?? ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
