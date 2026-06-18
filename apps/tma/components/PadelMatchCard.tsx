"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { MapPin, Clock } from "lucide-react";
import { formatUZS, getSkillBand, formatLevel } from "@/lib/api";
import { hapticImpact } from "@/lib/telegram";

interface SlotPlayer {
  id: string;
  firstName?: string;
  avatarUrl?: string | null;
  padelLevel?: number;
}

export function PadelMatchCard({ match }: { match: any }) {
  const maxPlayers = match.maxPlayers ?? 0;
  const players: SlotPlayer[] = (match.bookings ?? [])
    .map((b: any) => b.user)
    .filter(Boolean);
  const filled = match.currentPlayers ?? match._count?.bookings ?? players.length;
  const spotsLeft = Math.max(0, maxPlayers - filled);
  const isFull = spotsLeft === 0;
  const isCompetitive = match.matchType !== "CASUAL";
  const hasRange = match.minLevel != null || match.maxLevel != null;

  const emptySlots = Math.max(0, maxPlayers - players.length);
  const slots: (SlotPlayer | null)[] = [
    ...players.slice(0, maxPlayers),
    ...Array(emptySlots).fill(null),
  ].slice(0, Math.max(maxPlayers, 4));

  return (
    <Link
      href={`/match/${match.id}`}
      onClick={() => hapticImpact("light")}
      className="block rounded-2xl overflow-hidden shadow-sm active:scale-[0.99] transition-transform"
      style={{ background: "var(--tg-card)" }}
    >
      <div className="p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--tg-hint)" }}>
            <Clock size={13} />
            {dayjs(match.startTime).format("ddd, MMM D · HH:mm")}
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              isFull ? "bg-[#FF5252] text-white" : "bg-[#00C853] text-white"
            }`}
          >
            {isFull ? "Full" : `${spotsLeft} left`}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
            style={{
              background: isCompetitive ? "rgba(239,68,68,0.12)" : "rgba(0,176,255,0.12)",
              color: isCompetitive ? "#EF4444" : "#00B0FF",
            }}
          >
            {isCompetitive ? "⚔️ Competitive" : "😎 Casual"}
          </span>
          {hasRange && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--tg-hint)" }}>
              🎾 {formatLevel(match.minLevel ?? 0)} – {formatLevel(match.maxLevel ?? 7)}
            </span>
          )}
          <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/5">
            {match.format}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-3">
          {slots.map((p, i) => (
            <PlayerSlot key={p?.id ?? `empty-${i}`} player={p} />
          ))}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-xs font-medium truncate">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">{match.pitch?.name ?? "Court"}</span>
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--tg-hint)" }}>
              {match.pitch?.district ?? match.pitch?.city ?? "Tashkent"} · {match.durationMinutes ?? 60} min
            </div>
          </div>
          <span className="text-sm font-bold text-[#00C853] shrink-0">{formatUZS(match.pricePerPlayer)}</span>
        </div>
      </div>
    </Link>
  );
}

function PlayerSlot({ player }: { player: SlotPlayer | null }) {
  if (!player) {
    return (
      <div className="flex flex-col items-center gap-1 w-12">
        <div
          className="w-10 h-10 rounded-full border-2 border-dashed flex items-center justify-center text-lg"
          style={{ borderColor: "rgba(0,0,0,0.15)", color: "var(--tg-hint)" }}
        >
          +
        </div>
        <span className="text-[9px]" style={{ color: "var(--tg-hint)" }}>
          Open
        </span>
      </div>
    );
  }
  const band = getSkillBand(Number(player.padelLevel ?? 0));
  const initial = (player.firstName?.[0] ?? "?").toUpperCase();
  return (
    <div className="flex flex-col items-center gap-1 w-12">
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-sm font-bold overflow-hidden">
          {player.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <span
          className="absolute -bottom-1 -right-1 text-[8px] font-bold text-white rounded px-1 leading-tight"
          style={{ background: band.color }}
        >
          {formatLevel(player.padelLevel)}
        </span>
      </div>
      <span className="text-[9px] truncate max-w-full" style={{ color: "var(--tg-hint)" }}>
        {player.firstName ?? "Player"}
      </span>
    </div>
  );
}
