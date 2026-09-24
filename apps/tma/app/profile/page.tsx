"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import Link from "next/link";
import { Wallet, Smartphone, Lock, Flame, Snowflake, ChevronRight } from "lucide-react";
import {
  getMe,
  getStatistics,
  getMyBookings,
  getSkillBand,
  formatLevel,
  LEVEL_META,
} from "@/lib/api";
import { useTranslations } from "next-intl";
import { BottomNav } from "@/components/BottomNav";
import { LevelChart } from "@/components/LevelChart";
import { SkillBadge } from "@/components/SkillBadge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/lib/auth";
import { usePhoneGate } from "@/lib/phone-gate";
import { useSportStore, type Sport } from "@/lib/sport-store";
import { SIMPLE_MODE } from "@/lib/flags";
import { hideMainButton, hapticImpact } from "@/lib/telegram";
import { useEffect } from "react";

const FOOTBALL_SKILL: Record<string, { label: string; color: string }> = {
  BEGINNER: { label: "Beginner", color: "#34D399" },
  AMATEUR: { label: "Amateur", color: "#00B0FF" },
  PRO: { label: "Pro", color: "#F59E0B" },
};

export default function ProfilePage() {
  const { user: cached } = useAuth();
  const { phoneVerified, openPhonePrompt } = usePhoneGate();
  const { sport: storeSport } = useSportStore();
  const [tab, setTab] = useState<Sport>(storeSport);
  const t = useTranslations("profile");
  const tw = useTranslations("wallet");
  const tPhone = useTranslations("phone");
  const tSports = useTranslations("sports");

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

      {/* Phone verification nudge (only while unverified) */}
      {!phoneVerified && (
        <div className="px-4 mt-3">
          <button
            onClick={() => {
              hapticImpact("light");
              openPhonePrompt();
            }}
            className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:opacity-80"
            style={{ background: "rgba(0,176,255,0.1)", border: "1px solid rgba(0,176,255,0.25)" }}
          >
            <Smartphone size={22} className="shrink-0" style={{ color: "#00B0FF" }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{tPhone("nudgeTitle")}</div>
              <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
                {tPhone("nudgeSub")}
              </div>
            </div>
            <span className="text-xs font-semibold text-[#00875A] shrink-0">{tPhone("add")}</span>
          </button>
        </div>
      )}

      {/* Wallet quick-link */}
      {!SIMPLE_MODE && (
      <div className="px-4 mt-3">
        <Link
          href="/wallet"
          onClick={() => hapticImpact("light")}
          className="flex items-center gap-3 rounded-2xl p-4 active:opacity-80"
          style={{ background: "var(--tg-card)" }}
        >
          <Wallet size={22} className="shrink-0" style={{ color: "var(--tg-hint)" }} />
          <div className="flex-1">
            <div className="text-sm font-semibold">{tw("title")}</div>
            <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
              {tw("balance")} &amp; {tw("history")}
            </div>
          </div>
          <ChevronRight size={18} style={{ color: "var(--tg-hint)" }} />
        </Link>
      </div>
      )}

      {/* Sport tabs */}
      <div className="px-4 mt-4">
        <div className="flex gap-2 rounded-2xl p-1" style={{ background: "var(--tg-card)" }}>
          <SportTab active={tab === "FOOTBALL"} label={tSports("football")} onClick={() => { hapticImpact("light"); setTab("FOOTBALL"); }} />
          <SportTab active={tab === "PADEL"} label={tSports("padel")} onClick={() => { hapticImpact("light"); setTab("PADEL"); }} />
        </div>
      </div>

      {/* Skill level / ELO surfaces — hidden in SIMPLE_MODE. */}
      {!SIMPLE_MODE && (isPadel ? <PadelProfile me={me} stats={stats} /> : <FootballProfile me={me} />)}

      {/* My games (filtered to the active sport) */}
      <MyGames bookings={bookings} sport={tab} />

      {/* Venue privacy transparency */}
      <div className="px-4 mt-6">
        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--tg-hint)" }}>
          {t("venuePrivacyTitle")}
        </div>
        <div className="rounded-2xl p-4 text-xs leading-relaxed flex gap-2" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
          <Lock size={14} className="shrink-0 mt-0.5" />
          <span>{t("venuePrivacyBody")}</span>
        </div>
      </div>

      {/* Language */}
      <div className="px-4 mt-6">
        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--tg-hint)" }}>
          {t("language")}
        </div>
        <LanguageSwitcher />
      </div>

      <BottomNav />
    </div>
  );
}

