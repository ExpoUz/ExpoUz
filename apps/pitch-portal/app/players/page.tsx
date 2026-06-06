"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { getPlayers } from "@/lib/api";
import { PageHeader, Spinner, EmptyState } from "@/components/ui";

function initials(first?: string, last?: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

function reliabilityColor(score: number) {
  if (score >= 85) return "#00C853";
  if (score >= 60) return "#F59E0B";
  return "#EF4444";
}

export default function PlayersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["portal-players", search, page],
    queryFn: () => getPlayers({ search: search || undefined, page, limit: 50 }),
    placeholderData: keepPreviousData,
  });

  const players = data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.limit ?? 50)));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader title="Players" subtitle="Everyone who has booked at your pitches" />

      <div className="mb-4 relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name or phone…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm outline-none focus:ring-2 focus:ring-[#00C853]/30"
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : players.length === 0 ? (
        <EmptyState title="No players found" hint={search ? "Try a different search." : "Players will appear once they book."} />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280] border-b border-[#E5E7EB]">
                <th className="px-5 py-3">Player</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Skill</th>
                <th className="px-5 py-3">ELO</th>
                <th className="px-5 py-3">Reliability</th>
                <th className="px-5 py-3">Games</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {players.map((u: any) => {
                const score = Number(u.reliabilityScore ?? 0);
                return (
                  <tr key={u.id} className="hover:bg-[#F9FAFB]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-xs font-bold overflow-hidden">
                          {u.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            initials(u.firstName, u.lastName)
                          )}
                        </div>
                        <span className="font-medium text-[#0D1117]">
                          {u.firstName} {u.lastName}
                          {u.isBanned && (
                            <span className="ml-2 text-xs text-[#B91C1C] font-semibold">banned</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[#6B7280]">{u.phone ?? "—"}</td>
                    <td className="px-5 py-3 text-[#6B7280]">{u.skillLevel ?? "—"}</td>
                    <td className="px-5 py-3 font-semibold text-[#00875A]">{u.eloRating ?? "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, score)}%`, background: reliabilityColor(score) }}
                          />
                        </div>
                        <span className="text-xs text-[#6B7280]">{score.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[#6B7280]">{u._count?.bookings ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-sm disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-sm text-[#6B7280]">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-sm disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
