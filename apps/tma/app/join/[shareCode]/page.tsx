"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import {
  getMatchByShareCode,
  joinByShareCode,
  isInsufficientBalanceError,
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
  showAlert,
} from "@/lib/telegram";

export default function JoinViaInvitePage() {
  const router = useRouter();
  const t = useTranslations("join");
  const tm = useTranslations("matches");
  const { requirePhone } = usePhoneGate();
  const params = useParams<{ shareCode: string }>();
  const shareCode = params.shareCode;
  const [joining, setJoining] = useState(false);

  const { data: match, isLoading, error } = useQuery({
    queryKey: ["invite", shareCode],
    queryFn: () => getMatchByShareCode(shareCode),
    enabled: !!shareCode,
    retry: false,
  });

  const actionRef = useRef<() => void>(() => {});
  actionRef.current = async () => {
    if (joining || !match) return;
    // Booking via an invite is still a booking — require a verified phone first.
    if (!(await requirePhone())) return;
    setJoining(true);
    setMainButtonLoading(true);
    try {
      // Joining is atomic on the server (slot + wallet debit in one tx).
      await joinByShareCode(shareCode, {});
      hapticSuccess();
      router.replace(`/match/${match.id}`);
    } catch (e: any) {
      hapticError();
      if (isPhoneRequiredError(e)) {
        setJoining(false);
        setMainButtonLoading(false);
        if (await requirePhone()) actionRef.current();
        return;
      }
      if (isInsufficientBalanceError(e)) {
        showAlert(t("insufficient"));
        router.push("/wallet");
      } else {
        showAlert(e?.response?.data?.message ?? tm("couldNotJoinGame"));
      }
      setJoining(false);
      setMainButtonLoading(false);
    }
  };

  useEffect(() => {
    const cleanup = showBackButton(() => router.replace("/"));
    return cleanup;
  }, [router]);

  useEffect(() => {
    if (!match) return;
    const full = match.currentPlayers >= match.maxPlayers;
    if (full || match.status === "CANCELLED") {
      hideMainButton();
      return;
    }
    const cleanup = showMainButton(t("joinThisGame"), () => actionRef.current());
    return () => {
      cleanup();
      hideMainButton();
    };
  }, [match]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: "var(--tg-hint)" }}>{t("loading")}</div>;
  }

  if (error || !match) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-2">
        <div className="text-4xl">🔗</div>
        <div className="font-semibold">{t("invalidInvite")}</div>
        <button onClick={() => router.replace("/")} className="mt-3 text-sm font-medium text-[#00C853]">
          {t("browseInstead")}
        </button>
      </div>
    );
  }

  const full = match.currentPlayers >= match.maxPlayers;
  const spotsLeft = Math.max(0, match.maxPlayers - match.currentPlayers);

  return (
    <div className="min-h-screen pb-28">
      {/* Invite banner */}
      <div className="px-4 py-3 text-center text-sm font-semibold text-white" style={{ background: "#00B0FF" }}>
        {t("invitedBanner")}
      </div>

      {/* Pitch image */}
      <div className="h-44 bg-[#0D1117] overflow-hidden flex items-center justify-center text-4xl">
        {match.pitch?.photos?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={match.pitch.photos[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          "🏟"
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">{match.title}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--tg-hint)" }}>
            {match.pitch?.name} · {match.pitch?.district ?? "Tashkent"}
          </p>
        </div>

        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--tg-card)" }}>
          <Row label={tm("when")} value={dayjs(match.startTime).format("ddd, MMM D · HH:mm")} />
          {match.format && <Row label={tm("format")} value={match.format} />}
          <Row label={tm("players")} value={`${match.currentPlayers} / ${match.maxPlayers}`} />
          <Row label={tm("price")} value={formatUZS(match.pricePerPlayer)} />
        </div>

        {full ? (
          <div className="rounded-2xl p-3 text-sm text-center" style={{ background: "rgba(255,82,82,0.12)", color: "#FF5252" }}>
            {t("gameFull")}
          </div>
        ) : (
          <div className="rounded-2xl p-3 text-sm text-center" style={{ background: "rgba(0,200,83,0.1)", color: "#00C853" }}>
            {tm("spotsLeft", { count: spotsLeft })}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: "var(--tg-hint)" }}>{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  );
}
