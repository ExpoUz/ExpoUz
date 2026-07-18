"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import Link from "next/link";
import {
  getMe,
  getStatistics,
  getMyBookings,
  getSkillBand,
  formatLevel,
  LEVEL_META,
} from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { LevelChart } from "@/components/LevelChart";
import { SkillBadge } from "@/components/SkillBadge";
import { useAuth } from "@/lib/auth";
import { useSportStore, type Sport } from "@/lib/sport-store";
import { hideMainButton, hapticImpact } from "@/lib/telegram";
import { useEffect } from "react";

const HAND_LABEL: Record<string, string> = { LEFT: "Left ✋", RIGHT: "Right ✋" };
const POS_LABEL: Record<string, string> = { FOREHAND: "Forehand", BACKHAND: "Backhand", BOTH: "Both sides" };
const FOOTBALL_SKILL: Record<string, { label: string; color: string }> = {
  BEGINNER: { label: "Beginner", color: "#34D399" },
  AMATEUR: { label: "Amateur", color: "#00B0FF" },
  PRO: { label: "Pro", color: "#F59E0B" },
};

export default function ProfilePage() {
  const { user: cached } = useAuth();
  const { sport: storeSport } = useSportStore();
  const [tab, setTab] = useState<Sport>(storeSport);

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
  const isPadel = tab === "PADEL";

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
            <div className="text-xs mt-0.5" style={{ color: "var(--tg-hint)" }}>
              {me?.city ?? "Tashkent"}
              {me?.district ? ` · ${me.district}` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Wallet quick-link */}
      <div className="px-4 mt-3">
        <Link
          href="/wallet"
          onClick={() => hapticImpact("light")}
          className="flex items-center gap-3 rounded-2xl p-4 active:opacity-80"
          style={{ background: "var(--tg-card)" }}
        >
          <div className="text-xl">👛</div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Wallet</div>
            <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
              Balance &amp; transaction history
            </div>
          </div>
          <span style={{ color: "var(--tg-hint)" }}>›</span>
        </Link>
      </div>

      {/* Sport tabs */}
      <div className="px-4 mt-4">
        <div className="flex gap-2 rounded-2xl p-1" style={{ background: "var(--tg-card)" }}>
          <SportTab active={tab === "FOOTBALL"} icon="⚽" label="Football" onClick={() => { hapticImpact("light"); setTab("FOOTBALL"); }} />
          <SportTab active={tab === "PADEL"} icon="🎾" label="Padel" onClick={() => { hapticImpact("light"); setTab("PADEL"); }} />
        </div>
      </div>

      {isPadel ? <PadelProfile me={me} stats={stats} /> : <FootballProfile me={me} />}

      {/* My games (filtered to the active sport) */}
      <MyGames bookings={bookings} sport={tab} />

      <BottomNav />
    </div>
  );
}

// ─── PADEL TAB ────────────────────────────────────────────────────────────────
function PadelProfile({ me, stats }: { me: any; stats: any }) {
  const level = stats?.level ?? me?.padelLevel ?? 0;
  const band = getSkillBand(Number(level));
  const reliability = stats?.reliability ?? me?.padelReliability ?? 0;
  const effectiveness = stats?.effectiveness ?? 0;
  const streak = stats?.currentStreak ?? 0;

  return (
    <>
      {/* Level summary */}
      <div className="px-4 mt-4">
        <div className="rounded-2xl p-4" style={{ background: "var(--tg-card)" }}>
          <SkillBadge level={level} size="md" showLabel />
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

      {/* Recent partners / opponents */}
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
    </>
  );
}

// ─── FOOTBALL TAB ─────────────────────────────────────────────────────────────
function FootballProfile({ me }: { me: any }) {
  const skill = FOOTBALL_SKILL[me?.skillLevel] ?? { label: me?.skillLevel ?? "—", color: "#9CA3AF" };
  const playerMeta = LEVEL_META[me?.playerLevel] ?? LEVEL_META.NEW;
  const reliability = Math.round(Number(me?.reliabilityScore ?? 0));

  return (
    <>
      {/* Skill level summary */}
      <div className="px-4 mt-4">
        <div className="rounded-2xl p-4" style={{ background: "var(--tg-card)" }}>
          <div className="flex items-center justify-between">
            <div>
              <span
                className="inline-block px-2.5 py-1 rounded-full text-xs font-bold text-white"
                style={{ background: skill.color }}
              >
                {skill.label}
              </span>
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--tg-hint)" }}>
                {playerMeta.icon} {playerMeta.label}
              </span>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-[#00C853]">{me?.eloRating ?? 1000}</div>
              <div className="text-[10px]" style={{ color: "var(--tg-hint)" }}>ELO</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
              <div className="h-full rounded-full" style={{ width: `${reliability}%`, background: skill.color }} />
            </div>
            <span className="text-[11px] font-semibold" style={{ color: "var(--tg-hint)" }}>
              {reliability}% reliable
            </span>
          </div>
        </div>
      </div>

      {/* Football stats */}
      <div className="px-4 mt-5 grid grid-cols-3 gap-2">
        <StatCard value={me?.gamesAttended ?? 0} label="Games played" />
        <StatCard value={me?.gamesThisMonth ?? 0} label="This month" />
        <StatCard value={me?.winCount ?? 0} label="Wins" />
      </div>

      <div className="px-4 mt-5">
        <div className="rounded-2xl p-4 text-xs" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
          Football tracks your skill level (Beginner → Pro), ELO from thumbs-up ratings, and games
          attended. Your padel level is tracked separately on the Padel tab.
        </div>
      </div>
    </>
  );
}

// ─── My games (sport-filtered) ───────────────────────────────────────────────
function MyGames({ bookings, sport }: { bookings: any[] | undefined; sport: Sport }) {
  const filtered = (bookings ?? []).filter((b: any) => {
    const s = (b.match ?? b)?.sport;
    // Older bookings may not carry sport — show them under padel (the default).
    return s ? s === sport : sport === "PADEL";
  });

  return (
    <div className="px-4 mt-6">
      <SectionTitle>My {sport === "FOOTBALL" ? "Football" : "Padel"} Games</SectionTitle>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-2xl py-10 text-center text-sm" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
            No {sport === "FOOTBALL" ? "football" : "padel"} games yet.
          </div>
        ) : (
          filtered.map((b: any) => {
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
  );
}

function SportTab({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors"
      style={{
        background: active ? "#00C853" : "transparent",
        color: active ? "#fff" : "var(--tg-hint)",
      }}
    >
      <span>{icon}</span>
      {label}
    </button>
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
            <span className="text-[10px] font-bold" style={{ color: getSkillBand(Number(p.padelLevel ?? 0)).color }}>
              {formatLevel(p.padelLevel)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
