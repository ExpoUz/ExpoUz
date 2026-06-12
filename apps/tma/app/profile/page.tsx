"use client";

import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import Link from "next/link";
import { getMe, getStatistics, getMyBookings, getSkillBand, formatLevel } from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { LevelChart } from "@/components/LevelChart";
import { SkillBadge } from "@/components/SkillBadge";
import { useAuth } from "@/lib/auth";
import { hideMainButton } from "@/lib/telegram";
import { useEffect } from "react";

const HAND_LABEL: Record<string, string> = { LEFT: "Left ✋", RIGHT: "Right ✋" };
const POS_LABEL: Record<string, string> = { FOREHAND: "Forehand", BACKHAND: "Backhand", BOTH: "Both sides" };

export default function ProfilePage() {
  const { user: cached } = useAuth();

  useEffect(() => {
    hideMainButton();
  }, []);

  const { data: me } = useQuery({ queryKey: ["tma-me"], queryFn: getMe, initialData: cached });
  const { data: stats } = useQuery({
    queryKey: ["tma-statistics", me?.id],
    queryFn: () => getStatistics(me!.id),
    enabled: !!me?.id,
  });
  const { data: bookings } = useQuery({ queryKey: ["tma-bookings"], queryFn: getMyBookings });

  const initials = `${me?.firstName?.[0] ?? ""}${me?.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const level = stats?.level ?? me?.skillRating ?? 0;
  const band = getSkillBand(Number(level));
  const reliability = stats?.reliability ?? me?.levelReliability ?? 0;
  const effectiveness = stats?.effectiveness ?? 0;
  const streak = stats?.currentStreak ?? 0;

  return (
    <div className="min-h-screen pb-24">
      {/* Header card */}
      <div className="px-4 pt-6">
        <div className="rounded-3xl p-4 flex items-center gap-4" style={{ background: "var(--tg-card)" }}>
          <div className="w-16 h-16 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-xl font-bold overflow-hidden shrink-0">
            {me?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold truncate">
              {me?.firstName} {me?.lastName}
            </h1>
            <div className="mt-1">
              <SkillBadge level={level} size="md" showLabel />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
                <div className="h-full rounded-full" style={{ width: `${reliability}%`, background: band.color }} />
              </div>
              <span className="text-[11px] font-semibold" style={{ color: "var(--tg-hint)" }}>
                {reliability}% reliable
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Level chart */}
      <div className="px-4 mt-5">
        <SectionTitle>Level Progression</SectionTitle>
        <LevelChart history={stats?.levelHistory ?? []} />
      </div>

      {/* Stats cards row */}
      <div className="px-4 mt-5 grid grid-cols-4 gap-2">
        <StatCard value={stats?.matchesPlayed ?? 0} label="Played" />
        <StatCard value={stats?.matchesWon ?? 0} label="Won" />
        <StatCard value={stats?.matchesLost ?? 0} label="Lost" />
        <StatCard value={`${effectiveness}%`} label="Win %" />
      </div>

      {/* Effectiveness donut + streak */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 flex flex-col items-center" style={{ background: "var(--tg-card)" }}>
          <Donut percent={effectiveness} />
          <div className="text-[11px] mt-2" style={{ color: "var(--tg-hint)" }}>
            {stats?.matchesWon ?? 0}W · {stats?.matchesLost ?? 0}L
          </div>
        </div>
        <div className="rounded-2xl p-4 flex flex-col justify-center" style={{ background: "var(--tg-card)" }}>
          <div className="text-2xl font-bold">
            {streak > 0 ? `🔥 ${streak}` : streak < 0 ? `❄️ ${Math.abs(streak)}` : "—"}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--tg-hint)" }}>
            {streak > 0 ? "match win streak" : streak < 0 ? "match losing streak" : "no active streak"}
          </div>
          <div className="text-[11px] mt-2" style={{ color: "var(--tg-hint)" }}>
            Longest: {stats?.longestWinStreak ?? 0} wins
          </div>
        </div>
      </div>

      {/* Preferences */}
      {stats?.preferences && (
        <div className="px-4 mt-5">
          <SectionTitle>Preferences</SectionTitle>
          <div className="rounded-2xl divide-y" style={{ background: "var(--tg-card)" }}>
            <PrefRow label="Best hand" value={HAND_LABEL[stats.preferences.bestHand] ?? "—"} />
            <PrefRow label="Court position" value={POS_LABEL[stats.preferences.courtPosition] ?? "—"} />
            <PrefRow
              label="Preferred"
              value={stats.preferences.preferredMatchType === "CASUAL" ? "😎 Casual" : "⚔️ Competitive"}
            />
          </div>
        </div>
      )}

      {/* Recent partners */}
      <PlayerStrip title="Recent Partners" players={stats?.recentPartners} />
      <PlayerStrip title="Recent Opponents" players={stats?.recentOpponents} />

      {/* Clubs played */}
      {(stats?.recentClubs ?? []).length > 0 && (
        <div className="px-4 mt-5">
          <SectionTitle>Clubs Played</SectionTitle>
          <div className="rounded-2xl divide-y" style={{ background: "var(--tg-card)" }}>
            {stats!.recentClubs.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
                  {c.visits} {c.visits === 1 ? "visit" : "visits"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My games */}
      <div className="px-4 mt-6">
        <SectionTitle>My Games</SectionTitle>
        <div className="space-y-2">
          {(bookings ?? []).length === 0 ? (
            <div className="rounded-2xl py-10 text-center text-sm" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
              You haven&apos;t joined any games yet.
            </div>
          ) : (
            (bookings ?? []).map((b: any) => {
              const match = b.match ?? b;
              return (
                <Link
                  key={b.id}
                  href={match?.id ? `/match/${match.id}` : "#"}
                  className="block rounded-2xl p-3"
                  style={{ background: "var(--tg-card)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{match?.pitch?.name ?? match?.title ?? "Match"}</div>
                      <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
                        {match?.startTime ? dayjs(match.startTime).format("ddd, MMM D · HH:mm") : ""}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#00875A] shrink-0">
                      {b.status?.replace(/_/g, " ")}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold mb-2 px-1">{children}</div>;
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl py-3 text-center" style={{ background: "var(--tg-card)" }}>
      <div className="text-lg font-bold text-[#00C853]">{value}</div>
      <div className="text-[10px] mt-0.5" style={{ color: "var(--tg-hint)" }}>
        {label}
      </div>
    </div>
  );
}

function Donut({ percent }: { percent: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const filled = (percent / 100) * c;
  return (
    <svg viewBox="0 0 90 90" className="w-24 h-24">
      <circle cx={45} cy={45} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={9} />
      <circle
        cx={45}
        cy={45}
        r={r}
        fill="none"
        stroke="#00C853"
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`}
        transform="rotate(-90 45 45)"
      />
      <text x={45} y={50} textAnchor="middle" fontSize={18} fontWeight={700} fill="var(--tg-text)">
        {percent}%
      </text>
    </svg>
  );
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm" style={{ color: "var(--tg-hint)" }}>
        {label}
      </span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function PlayerStrip({ title, players }: { title: string; players?: any[] }) {
  if (!players || players.length === 0) return null;
  return (
    <div className="px-4 mt-5">
      <SectionTitle>{title}</SectionTitle>
      <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1">
        {players.map((p) => (
          <Link key={p.id} href={`/players/${p.id}`} className="flex flex-col items-center gap-1 w-16 shrink-0">
            <div className="w-12 h-12 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-sm font-bold overflow-hidden">
              {p.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (p.firstName?.[0] ?? "?").toUpperCase()
              )}
            </div>
            <span className="text-[11px] font-medium truncate max-w-full">{p.firstName}</span>
            <span className="text-[10px] font-bold" style={{ color: getSkillBand(Number(p.skillRating ?? 0)).color }}>
              {formatLevel(p.skillRating)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