// ─── PADEL TAB ────────────────────────────────────────────────────────────────
function PadelProfile({ me, stats }: { me: any; stats: any }) {
  const t = useTranslations("profile");
  const tStatus = useTranslations("status");
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
              {t("reliable", { percent: reliability })}
            </span>
          </div>
        </div>
      </div>

      {/* Level chart */}
      <div className="px-4 mt-5">
        <SectionTitle>{t("levelProgression")}</SectionTitle>
        <LevelChart history={stats?.levelHistory ?? []} />
      </div>

      {/* Stats cards row */}
      <div className="px-4 mt-5 grid grid-cols-4 gap-2">
        <StatCard value={stats?.matchesPlayed ?? 0} label={t("played")} />
        <StatCard value={stats?.matchesWon ?? 0} label={t("won")} />
        <StatCard value={stats?.matchesLost ?? 0} label={t("lost")} />
        <StatCard value={`${effectiveness}%`} label={t("winPct")} />
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
          <div className="text-2xl font-bold flex items-center gap-1.5">
            {streak > 0 ? (
              <>
                <Flame size={22} style={{ color: "#F59E0B" }} /> {streak}
              </>
            ) : streak < 0 ? (
              <>
                <Snowflake size={22} style={{ color: "#00B0FF" }} /> {Math.abs(streak)}
              </>
            ) : (
              "—"
            )}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--tg-hint)" }}>
            {streak > 0 ? t("winStreak") : streak < 0 ? t("losingStreak") : t("noStreak")}
          </div>
          <div className="text-[11px] mt-2" style={{ color: "var(--tg-hint)" }}>
            {t("longestWins", { count: stats?.longestWinStreak ?? 0 })}
          </div>
        </div>
      </div>

      {/* Preferences */}
      {stats?.preferences && (
        <div className="px-4 mt-5">
          <SectionTitle>{t("preferences")}</SectionTitle>
          <div className="rounded-2xl divide-y" style={{ background: "var(--tg-card)" }}>
            <PrefRow label={t("bestHand")} value={stats.preferences.bestHand ? t(`hand_${stats.preferences.bestHand}`) : "—"} />
            <PrefRow label={t("courtPosition")} value={stats.preferences.courtPosition ? t(`pos_${stats.preferences.courtPosition}`) : "—"} />
            <PrefRow
              label={t("preferred")}
              value={stats.preferences.preferredMatchType === "CASUAL" ? tStatus("CASUAL") : tStatus("COMPETITIVE")}
            />
          </div>
        </div>
      )}

      {/* Recent partners / opponents */}
      <PlayerStrip title={t("recentPartners")} players={stats?.recentPartners} />
      <PlayerStrip title={t("recentOpponents")} players={stats?.recentOpponents} />

      {/* Clubs played */}
      {(stats?.recentClubs ?? []).length > 0 && (
        <div className="px-4 mt-5">
          <SectionTitle>{t("clubsPlayed")}</SectionTitle>
          <div className="rounded-2xl divide-y" style={{ background: "var(--tg-card)" }}>
            {stats!.recentClubs.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
                  {t("visits", { count: c.visits })}
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
  const t = useTranslations("profile");
  const tRanks = useTranslations("levels.ranks");
  const tFootball = useTranslations("levels.football");
  const skill = FOOTBALL_SKILL[me?.skillLevel] ?? { label: me?.skillLevel ?? "—", color: "#9CA3AF" };
  const skillLabel = me?.skillLevel && ["BEGINNER", "AMATEUR", "PRO"].includes(me.skillLevel)
    ? tFootball(me.skillLevel)
    : skill.label;
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
                {skillLabel}
              </span>
              <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--tg-hint)" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: playerMeta.color }} />
                {tRanks(me?.playerLevel ?? "NEW")}
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
              {t("reliable", { percent: reliability })}
            </span>
          </div>
        </div>
      </div>

      {/* Football stats */}
      <div className="px-4 mt-5 grid grid-cols-3 gap-2">
        <StatCard value={me?.gamesAttended ?? 0} label={t("gamesPlayed")} />
        <StatCard value={me?.gamesThisMonth ?? 0} label={t("thisMonth")} />
        <StatCard value={me?.winCount ?? 0} label={t("wins")} />
      </div>

      <div className="px-4 mt-5">
        <div className="rounded-2xl p-4 text-xs" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
          {t("footballExplain")}
        </div>
      </div>
    </>
  );
}

// ─── My games (sport-filtered) ───────────────────────────────────────────────
function MyGames({ bookings, sport }: { bookings: any[] | undefined; sport: Sport }) {
  const t = useTranslations("profile");
  const filtered = (bookings ?? []).filter((b: any) => {
    const s = (b.match ?? b)?.sport;
    // Older bookings may not carry sport — show them under padel (the default).
    return s ? s === sport : sport === "PADEL";
  });

  return (
    <div className="px-4 mt-6">
      <SectionTitle>{sport === "FOOTBALL" ? t("myFootballGames") : t("myPadelGames")}</SectionTitle>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-2xl py-10 text-center text-sm" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
            {t("noGames")}
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

function SportTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center rounded-xl py-2 text-sm font-semibold transition-colors"
      style={{
        background: active ? "#00C853" : "transparent",
        color: active ? "#fff" : "var(--tg-hint)",
      }}
    >
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
