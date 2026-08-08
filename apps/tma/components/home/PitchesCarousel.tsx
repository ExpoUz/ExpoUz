"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { hapticImpact } from "@/lib/telegram";
import { PhotoOrInitials, initialsOf } from "./PhotoOrInitials";
import type { NearbyPitch } from "@/lib/api";

/** "Pitches near you" — 200×150 venue cards with distance + today's game count. */
export function PitchesCarousel({ pitches }: { pitches: NearbyPitch[] }) {
  const t = useTranslations("home");

  return (
    <div className="flex gap-3 overflow-x-auto snap-x px-4 pb-1">
      {pitches.map((p) => {
        const distance =
          p.distance != null ? `${p.distance < 10 ? p.distance.toFixed(1) : Math.round(p.distance)} km` : null;
        const games =
          p.gamesToday > 0 ? t("gamesToday", { count: p.gamesToday }) : t("noGamesToday");
        // Distance and game count on one line; drop distance when unknown.
        const meta = distance ? `${distance} · ${games}` : games;
        return (
          <Link
            key={p.id}
            href={`/venue/${p.id}`}
            onClick={() => hapticImpact("light")}
            className="snap-start shrink-0 active:scale-[0.98] transition-transform"
          >
            <div className="relative w-[200px] h-[150px]">
              <PhotoOrInitials
                src={p.photo}
                initials={initialsOf(p.name)}
                className="absolute inset-0"
                rounded="rounded-[14px]"
                initialsClassName="text-white/90 font-extrabold text-2xl"
              />
              <div
                className="absolute inset-0 rounded-[14px]"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.74) 0%, rgba(0,0,0,0) 56%)",
                }}
              />
              <div className="absolute left-2.5 right-2.5 bottom-2">
                <div className="text-white text-sm font-semibold leading-tight line-clamp-2">
                  {p.name}
                </div>
                <div className="text-[12px] text-white/75 mt-0.5 line-clamp-1">{meta}</div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
