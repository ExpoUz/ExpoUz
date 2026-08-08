"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import {
  joinMatchAndPay,
  leaveMatch,
  isInsufficientBalanceError,
  insufficientBalanceInfo,
  isPhoneRequiredError,
  formatUZS,
  formatLevel,
  getSkillBand,
} from "@/lib/api";
import { usePhoneGate } from "@/lib/phone-gate";
import {
  showMainButton,
  hideMainButton,
  showBackButton,
  setMainButtonLoading,
  hapticSuccess,
  hapticError,
  hapticImpact,
  showAlert,
  isInTelegram,
} from "@/lib/telegram";
import { useAuth } from "@/lib/auth";
import { VersusPreview } from "./VersusPreview";
import { HostCard } from "./HostCard";
import { MatchChatRow } from "./MatchChatRow";
import { VenueMap } from "./VenueMap";

type Side = "A" | "B";

interface PadelPlayer {
  id: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  padelLevel?: number;
}

export function PadelMatchDetail({ match }: { match: any }) {
  const router = useRouter();
  const id = String(match.id);
  const qc = useQueryClient();
  const { user } = useAuth();
  const { requirePhone } = usePhoneGate();
  const t = useTranslations("matches");
  const tHome = useTranslations("home");
  const tBands = useTranslations("levels.bands");

  // Render the in-page reserve button only outside Telegram (inside Telegram the
  // native Main Button is used). Resolved after mount to avoid SSR mismatch.
  const [showFallbackBar, setShowFallbackBar] = useState(false);
  useEffect(() => setShowFallbackBar(!isInTelegram()), []);

  const perSide = match.format === "2v2" ? 2 : 1;
  const isCancelled = match.status === "CANCELLED";
  const isCompetitive = match.matchType !== "CASUAL";
  const startsWithin24h =
    (new Date(match.startTime).getTime() - Date.now()) / (1000 * 60 * 60) <= 24 &&
    new Date(match.startTime).getTime() > Date.now();

  // Bucket active bookings into Team A (HOME) and Team B (AWAY). Unassigned
  // bookings fill A then B so every player has a visible slot.
  const { teamA, teamB, mySide } = useMemo(() => {
    const bookings: { teamSide: string | null; user: PadelPlayer }[] = match.bookings ?? [];
    const a: PadelPlayer[] = [];
    const b: PadelPlayer[] = [];
    const unassigned: PadelPlayer[] = [];
    for (const bk of bookings) {
      if (bk.teamSide === "HOME") a.push(bk.user);
      else if (bk.teamSide === "AWAY") b.push(bk.user);
      else unassigned.push(bk.user);
    }
    for (const p of unassigned) {
      if (a.length < perSide) a.push(p);
      else b.push(p);
    }
    const mine = user
      ? a.some((p) => p.id === user.id)
        ? "A"
        : b.some((p) => p.id === user.id)
          ? "B"
          : null
      : null;
    return { teamA: a, teamB: b, mySide: mine as Side | null };
  }, [match.bookings, perSide, user]);

  // Padded slot arrays (player | null) for the VS preview.
  const padTeam = (t: PadelPlayer[]) =>
    [...t.slice(0, perSide), ...Array(Math.max(0, perSide - t.length)).fill(null)].slice(0, perSide);
  const padA = padTeam(teamA);
  const padB = padTeam(teamB);

  const filled = teamA.length + teamB.length;
  const available = Math.max(0, match.maxPlayers - filled);
  const isFull = filled >= match.maxPlayers;
  const joined = mySide != null;

  // ── Level gate state ──
  const [gate, setGate] = useState<null | "confirm" | "blocked">(null);
  const [pendingSide, setPendingSide] = useState<Side | null>(null);
  const hasRange = match.minLevel != null || match.maxLevel != null;
  const myPadelLevel = Number(user?.padelLevel ?? 0);
  const myBand = getSkillBand(myPadelLevel);
  const outOfRange =
    (match.minLevel != null && myPadelLevel < match.minLevel) ||
    (match.maxLevel != null && myPadelLevel > match.maxLevel);

  const join = useMutation({
    mutationFn: (side: Side) =>
      joinMatchAndPay(
        id,
        { teamSide: side === "A" ? "HOME" : "AWAY" },
        match.pricePerPlayer,
      ),
    onMutate: () => setMainButtonLoading(true),
    onSuccess: () => {
      hapticSuccess();
      qc.invalidateQueries({ queryKey: ["tma-match", id] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: async (e: any) => {
      hapticError();
      const code = e?.response?.data?.code;
      if (isPhoneRequiredError(e)) {
        if (await requirePhone()) join.mutate(pendingSide ?? "A");
        return;
      }
      if (code === "PADEL_LEVEL_REQUIRED") {
        router.push(`/onboarding?next=/match/${id}`);
        return;
      }
      if (isInsufficientBalanceError(e)) {
        const info = insufficientBalanceInfo(e);
        showAlert(
          info
            ? `${t("insufficientPlace")}\n${formatUZS(info.needed)} · ${t("yourWallet", { balance: formatUZS(info.balance) })}`
            : t("insufficientPlace"),
        );
        router.push("/wallet");
        return;
      }
      showAlert(e?.response?.data?.message ?? t("couldNotJoin"));
    },
    onSettled: () => setMainButtonLoading(false),
  });

  const leave = useMutation({
    mutationFn: () => leaveMatch(id),
    onMutate: () => setMainButtonLoading(true),
    onSuccess: () => {
      hapticSuccess();
      qc.invalidateQueries({ queryKey: ["tma-match", id] });
    },
    onError: (e: any) => {
      hapticError();
      showAlert(e?.response?.data?.message ?? t("couldNotLeave"));
    },
    onSettled: () => setMainButtonLoading(false),
  });

  // Level gate runs before any join. Routes to onboarding if unassessed, blocks
  // if out of range, otherwise asks for a one-tap level confirmation.
  async function handleJoin(side: Side) {
    if (joined || isFull || isCancelled) return;
    // A verified phone is required before booking — venues must be able to
    // reach players if a game changes. Prompt now; abort if dismissed.
    if (!(await requirePhone())) return;
    if (!user?.padelInitialSet) {
      hapticImpact("light");
      router.push(`/onboarding?next=/match/${id}`);
      return;
    }
    if (hasRange && outOfRange) {
      hapticImpact("medium");
      setGate("blocked");
      return;
    }
    setPendingSide(side);
    setGate("confirm");
  }

  // Reserve picks the team with an opening.
  const reserve = () => {
    if (teamA.length < perSide) handleJoin("A");
    else if (teamB.length < perSide) handleJoin("B");
  };

  useEffect(() => {
    const cleanup = showBackButton(() => router.back());
    return cleanup;
  }, [router]);

  useEffect(() => {
    let cleanup = () => {};
    if (isCancelled) {
      hideMainButton();
    } else if (joined) {
      cleanup = showMainButton(`${t("youreInTeam", { team: mySide ?? "" })} · ${t("tapToLeave")}`, () => leave.mutate(), "#FF5252");
    } else if (isFull) {
      hideMainButton();
    } else {
      cleanup = showMainButton(t("reserve", { price: formatUZS(match.pricePerPlayer) }), reserve);
    }
    return () => {
      cleanup();
      hideMainButton();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, isFull, isCancelled, mySide]);

  const genderLabel = match.isCoEd ? t("mixed") : t("singleGender");
  const levelLabel =
    match.minLevel != null || match.maxLevel != null
      ? `${formatLevel(match.minLevel ?? 0)} – ${formatLevel(match.maxLevel ?? 7)}`
      : t("allLevels");
  return (
    <div className="min-h-screen pb-28">
      {/* Court-tinted banner */}
      <div className="h-20" style={{ background: "linear-gradient(135deg, #0EA5E9 0%, #00B0FF 100%)" }} />

      <div className="px-4 -mt-10 space-y-4">
        {isCancelled && (
          <div className="rounded-2xl p-3 text-sm font-semibold text-white" style={{ background: "#FF5252" }}>
            {t("matchCancelled")}
          </div>
        )}

        {!isCancelled && startsWithin24h && (
          <div
            className="rounded-xl px-3 py-2 text-[13px] font-medium"
            style={{ background: "rgba(245,158,11,0.15)", color: "#B45309" }}
          >
            {t("registrationEndsSoon")}
          </div>
        )}

        {/* Info card */}
        <div className="rounded-2xl p-4" style={{ background: "var(--tg-card)" }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold">🎾 PADEL</div>
              <div className="text-base font-semibold mt-1">
                {dayjs(match.startTime).format("dddd, MMMM D")}
              </div>
              <div className="text-sm" style={{ color: "var(--tg-hint)" }}>
                {dayjs(match.startTime).format("h:mm a")} –{" "}
                {dayjs(match.startTime).add(match.durationMinutes ?? 60, "minute").format("h:mm a")}
              </div>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold"
              style={{
                background: isFull ? "rgba(239,68,68,0.12)" : "rgba(0,200,83,0.12)",
                color: isFull ? "#EF4444" : "#00C853",
              }}
            >
              {isFull ? t("matchFull") : t("spotAvailable", { count: available })}
            </span>
          </div>
          <div className="h-px my-3" style={{ background: "rgba(0,0,0,0.08)" }} />
          <div className="grid grid-cols-3 gap-2 text-center">
            <InfoCol label={t("gender")} value={genderLabel} />
            <InfoCol label={t("level")} value={levelLabel} />
            <InfoCol label={t("price")} value={formatUZS(match.pricePerPlayer)} />
          </div>
        </div>

        {/* Status row */}
        <div className="flex gap-2">
          <StatusPill
            text={match.isPrivate ? t("private") : t("openMatch")}
            icon={match.isPrivate ? "🔒" : "🔓"}
          />
          <StatusPill
            text={match.courtReserved ? t("courtReserved") : t("courtPending")}
            icon={match.courtReserved ? "✅" : "⏳"}
            good={!!match.courtReserved}
          />
        </div>

        {/* Match-type card */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: isCompetitive ? "rgba(239,68,68,0.08)" : "rgba(0,176,255,0.08)",
          }}
        >
          <div className="font-bold text-sm" style={{ color: isCompetitive ? "#EF4444" : "#00B0FF" }}>
            {isCompetitive ? tHome("competitive") : tHome("casual")}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--tg-hint)" }}>
            {isCompetitive ? t("competitiveDesc") : t("casualDesc")}
          </div>
        </div>

        {/* Versus preview */}
        <VersusPreview teamA={padA} teamB={padB} />

        {/* Host card */}
        <HostCard host={match.host} matchId={id} sport="PADEL" isViewerHost={user?.id === match.hostId} />

        {/* Players — Team A / Team B */}
        <div>
          <div className="flex items-baseline justify-between mb-2 px-1">
            <div className="text-sm font-semibold">{t("players")}</div>
            <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
              {t("joinedOpen", { joined: filled, max: match.maxPlayers, open: available })}
            </div>
          </div>
          <div className="rounded-2xl p-4 flex items-stretch" style={{ background: "var(--tg-card)" }}>
            <PadelTeam side="A" players={teamA} perSide={perSide} disabled={isCancelled || isFull} onJoin={() => handleJoin("A")} onTapPlayer={(pid) => router.push(`/players/${pid}`)} />
            <div className="w-px mx-2" style={{ background: "rgba(0,0,0,0.08)" }} />
            <PadelTeam side="B" players={teamB} perSide={perSide} disabled={isCancelled || isFull} onJoin={() => handleJoin("B")} onTapPlayer={(pid) => router.push(`/players/${pid}`)} />
          </div>
        </div>

        {/* Match chat */}
        <MatchChatRow matchId={id} />

        {/* Where you'll play — static map + amenities */}
        <VenueMap pitch={match.pitch} />

        {/* Fallback sticky reserve bar (when not inside Telegram) */}
        {!isCancelled && showFallbackBar && (
          <button
            type="button"
            onClick={() => {
              hapticImpact("medium");
              if (joined) leave.mutate();
              else if (!isFull) reserve();
            }}
            disabled={isFull && !joined}
            className="w-full rounded-2xl py-3.5 text-sm font-bold text-white"
            style={{ background: joined ? "#FF5252" : isFull ? "#9CA3AF" : "#00C853" }}
          >
            {joined
              ? `${t("youreInTeam", { team: mySide ?? "" })} · ${t("tapToLeave")}`
              : isFull
                ? t("matchFull")
                : t("reserve", { price: formatUZS(match.pricePerPlayer) })}
          </button>
        )}
      </div>

      {/* ── Level gate modals ── */}
      {gate === "confirm" && (
        <GateSheet onClose={() => setGate(null)}>
          <div className="text-center">
            <div className="text-xs" style={{ color: "var(--tg-hint)" }}>{t("yourPadelLevel")}</div>
            <div className="text-4xl font-black my-1" style={{ color: myBand.color }}>
              {formatLevel(myPadelLevel)}
            </div>
            <div className="text-sm font-bold" style={{ color: myBand.color }}>{tBands(myBand.key)}</div>
            <p className="text-xs mt-3" style={{ color: "var(--tg-hint)" }}>
              {t("youllJoinTeam", { team: pendingSide ?? "" })}
            </p>
          </div>
          <button
            onClick={() => {
              hapticImpact("medium");
              setGate(null);
              join.mutate(pendingSide ?? "A");
            }}
            className="mt-4 w-full rounded-2xl py-3.5 font-bold text-white"
            style={{ background: "#00C853" }}
          >
            {t("confirmContinue")}
          </button>
          <button
            onClick={() => router.push(`/onboarding?next=/match/${id}`)}
            className="mt-2 w-full text-sm font-semibold"
            style={{ color: "var(--tg-hint)" }}
          >
            {t("updateMyLevel")}
          </button>
        </GateSheet>
      )}

      {gate === "blocked" && (
        <GateSheet onClose={() => setGate(null)}>
          <div className="text-center">
            <div className="text-4xl mb-2">🎾</div>
            <h2 className="text-lg font-bold">
              {t("forLevel", { min: formatLevel(match.minLevel ?? 0), max: formatLevel(match.maxLevel ?? 7) })}
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--tg-hint)" }}>
              {t("yourLevelIs", { level: formatLevel(myPadelLevel) })}
            </p>
          </div>
          <button
            onClick={() => {
              hapticImpact("light");
              router.push(`/?sport=PADEL`);
            }}
            className="mt-4 w-full rounded-2xl py-3.5 font-bold text-white"
            style={{ background: "#00B0FF" }}
          >
            {t("findForMyLevel")}
          </button>
          <button
            onClick={() => setGate(null)}
            className="mt-2 w-full text-sm font-semibold"
            style={{ color: "var(--tg-hint)" }}
          >
            {t("goBack")}
          </button>
        </GateSheet>
      )}
    </div>
  );
}

function GateSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl p-5 pb-8"
        style={{ background: "var(--tg-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function InfoCol({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] mb-0.5" style={{ color: "var(--tg-hint)" }}>
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function StatusPill({ text, icon, good }: { text: string; icon: string; good?: boolean }) {
  return (
    <div
      className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
      style={{
        background: good ? "rgba(0,200,83,0.12)" : "var(--tg-card)",
        color: good ? "#00875A" : "var(--tg-text)",
      }}
    >
      <span>{icon}</span>
      {text}
    </div>
  );
}

function PadelTeam({
  side,
  players,
  perSide,
  disabled,
  onJoin,
  onTapPlayer,
}: {
  side: Side;
  players: PadelPlayer[];
  perSide: number;
  disabled: boolean;
  onJoin: () => void;
  onTapPlayer: (id: string) => void;
}) {
  const slots: (PadelPlayer | null)[] = [
    ...players.slice(0, perSide),
    ...Array(Math.max(0, perSide - players.length)).fill(null),
  ].slice(0, perSide);

  return (
    <div className="flex-1">
      <div className="flex items-center justify-center gap-3">
        {slots.map((p, i) =>
          p ? (
            <FilledSlot key={p.id} player={p} onClick={() => onTapPlayer(p.id)} />
          ) : (
            <EmptySlot key={`empty-${i}`} disabled={disabled} onClick={onJoin} />
          ),
        )}
      </div>
      <div className="text-center font-bold mt-2" style={{ color: "var(--tg-hint)" }}>
        {side}
      </div>
    </div>
  );
}

function FilledSlot({ player, onClick }: { player: PadelPlayer; onClick: () => void }) {
  const band = getSkillBand(Number(player.padelLevel ?? 0));
  const initial = (player.firstName?.[0] ?? "?").toUpperCase();
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 w-14">
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-base font-bold overflow-hidden">
          {player.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <span
          className="absolute -bottom-1 -right-1 text-[9px] font-bold text-white rounded px-1 leading-tight"
          style={{ background: band.color }}
        >
          {Number(player.padelLevel ?? 0).toFixed(1)}
        </span>
      </div>
      <span className="text-[11px] truncate max-w-full">{player.firstName ?? "Player"}</span>
    </button>
  );
}

function EmptySlot({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-1 w-14 disabled:opacity-40"
    >
      <div
        className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center text-xl"
        style={{ borderColor: "rgba(0,176,255,0.4)", color: "#00B0FF" }}
      >
        +
      </div>
      <span className="text-[11px] font-semibold text-[#00B0FF] leading-tight">Join</span>
      <span className="text-[9px]" style={{ color: "var(--tg-hint)" }}>
        Available
      </span>
    </button>
  );
}
