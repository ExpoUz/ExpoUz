"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { getPitch, getMatches } from "@/lib/api";
import { PhotoOrInitials, initialsOf } from "@/components/home/PhotoOrInitials";
import { AmenityChips } from "@/components/AmenityChips";
import { spotsLeft } from "@/components/home/matchHelpers";
import { showBackButton, hapticImpact } from "@/lib/telegram";

export default function VenuePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations("venue");
  const tm = useTranslations("matches");

  useEffect(() => showBackButton(() => router.back()), [router]);

  const { data: pitch, isLoading } = useQuery({ queryKey: ["venue", id], queryFn: () => getPitch(id) });
  const { data: matchData } = useQuery({
    queryKey: ["venue-matches", id],
    queryFn: () => getMatches({ pitchId: id, limit: 50 }),
  });
  const matches = (matchData?.data ?? []).filter((m: any) => dayjs(m.startTime).isAfter(dayjs()));

  if (isLoading || !pitch) {
    return (
      <div className="flex justify-center py-24">
        <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      {/* Hero photo */}
      <div className="relative w-full h-[190px]">
        <PhotoOrInitials
          src={pitch.photos?.[0] ?? null}
          initials={initialsOf(pitch.name)}
          className="absolute inset-0"
          initialsClassName="text-white/90 font-extrabold text-4xl"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0) 60%)" }} />
        <div className="absolute left-4 right-4 bottom-3">
          <h1 className="text-white text-xl font-bold leading-tight">{pitch.name}</h1>
          <p className="text-white/80 text-sm mt-0.5">
            {[pitch.addressLine, pitch.district].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {/* Amenities */}
        <AmenityChips amenities={pitch.amenities} isIndoor={pitch.isIndoor} isCovered={pitch.isCovered} />

        {/* Upcoming games at this venue */}
        <section>
          <h2 className="text-[15px] font-semibold mb-2">{t("upcomingHere")}</h2>
          {matches.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--tg-hint)" }}>{t("noUpcoming")}</p>
          ) : (
            <div className="space-y-2">
              {matches.map((m: any) => {
                const left = spotsLeft(m);
                return (
                  <Link
                    key={m.id}
                    href={`/match/${m.id}`}
                    onClick={() => hapticImpact("light")}
                    className="flex items-center gap-3 rounded-2xl p-3 active:scale-[0.99] transition-transform"
                    style={{ background: "var(--tg-card)" }}
                  >
                    <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0" style={{ background: "rgba(0,200,83,0.12)" }}>
                      <span className="text-[10px] font-semibold text-[#00875A]">{dayjs(m.startTime).format("MMM")}</span>
                      <span className="text-base font-bold text-[#00875A] leading-none">{dayjs(m.startTime).format("D")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {m.format} · {dayjs(m.startTime).format("HH:mm")}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--tg-hint)" }}>
                        {left > 0 ? tm("spotsLeft", { count: left }) : tm("full")}
                      </div>
                    </div>
                    <span style={{ color: "var(--tg-hint)" }}>›</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
