"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import {
  MapPin,
  Users,
  Clock,
  Shield,
  ChevronRight,
  Calendar,
  Share2,
  Copy,
  Megaphone,
  Building2,
  ClipboardList,
  Trophy,
  Crown,
  AlertTriangle,
  CheckCircle2,
  Plus,
  type LucideIcon,
} from "lucide-react";
import {
  joinMatchAndPay,
  leaveMatch,
  getShareLink,
  isInsufficientBalanceError,
  insufficientBalanceInfo,
  isPhoneRequiredError,
  formatUZS,
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
  shareToTelegram,
  copyToClipboard,
} from "@/lib/telegram";
import { useAuth } from "@/lib/auth";
import { HostCard } from "./HostCard";
import { MatchChatRow } from "./MatchChatRow";
import { VenueMap } from "./VenueMap";

const BOOKING_TYPE_META: Record<string, { Icon: LucideIcon; color: string }> = {
  OPEN_EVENT: { Icon: Megaphone, color: "#00C853" },
  GROUP_BOOKING: { Icon: Users, color: "#00B0FF" },
  FULL_BOOKING: { Icon: Building2, color: "#FF5252" },
};

export function FootballMatchDetail({ match }: { match: any }) {
  const router = useRouter();
  const id = String(match.id);
  const qc = useQueryClient();
  const { user } = useAuth();
  const { requirePhone } = usePhoneGate();
  const t = useTranslations("matches");
  const tc = useTranslations("common");
  const tBooking = useTranslations("bookingType");
  const searchParams = useSearchParams();
  const justCreated = searchParams.get("created") === "1";
  const [showCancel, setShowCancel] = useState(false);

  const isHost = !!user && (match.hostId === user.id || match.organizerId === user.id);
  const { data: share } = useQuery({
    queryKey: ["tma-share", id],
    queryFn: () => getShareLink(id),
    enabled: justCreated || isHost,
  });

  const hoursUntilMatch = (new Date(match.startTime).getTime() - Date.now()) / (1000 * 60 * 60);

  // Every occupied slot is a booking (host, organizer-paid guest, or joined
  // player). Reading match.bookings — the same array the count is derived from —
  // makes the header and grid structurally unable to disagree, and it refetches
  // live via the match query the socket invalidates.
  const slots: any[] = match?.bookings ?? [];
  const filled = slots.length;
  const joined = !!user && slots.some((b) => !b.isGuestSlot && b.user?.id === user.id);
  const spotsLeft = Math.max(0, (match?.maxPlayers ?? 0) - filled);
  const isFull = spotsLeft === 0 && !joined;

  const join = useMutation({
    mutationFn: () => joinMatchAndPay(id, {}, match?.pricePerPlayer),
    onMutate: () => setMainButtonLoading(true),
    onSuccess: () => {
      hapticSuccess();
      qc.invalidateQueries({ queryKey: ["tma-match", id] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: async (e: any) => {
      hapticError();
      if (isPhoneRequiredError(e)) {
        if (await requirePhone()) join.mutate();
        return;
      }
      if (isInsufficientBalanceError(e)) {
        const info = insufficientBalanceInfo(e);
        showAlert(
          info
            ? `${t("insufficientJoin")}\n${formatUZS(info.needed)} · ${t("yourWallet", { balance: formatUZS(info.balance) })}`
            : t("insufficientJoin"),
        );
        router.push("/wallet");
        return;
      }
      showAlert(e?.response?.data?.message ?? t("couldNotJoinGame"));
    },
    onSettled: () => setMainButtonLoading(false),
  });

  // Gate booking on a verified phone, then join. Used by the Main Button.
  async function reserve() {
    if (!(await requirePhone())) return;
    join.mutate();
  }

  const leave = useMutation({
    mutationFn: () => leaveMatch(id),
    onMutate: () => setMainButtonLoading(true),
    onSuccess: () => {
      hapticSuccess();
      qc.invalidateQueries({ queryKey: ["tma-match", id] });
    },
    onError: (e: any) => {
      hapticError();
      showAlert(e?.response?.data?.message ?? t("couldNotLeaveGame"));
    },
    onSettled: () => setMainButtonLoading(false),
  });

  useEffect(() => {
    const cleanup = showBackButton(() => router.back());
    return cleanup;
  }, [router]);

  useEffect(() => {
    let cleanup = () => {};
    if (joined) {
      cleanup = showMainButton(t("leaveGame"), () => setShowCancel(true), "#FF5252");
    } else if (isFull) {
      hideMainButton();
    } else {
      cleanup = showMainButton(t("reserve", { price: formatUZS(match.pricePerPlayer) }), () => reserve(), "#FF5252");
    }
    return () => {
      cleanup();
      hideMainButton();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, isFull]);

  const photo = match.pitch?.photos?.[0];

  return (
    <div className="min-h-screen pb-28">
      {/* Hero */}
      <div className="h-48 bg-[#0D1117] relative">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={match.pitch?.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 size={48} style={{ color: "rgba(255,255,255,0.4)" }} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <div className="flex gap-1.5 mb-1 flex-wrap">
            {match.format && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/20 backdrop-blur">
                {match.format}
              </span>
            )}
            {match.bookingType && BOOKING_TYPE_META[match.bookingType] && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white"
                style={{ background: BOOKING_TYPE_META[match.bookingType].color }}
              >
                {(() => {
                  const Icon = BOOKING_TYPE_META[match.bookingType].Icon;
                  return <Icon size={11} />;
                })()}
                {tBooking(match.bookingType)}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                isFull ? "bg-[#FF5252]" : "bg-[#00C853]"
              }`}
            >
              {isFull ? t("full") : t("spotsLeft", { count: spotsLeft })}
            </span>
          </div>
          <h1 className="text-lg font-bold leading-tight">{match.pitch?.name}</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Meta rows */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--tg-card)" }}>
          <Row icon={<Calendar size={16} />} label={dayjs(match.startTime).format("dddd, MMMM D")} />
          <Row
            icon={<Clock size={16} />}
            label={`${dayjs(match.startTime).format("HH:mm")}${
              match.durationMinutes ? ` · ${t("minSuffix", { n: match.durationMinutes })}` : ""
            }`}
          />
          <Row
            icon={<MapPin size={16} />}
            label={`${match.pitch?.addressLine ?? ""}${
              match.pitch?.district ? `, ${match.pitch.district}` : ""
            }`}
          />
          <Row
            icon={<Users size={16} />}
            label={t("playersMeta", { filled, max: match.maxPlayers, min: match.minPlayers ?? "—" })}
          />
          {match.skillFilter && (
            <Row icon={<Shield size={16} />} label={t("skillLevel", { level: match.skillFilter })} />
          )}
        </div>

        {/* Booking-type specifics */}
        {match.bookingType === "GROUP_BOOKING" && (
          <div className="rounded-2xl p-4 text-sm flex gap-2" style={{ background: "var(--tg-card)" }}>
            <Users size={16} className="shrink-0 mt-0.5" style={{ color: "#00B0FF" }} />
            <div>
              {t("organisedBy", { name: match.host?.firstName ?? "" })}
              {match.organizerPlayerCount != null && <> — {t("paidForPlayers", { count: match.organizerPlayerCount })}</>}
              {match.extraSpotsAvailable != null && (
                <div className="text-xs mt-1" style={{ color: "var(--tg-hint)" }}>
                  {t("spotsRemaining", { count: Math.max(0, spotsLeft) })}
                </div>
              )}
            </div>
          </div>
        )}
        {match.bookingType === "FULL_BOOKING" && (
          <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--tg-card)" }}>
            {t("fullPitchBooking")} — {match.isPrivate ? t("private") : t("openToOthers")}
          </div>
        )}

        {/* Share / invite card */}
        {share?.telegramShareLink && (justCreated || isHost) && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--tg-card)" }}>
            <div className="font-semibold text-sm">
              {justCreated ? t("youCreatedGame") : t("invitePlayers")}
            </div>
            <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
              {t("shareInvite", { code: "" })} <span className="font-mono font-semibold">{share.shareCode}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  hapticImpact("light");
                  shareToTelegram(share.telegramShareLink, t("joinMyGame", { title: match.title }));
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white"
                style={{ background: "#00B0FF" }}
              >
                <Share2 size={16} /> {tc("share")}
              </button>
              <button
                onClick={async () => {
                  hapticImpact("light");
                  const ok = await copyToClipboard(share.telegramShareLink);
                  showAlert(ok ? t("inviteCopied") : t("copyNotSupported"));
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
                style={{ background: "var(--tg-bg)", border: "1px solid rgba(0,0,0,0.1)" }}
              >
                <Copy size={16} /> {tc("copy")}
              </button>
            </div>
          </div>
        )}

        {/* Host card */}
        <HostCard host={match.host} matchId={id} sport="FOOTBALL" isViewerHost={isHost} />

        {match.description && (
          <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--tg-card)" }}>
            {match.description}
          </div>
        )}

        {/* Formation link */}
        <Link
          href={`/match/${id}/formation`}
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: "var(--tg-card)" }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(0,200,83,0.12)", color: "#00875A" }}
          >
            <ClipboardList size={20} />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">{t("lineupTitle")}</div>
            <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
              {t("lineupSub")}
            </div>
          </div>
          <ChevronRight size={18} style={{ color: "var(--tg-hint)" }} />
        </Link>

        {/* Players */}
        <div>
          <div className="text-sm font-semibold mb-2 px-1">
            {t("playersWithCount", { filled, max: match.maxPlayers })}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {slots.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => !b.isGuestSlot && b.user?.id && router.push(`/players/${b.user.id}`)}
                className="flex flex-col items-center gap-1 pressable"
              >
                <div className="relative">
                  <Avatar user={b.isGuestSlot ? { firstName: "?" } : b.user} />
                  {b.isHostBooking && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center"
                      title={t("host")}
                    >
                      <Crown size={10} style={{ color: "#F59E0B" }} />
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-center truncate w-full" style={{ color: "var(--tg-hint)" }}>
                  {b.isGuestSlot ? b.guestLabel ?? t("guest") : b.user?.firstName}
                </span>
              </button>
            ))}
            {Array.from({ length: Math.min(spotsLeft, match.maxPlayers) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex flex-col items-center gap-1">
                <div
                  className="w-11 h-11 rounded-full border-2 border-dashed flex items-center justify-center"
                  style={{ borderColor: "rgba(0,0,0,0.15)", color: "var(--tg-hint)" }}
                >
                  <Plus size={18} />
                </div>
                <span className="text-[11px]" style={{ color: "var(--tg-hint)" }}>
                  {t("openSlot")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Match chat */}
        <MatchChatRow matchId={id} />

        {/* Where you'll play — static map + amenities */}
        <VenueMap pitch={match.pitch} />

        {/* Result entry — available once the match has started */}
        {hoursUntilMatch <= 0 && (joined || isHost) && (
          <Link
            href={`/match/${id}/result`}
            onClick={() => hapticImpact("light")}
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "var(--tg-card)" }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(245,158,11,0.15)", color: "#B45309" }}
            >
              <Trophy size={20} />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">
                {match.resultSubmitted ? t("viewResult") : t("submitResult")}
              </div>
              <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
                {t("recordScore")}
              </div>
            </div>
            <ChevronRight size={18} style={{ color: "var(--tg-hint)" }} />
          </Link>
        )}

        {joined && (
          <div className="rounded-2xl p-3 flex items-center justify-center gap-1.5 text-sm font-medium text-[#00875A] bg-[#00C853]/10">
            <CheckCircle2 size={16} /> {t("youreInGame")}
          </div>
        )}
      </div>

      {/* Cancellation policy modal */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowCancel(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl p-5 pb-8 space-y-4"
            style={{ background: "var(--tg-bg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {hoursUntilMatch < (match.cancellationDeadlineHours ?? 5) ? (
              <div className="rounded-2xl p-4 space-y-1" style={{ background: "rgba(255,82,82,0.1)" }}>
                <div className="font-bold text-[#FF5252] flex items-center gap-1.5">
                  <AlertTriangle size={16} /> {t("cancelFeeTitle")}
                </div>
                <p className="text-sm">
                  {t("cancelWithin", { hours: match.cancellationDeadlineHours ?? 5 })}
                </p>
                <p className="text-sm">
                  {t("cancelFeePct", { percent: match.cancellationFeePercent ?? 50 })}
                </p>
                <p className="text-sm font-semibold pt-1">
                  {t("youllReceive", {
                    amount: formatUZS(
                      Number(match.pricePerPlayer) * (1 - (match.cancellationFeePercent ?? 50) / 100),
                    ),
                  })}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl p-4 space-y-1" style={{ background: "rgba(0,200,83,0.1)" }}>
                <div className="font-bold text-[#00875A] flex items-center gap-1.5">
                  <CheckCircle2 size={16} /> {t("freeCancel")}
                </div>
                <p className="text-sm">{t("fullRefund", { amount: formatUZS(match.pricePerPlayer) })}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold"
                style={{ background: "var(--tg-card)" }}
              >
                {t("keepSpot")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCancel(false);
                  leave.mutate();
                }}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-white"
                style={{ background: "#FF5252" }}
              >
                {t("cancelBooking")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span style={{ color: "#00C853" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function Avatar({ user }: { user: any }) {
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <div className="w-11 h-11 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
