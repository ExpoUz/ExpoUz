"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  getMatchByShareCode,
  joinByShareCode,
  payForBookingWithWallet,
  leaveMatch,
  isInsufficientBalanceError,
  formatUZS,
} from "@/lib/api";
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
    setJoining(true);
    setMainButtonLoading(true);
    try {
      const res = await joinByShareCode(shareCode, {});
      const bookingId = res?.booking?.id;
      if (bookingId && Number(match.pricePerPlayer ?? 0) > 0) {
        try {
          await payForBookingWithWallet(bookingId);
        } catch (payErr) {
          await leaveMatch(match.id).catch(() => {});
          throw payErr;
        }
      }
      hapticSuccess();
      router.replace(`/match/${match.id}`);
    } catch (e: any) {
      hapticError();
      if (isInsufficientBalanceError(e)) {
        showAlert("Not enough wallet balance — top up to join this game.");
        router.push("/wallet");
      } else {
        showAlert(e?.response?.data?.message ?? "Could not join this game.");
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
    const cleanup = showMainButton("⚽ Join This Game", () => actionRef.current());
    return () => {
      cleanup();
      hideMainButton();
    };
  }, [match]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: "var(--tg-hint)" }}>Loading invite…</div>;
  }

  if (error || !match) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-2">
        <div className="text-4xl">🔗</div>
        <div className="font-semibold">Invalid or expired invite</div>
        <button onClick={() => router.replace("/")} className="mt-3 text-sm font-medium text-[#00C853]">
          Browse games instead
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
        🎉 You were invited to join this game!
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
          <Row label="When" value={dayjs(match.startTime).format("ddd, MMM D · HH:mm")} />
          {match.format && <Row label="Format" value={match.format} />}
          <Row label="Players" value={`${match.currentPlayers} / ${match.maxPlayers}`} />
          <Row label="Price" value={formatUZS(match.pricePerPlayer)} />
        </div>

        {full ? (
          <div className="rounded-2xl p-3 text-sm text-center" style={{ background: "rgba(255,82,82,0.12)", color: "#FF5252" }}>
            This game is full.
          </div>
        ) : (
          <div className="rounded-2xl p-3 text-sm text-center" style={{ background: "rgba(0,200,83,0.1)", color: "#00C853" }}>
            {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left
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
