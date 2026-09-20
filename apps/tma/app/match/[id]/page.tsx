"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { getMatch } from "@/lib/api";
import { useMatchSocket } from "@/lib/useMatchSocket";
import { FootballMatchDetail } from "@/components/match-detail/FootballMatchDetail";
import { PadelMatchDetail } from "@/components/match-detail/PadelMatchDetail";
import { MatchDetailSkeleton } from "@/components/match-detail/MatchDetailSkeleton";

export default function MatchDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const qc = useQueryClient();
  const t = useTranslations("common");

  const { data: match, isLoading, isError, refetch } = useQuery({
    queryKey: ["tma-match", id],
    queryFn: () => getMatch(id),
  });

  // Live updates: refetch when someone joins/leaves so the versus preview and
  // player slots reflect the current roster in real time.
  useMatchSocket(id, () => qc.invalidateQueries({ queryKey: ["tma-match", id] }));

  if (isLoading) return <MatchDetailSkeleton />;

  if (isError || !match)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center gap-3">
        <AlertCircle size={32} style={{ color: "var(--tg-hint)" }} />
        <p className="text-sm" style={{ color: "var(--tg-hint)" }}>{t("error")}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#00C853" }}
        >
          {t("retry")}
        </button>
      </div>
    );

  return match.sport === "FOOTBALL" ? (
    <FootballMatchDetail match={match} />
  ) : (
    <PadelMatchDetail match={match} />
  );
}
