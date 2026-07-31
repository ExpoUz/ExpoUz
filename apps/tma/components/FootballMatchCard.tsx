"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import { MapPin, Users } from "lucide-react";
import { formatUZS } from "@/lib/api";
import { hapticImpact } from "@/lib/telegram";

export function FootballMatchCard({ match }: { match: any }) {
  const t = useTranslations("matches");
  const maxPlayers = match.maxPlayers ?? 0;
  const filled =
    match.currentPlayers ?? match._count?.bookings ?? (match.bookings?.length ?? 0);
  const spotsLeft = Math.max(0, maxPlayers - filled);
  const isFull = spotsLeft === 0;
  const isIndoor = match.pitch?.isIndoor;
  const hostName = match.host
    ? `${match.host.firstName ?? ""} ${(match.host.lastName ?? "").charAt(0)}.`.trim()
    : t("host");

  return (
    <Link
      href={`/match/${match.id}`}
      onClick={() => hapticImpact("light")}
      className="block rounded-2xl overflow-hidden shadow-sm active:scale-[0.99] transition-transform"
      style={{ background: "var(--tg-card)" }}
    >
      <div className="flex gap-3 p-3">
        {/* Venue photo */}
        <div className="w-16 h-16 rounded-xl bg-[#0D1117] overflow-hidden flex items-center justify-center text-2xl shrink-0">
          {match.pitch?.photos?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.pitch.photos[0]} alt="" className="w-full h-full object-cover" />
          ) : (
            "⚽"
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="font-semibold text-sm truncate">{match.pitch?.name ?? t("venue")}</div>
            <span className="text-xs font-bold shrink-0" style={{ color: "var(--tg-hint)" }}>
              {dayjs(match.startTime).format("h:mm A")}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium" style={{ color: "var(--tg-hint)" }}>
            {isIndoor && (
              <span className="px-1.5 py-0.5 rounded bg-black/5 font-bold">{t("indoor")}</span>
            )}
            <span>⚽ {match.format}</span>
            <span>{t("withHost", { name: hostName })}</span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-[11px]" style={{ color: "var(--tg-hint)" }}>
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{match.pitch?.district ?? match.pitch?.city ?? "Tashkent"}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex items-center gap-1 text-[11px] font-bold">
                <Users size={12} />
                {filled}/{maxPlayers}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isFull ? "bg-[#FF5252] text-white" : "bg-[#00C853] text-white"
                }`}
              >
                {isFull ? t("full") : t("spotsLeft", { count: spotsLeft })}
              </span>
            </div>
          </div>

          {match.pricePerPlayer != null && (
            <div className="text-xs font-bold text-[#00C853] mt-1">
              {formatUZS(match.pricePerPlayer)}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
