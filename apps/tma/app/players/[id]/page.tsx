"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { MessageCircle } from "lucide-react";
import {
  getPlayerProfile,
  getPlayerRanking,
  getMe,
  startDirectConversation,
  LEVEL_META,
  getSkillBand,
  formatLevel,
} from "@/lib/api";
import { showBackButton, hapticImpact } from "@/lib/telegram";

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [opening, setOpening] = useState(false);

  const { data: p, isLoading } = useQuery({ queryKey: ["player", id], queryFn: () => getPlayerProfile(id) });
  const { data: ranking } = useQuery({ queryKey: ["player-rank", id], queryFn: () => getPlayerRanking(id) });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });

  const openChat = async () => {
    if (opening) return;
    setOpening(true);
    hapticImpact("light");
    try {
      const convo = await startDirectConversation(id);
      router.push(`/messages/${convo.id}`);
    } catch {
      setOpening(false);
    }
  };

  useEffect(() => {
    const cleanup = showBackButton(() => router.back());
    return cleanup;
  }, [router]);

  if (isLoading || !p) {
    return (
      <div className="min-h-screen flex justify-center pt-24">
        <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const lvl = LEVEL_META[p.playerLevel] ?? LEVEL_META.NEW;
  const initials = `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  return (
    <div className="min-h-screen pb-12 px-4 pt-6">
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-2xl font-bold overflow-hidden">
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <h1 className="text-xl font-bold mt-3">
          {p.firstName} {p.lastName}
        </h1>
        <div
          className="mt-1 px-3 py-1 rounded-full text-sm font-semibold"
          style={{ background: `${lvl.color}22`, color: lvl.color }}
        >
          {lvl.icon} {lvl.label}
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--tg-hint)" }}>
          Member since {dayjs(p.createdAt).format("MMM YYYY")}
          {p.city ? ` · ${p.district ?? p.city}` : ""}
        </p>

        {me && me.id !== id && (
          <button
            onClick={openChat}
            disabled={opening}
            className="mt-3 inline-flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-sm disabled:opacity-50"
            style={{ background: "#00C853", color: "#fff" }}
          >
            <MessageCircle size={16} />
            {opening ? "Opening…" : "Message"}
          </button>
        )}
      </div>

      {/* Football stats */}
      <div className="text-xs font-semibold mt-5 mb-2 px-1" style={{ color: "var(--tg-hint)" }}>⚽ Football</div>
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Games" value={p.gamesAttended ?? 0} />
        <Stat label="This mo." value={p.gamesThisMonth ?? 0} />
        <Stat label="ELO" value={p.eloRating ?? 1000} />
        <Stat label="Rated 👍" value={p.ratings?.thumbsUp ?? 0} />
      </div>

      {/* Padel stats (independent track) */}
      {(() => {
        const padelLevel = Number(p.padelLevel ?? 0);
        const assessed = !!p.padelInitialSet || padelLevel > 0;
        const band = getSkillBand(padelLevel);
        return (
          <>
            <div className="text-xs font-semibold mt-4 mb-2 px-1" style={{ color: "var(--tg-hint)" }}>🎾 Padel</div>
            {assessed ? (
              <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: "var(--tg-card)" }}>
                <div className="text-center">
                  <div className="text-3xl font-black" style={{ color: band.color }}>{formatLevel(padelLevel)}</div>
                  <div className="text-[11px] font-semibold" style={{ color: band.color }}>{band.label}</div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Played" value={p.padelMatchesPlayed ?? 0} />
                  <Stat label="Won" value={p.padelMatchesWon ?? 0} />
                  <Stat label="Reliable" value={`${p.padelReliability ?? 0}%`} />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-4 text-sm text-center" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
                Not assessed at padel yet
              </div>
            )}
          </>
        );
      })()}

      {/* Level progress */}
      {ranking && ranking.levelInfo?.nextAt != null && (
        <div className="rounded-2xl p-4 mt-4" style={{ background: "var(--tg-card)" }}>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold">Progress to next level</span>
            <span style={{ color: "var(--tg-hint)" }}>{ranking.gamesToNext} more</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${ranking.progressPct}%`, background: lvl.color }}
            />
          </div>
        </div>
      )}

      {/* Recent games */}
      {(p.recentMatches ?? []).length > 0 && (
        <div className="mt-5">
          <div className="text-sm font-semibold mb-2 px-1">Recent games</div>
          <div className="space-y-2">
            {p.recentMatches.map((b: any) => (
              <div key={b.id ?? b.match?.id} className="rounded-2xl p-3 flex items-center justify-between" style={{ background: "var(--tg-card)" }}>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{b.match?.title ?? "Match"}</div>
                  <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
                    {b.match?.pitch?.name}
                  </div>
                </div>
                <span className="text-xs shrink-0" style={{ color: "var(--tg-hint)" }}>
                  {b.match?.startTime ? dayjs(b.match.startTime).format("MMM D") : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {p.bio && (
        <div className="rounded-2xl p-4 mt-4 text-sm" style={{ background: "var(--tg-card)" }}>
          {p.bio}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl p-3 text-center" style={{ background: "var(--tg-card)" }}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[11px]" style={{ color: "var(--tg-hint)" }}>{label}</div>
    </div>
  );
}
