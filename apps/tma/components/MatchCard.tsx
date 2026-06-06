"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { MapPin, Users, Clock } from "lucide-react";
import { formatUZS } from "@/lib/api";
import { hapticImpact } from "@/lib/telegram";

export function MatchCard({ match }: { match: any }) {
  const spotsLeft = Math.max(0, (match.maxPlayers ?? 0) - (match.currentPlayers ?? match._count?.bookings ?? 0));
  const isFull = spotsLeft === 0;
  const photo = match.pitch?.photos?.[0];

  return (
    <Link
      href={`/match/${match.id}`}
      onClick={() => hapticImpact("light")}
      className="block rounded-2xl overflow-hidden shadow-sm active:scale-[0.99] transition-transform"
      style={{ background: "var(--tg-card)" }}
    >
      <div className="h-28 bg-[#0D1117] relative">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={match.pitch?.name ?? ""} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🏟</div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-black/55 text-white backdrop-blur">
            {match.format}
          </span>
          {match.sport && match.sport !== "FOOTBALL" && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-black/55 text-white backdrop-blur">
              {match.sport}
            </span>
          )}
        </div>
        <div className="absolute top-2 right-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              isFull ? "bg-[#FF5252] text-white" : "bg-[#00C853] text-white"
            }`}
          >
            {isFull ? "Full" : `${spotsLeft} left`}
          </span>
        </div>
      </div>

      <div className="p-3">
        <div className="font-semibold text-[15px] leading-tight truncate">
          {match.pitch?.name ?? "Pitch"}
        </div>
        <div className="flex items-center gap-1 text-xs mt-1" style={{ color: "var(--tg-hint)" }}>
          <MapPin size={12} />
          <span className="truncate">{match.pitch?.district ?? match.pitch?.city ?? "Tashkent"}</span>
        </div>

        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-3 text-xs" style={{ color: "var(--tg-hint)" }}>
            <span className="flex items-center gap-1">
              <Clock size={12} /> {dayjs(match.startTime).format("ddd HH:mm")}
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} /> {match.currentPlayers ?? match._count?.bookings ?? 0}/{match.maxPlayers}
            </span>
          </div>
          <span className="text-sm font-bold text-[#00C853]">{formatUZS(match.pricePerPlayer)}</span>
        </div>
      </div>
    </Link>
  );
}
