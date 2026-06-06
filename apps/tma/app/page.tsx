"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getMatches } from "@/lib/api";
import { MatchCard } from "@/components/MatchCard";
import { BottomNav } from "@/components/BottomNav";
import { showMainButton, hideMainButton, hapticImpact } from "@/lib/telegram";

const SPORTS = [
  { key: "", label: "All" },
  { key: "FOOTBALL", label: "⚽ Football" },
  { key: "BASKETBALL", label: "🏀 Basketball" },
  { key: "VOLLEYBALL", label: "🏐 Volleyball" },
  { key: "TENNIS", label: "🎾 Tennis" },
];

export default function HomePage() {
  const router = useRouter();
  const [sport, setSport] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["tma-matches", sport],
    queryFn: () => getMatches(sport ? { sport } : {}),
  });

  useEffect(() => {
    const cleanup = showMainButton("🏟️ Host a Game", () => {
      hapticImpact("medium");
      router.push("/create");
    });
    return () => {
      cleanup();
      hideMainButton();
    };
  }, [router]);

  const matches = data?.data ?? [];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 sticky top-0 z-30" style={{ background: "var(--tg-bg)" }}>
        <div className="text-xl font-extrabold tracking-tight">
          <span className="text-[#00C853]">SCORE</span>
          <span> WITH US</span>
        </div>
        <p className="text-sm mt-0.5" style={{ color: "var(--tg-hint)" }}>
          Games in Tashkent
        </p>

        {/* Sport filter chips */}
        <div className="flex gap-2 overflow-x-auto mt-3 -mx-4 px-4 pb-1">
          {SPORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                hapticImpact("light");
                setSport(s.key);
              }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                sport === s.key
                  ? "bg-[#00C853] text-white border-[#00C853]"
                  : "border-black/10 text-[color:var(--tg-hint)]"
              }`}
              style={sport === s.key ? {} : { background: "var(--tg-card)" }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      {/* List */}
      <div className="px-4 pt-2 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-2">🗓️</div>
            <p className="font-medium">No open games right now</p>
            <p className="text-sm mt-1" style={{ color: "var(--tg-hint)" }}>
              Be the first — host one!
            </p>
          </div>
        ) : (
          matches.map((m: any) => <MatchCard key={m.id} match={m} />)
        )}
      </div>

      <BottomNav />
    </div>
  );
}
