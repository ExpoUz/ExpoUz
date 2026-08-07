"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { getCrmPlayers, getCrmSegments, formatUZS } from "@/lib/api";
import { PageHeader, Spinner, EmptyState } from "@/components/ui";
import { SegmentBadge, LevelBadge, Avatar } from "@/components/crm";
import { useI18n, useRelativeTime } from "@/lib/i18n";

const SEGMENTS = ["ALL", "REGULAR", "NEW", "AT_RISK", "LAPSED"] as const;
const SORTS = ["recent", "games", "spent"] as const;

export default function PlayersPage() {
  const { t } = useI18n();
  const rel = useRelativeTime();
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<string>("ALL");
  const [sort, setSort] = useState<string>("recent");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["crm-players", search, segment, sort, page],
    queryFn: () => getCrmPlayers({ search: search || undefined, segment, sort, page, limit: 50 }),
    placeholderData: keepPreviousData,
  });
  const { data: segCounts } = useQuery({ queryKey: ["crm-segments"], queryFn: getCrmSegments });

  const players = data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.limit ?? 50)));

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <PageHeader title={t("players.title")} subtitle={t("players.subtitle")} action={
        <span className="text-2xl font-bold text-[#0D1117]">{segCounts?.ALL ?? data?.total ?? 0}</span>
      } />

      <div className="mb-3 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t("players.search")}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm outline-none focus:ring-2 focus:ring-[#00C853]/30"
        />
      </div>

      {/* Segment chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {SEGMENTS.map((s) => {
          const n = segCounts?.[s];
          const active = segment === s;
          return (
            <button
              key={s}
              onClick={() => { setSegment(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active ? "bg-[#0D1117] text-white border-[#0D1117]" : "bg-white text-[#374151] border-[#E5E7EB] hover:border-[#00C853]"
              }`}
            >
              {t(`seg.${s}`)}{typeof n === "number" ? ` ${n}` : ""}
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-4 text-xs text-[#6B7280]">
        <span>{t("players.sort")}:</span>
        {SORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`px-2 py-1 rounded-lg ${sort === s ? "bg-[#00C853]/15 text-[#00875A] font-semibold" : "hover:bg-[#F3F4F6]"}`}
          >
            {t(`players.sort.${s}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner label={t("common.loading")} />
      ) : players.length === 0 ? (
        <EmptyState title={t("players.none")} hint={t("players.none.hint")} />
      ) : (
        <div className="space-y-2">
          {players.map((p) => (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="flex items-center gap-3 bg-white rounded-2xl border border-[#E5E7EB] p-3.5 shadow-sm hover:border-[#00C853] transition-colors"
            >
              <Avatar url={p.avatarUrl} first={p.firstName} last={p.lastName} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#0D1117] truncate">
                    {p.firstName} {p.lastName?.[0] ? `${p.lastName[0]}.` : ""}
                  </span>
                  <LevelBadge padelLevel={p.padelLevel} skillLevel={p.skillLevel} />
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-xs text-[#6B7280] truncate">
                    {p.gamesHere} {t("players.games")}
                    {" · "}
                    {sort === "spent" ? formatUZS(p.spentHere) : rel(p.lastVisit)}
                  </span>
                  <SegmentBadge segment={p.segment} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-sm disabled:opacity-40">←</button>
          <span className="text-sm text-[#6B7280]">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-sm disabled:opacity-40">→</button>
        </div>
      )}
    </div>
  );
}
