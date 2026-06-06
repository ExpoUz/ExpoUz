"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Clock, Users } from "lucide-react";
import { getMatches, cancelMatch, formatUZS } from "@/lib/api";
import { PageHeader, Spinner, EmptyState, StatusPill } from "@/components/ui";

const CANCELLABLE = ["OPEN", "FULL", "CONFIRMED"];

export default function SchedulePage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["portal-matches", page],
    queryFn: () => getMatches({ page, limit: 50 }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelMatch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-matches"] }),
  });

  const matches = data?.data ?? [];
  const grouped = groupByDay(matches);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.limit ?? 50)));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Schedule"
        subtitle="All matches hosted on your pitches"
        action={
          <div className="flex items-center gap-2">
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
        }
      />

      {isLoading ? (
        <Spinner />
      ) : grouped.length === 0 ? (
        <EmptyState title="No matches scheduled" hint="Matches hosted on your pitches will appear here." />
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.key}>
              <h2 className="text-sm font-semibold text-[#6B7280] mb-2 px-1">
                {dayjs(group.key).format("dddd, MMMM D")}
              </h2>
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm divide-y divide-[#F3F4F6] overflow-hidden">
                {group.matches.map((m: any) => (
                  <div key={m.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="text-sm font-semibold text-[#00875A] w-16 shrink-0 flex items-center gap-1">
                      <Clock size={13} /> {dayjs(m.startTime).format("HH:mm")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#0D1117] truncate">
                        {m.pitch?.name ?? "Pitch"} · {m.format}
                      </div>
                      <div className="text-xs text-[#6B7280] flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {m.currentPlayers ?? m._count?.bookings ?? 0}/{m.maxPlayers}
                        </span>
                        <span>{formatUZS(m.pricePerPlayer)}/player</span>
                        {m.host && (
                          <span className="truncate">
                            Host: {m.host.firstName} {m.host.lastName}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusPill status={m.status} />
                    {CANCELLABLE.includes(m.status) && (
                      <button
                        onClick={() => {
                          if (confirm("Cancel this match? Players will be notified and refunded.")) {
                            cancel.mutate(m.id);
                          }
                        }}
                        disabled={cancel.isPending}
                        className="text-xs font-semibold text-[#B91C1C] hover:underline disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDay(matches: any[]) {
  const map = new Map<string, any[]>();
  for (const m of matches) {
    const key = dayjs(m.startTime).format("YYYY-MM-DD");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, ms]) => ({
      key,
      matches: ms.sort((a, b) => (a.startTime < b.startTime ? -1 : 1)),
    }));
}
