"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMatch } from "@/lib/api";
import { useMatchSocket } from "@/lib/useMatchSocket";
import { FootballMatchDetail } from "@/components/match-detail/FootballMatchDetail";
import { PadelMatchDetail } from "@/components/match-detail/PadelMatchDetail";
import { MatchDetailSkeleton } from "@/components/match-detail/MatchDetailSkeleton";

export default function MatchDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const qc = useQueryClient();

  const { data: match, isLoading } = useQuery({
    queryKey: ["tma-match", id],
    queryFn: () => getMatch(id),
  });

  // Live updates: refetch when someone joins/leaves so the versus preview and
  // player slots reflect the current roster in real time.
  useMatchSocket(id, () => qc.invalidateQueries({ queryKey: ["tma-match", id] }));

  if (isLoading || !match) return <MatchDetailSkeleton />;

  return match.sport === "FOOTBALL" ? (
    <FootballMatchDetail match={match} />
  ) : (
    <PadelMatchDetail match={match} />
  );
}
