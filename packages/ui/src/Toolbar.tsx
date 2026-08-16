"use client";

import { ReactNode } from "react";
import { Search } from "lucide-react";

/** Consistent search box — same look/placement across both panels' tables. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full sm:w-64 pl-9 pr-3 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#0D1117] focus:outline-none focus:ring-2 focus:ring-[#00C853]/30"
      />
    </div>
  );
}

/** Row that holds a search box (left) and filters/actions (right). */
export function Toolbar({ search, children }: { search?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
      <div>{search}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
