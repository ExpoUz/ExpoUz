"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Shared pager. Both panels render page controls identically: "Page X of Y"
 * with prev/next, disabled at the ends.
 */
export function Pagination({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-[#6B7280]">
        Page {page} of {pages} · {total.toLocaleString()} total
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E5E7EB] font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E5E7EB] font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
