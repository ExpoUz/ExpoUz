"use client";

import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import Link from "next/link";
import { getMe, getMyStats, getMyBookings, formatUZS } from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/lib/auth";
import { hideMainButton } from "@/lib/telegram";
import { useEffect } from "react";

export default function ProfilePage() {
  const { user: cached } = useAuth();

  useEffect(() => {
    hideMainButton();
  }, []);

  const { data: me } = useQuery({ queryKey: ["tma-me"], queryFn: getMe, initialData: cached });
  const { data: stats } = useQuery({ queryKey: ["tma-stats"], queryFn: getMyStats });
  const { data: bookings } = useQuery({ queryKey: ["tma-bookings"], queryFn: getMyBookings });

  const initials = `${me?.firstName?.[0] ?? ""}${me?.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="px-4 pt-8 pb-6 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-2xl font-bold overflow-hidden">
          {me?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <h1 className="mt-3 text-xl font-bold">
          {me?.firstName} {me?.lastName}
        </h1>
        {me?.username && (
          <p className="text-sm" style={{ color: "var(--tg-hint)" }}>
            @{me.username}
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="px-4 grid grid-cols-3 gap-3">
        <Stat label="ELO" value={me?.eloRating ?? "—"} />
        <Stat
          label="Reliability"
          value={me?.reliabilityScore != null ? `${Number(me.reliabilityScore).toFixed(0)}%` : "—"}
        />
        <Stat label="Games" value={stats?.totalGames ?? stats?.gamesPlayed ?? bookings?.length ?? 0} />
      </div>

      {me?.skillLevel && (
        <div className="px-4 mt-3">
          <div
            className="rounded-2xl px-4 py-3 text-sm flex items-center justify-between"
            style={{ background: "var(--tg-card)" }}
          >
            <span style={{ color: "var(--tg-hint)" }}>Skill level</span>
            <span className="font-semibold">{me.skillLevel}</span>
          </div>
        </div>
      )}

      {/* My bookings */}
      <div className="px-4 mt-6">
        <div className="text-sm font-semibold mb-2 px-1">My Games</div>
        <div className="space-y-2">
          {(bookings ?? []).length === 0 ? (
            <div
              className="rounded-2xl py-10 text-center text-sm"
              style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}
            >
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
                      <div className="font-medium text-sm truncate">
                        {match?.pitch?.name ?? match?.title ?? "Match"}
                      </div>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl py-4 text-center" style={{ background: "var(--tg-card)" }}>
      <div className="text-xl font-bold text-[#00C853]">{value}</div>
      <div className="text-[11px] mt-0.5" style={{ color: "var(--tg-hint)" }}>
        {label}
      </div>
    </div>
  );
}
