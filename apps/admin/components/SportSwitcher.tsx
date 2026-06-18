"use client";

import { SPORT_OPTIONS, setSportFilter, useSportFilter } from "@/lib/sport-store";

// Global sport filter shown in the admin top bar. Every data view reads
// `useSportFilter()` and scopes its queries accordingly.
export function SportSwitcher() {
  const sport = useSportFilter();
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
      {SPORT_OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setSportFilter(o.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            sport === o.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>{o.icon}</span>
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
