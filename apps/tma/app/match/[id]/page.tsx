"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getMatch } from "@/lib/api";
import { FootballMatchDetail } from "@/components/match-detail/FootballMatchDetail";
import { PadelMatchDetail } from "@/components/match-detail/PadelMatchDetail";
import { MatchDetailSkeleton } from "@/components/match-detail/MatchDetailSkeleton";

export default function MatchDetailPage() {
  const params = useParams();
  const id = String(params.id);

  const { data: match, isLoading } = useQuery({
    queryKey: ["tma-match", id],
    queryFn: () => getMatch(id),
  });

  if (isLoading || !match) return <MatchDetailSkeleton />;

  return match.sport === "FOOTBALL" ? (
    <FootballMatchDetail match={match} />
  ) : (
    <PadelMatchDetail match={match} />
  );
}
