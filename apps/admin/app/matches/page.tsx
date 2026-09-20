"use client";

import { useQuery } from "@tanstack/react-query";
import { getMatches } from "@/lib/api";
import { useState } from "react";
import dayjs from "dayjs";
import { useSportFilter, sportParam } from "@/lib/sport-store";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-green-100 text-green-700",
  FULL: "bg-red-100 text-red-600",
  CONFIRMED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-gray-100 text-gray-400",
};

export default function MatchesPage() {
  const sport = useSportFilter();
  const { data: matches, isLoading } = useQuery({
    queryKey: ["admin-matches", sport],
    queryFn: () => getMatches({ sport: sportParam(sport) }),
  });

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const STATUSES = ["ALL", "OPEN", "FULL", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

  const filtered = (matches ?? []).filter((m: any) => {
    const statusMatch = statusFilter === "ALL" || m.status === statusFilter;
    const term = search.toLowerCase();
    const textMatch =
      !term ||
      m.title?.toLowerCase().includes(term) ||
      m.pitch?.name?.toLowerCase().includes(term) ||
      m.host?.firstName?.toLowerCase().includes(term);
    return statusMatch && textMatch;
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Matches</h1>
        <p className="text-gray-500 text-sm mt-1">{(matches ?? []).length} total matches</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex gap-3 items-center flex-wrap">
        <input
          type="text"
          placeholder="Search by title, pitch, creator..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-xl border border-gray-200 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Match</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pitch</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Creator</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Format</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Players</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date / Time</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading &&
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  {[...Array(9)].map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-gray-400">
                  No matches found
                </td>
              </tr>
            )}
            {!isLoading &&
              filtered.map((m: any) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900 max-w-[160px] truncate">
                      {m.title ?? "Untitled"}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">{m.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-5 py-3 text-gray-700 max-w-[120px] truncate">
                    {m.pitch?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">
                        {m.host?.firstName?.[0] ?? "?"}
                      </div>
                      <span className="text-gray-700">
                        {m.host?.firstName ?? "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {m.format ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    {m.sport === "PADEL" ? (
                      <span className="text-xs font-medium text-gray-600">
                        {m.matchType === "CASUAL" ? "Casual" : "Competitive"}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <PlayersBar
                      filled={m.currentPlayers ?? m._count?.bookings ?? 0}
                      total={m.maxPlayers ?? 0}
                    />
                  </td>
                  <td className="px-5 py-3 text-gray-600 text-xs whitespace-nowrap">
                    {dayjs(m.startTime).format("MMM D · HH:mm")}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_COLORS[m.status] ?? "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-700 text-xs">
                    {m.pricePerPlayer
                      ? `${m.pricePerPlayer.toLocaleString()} UZS`
                      : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayersBar({ filled, total }: { filled: number; total: number }) {
  if (!total) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${(filled / total) * 100}%` }}
        />
      </div>
      <span className="text-xs text-gray-600">
        {filled}/{total}
      </span>
    </div>
  );
}
