"use client";

import { PadelMatchCard } from "./PadelMatchCard";
import { FootballMatchCard } from "./FootballMatchCard";

// Renders the sport-appropriate card layout. Football uses the compact
// venue-photo row; padel uses the Playtomic-style level/team card.
export function MatchCard({ match }: { match: any }) {
  if (match?.sport === "FOOTBALL") return <FootballMatchCard match={match} />;
  return <PadelMatchCard match={match} />;
}
