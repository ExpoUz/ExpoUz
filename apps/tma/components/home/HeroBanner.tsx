"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { hapticImpact } from "@/lib/telegram";
import { PhotoOrInitials, initialsOf } from "./PhotoOrInitials";
import { matchPhoto, spotsLeft, venueName } from "./matchHelpers";

/**
 * The visual anchor of the home screen: a full-bleed venue photo (16:10) with a
 * bottom-up scrim carrying the headline and meta. Tapping anywhere opens the
 * match. Renders nothing when there is no photo-worthy match to show.
 */
export function HeroBanner({ match }: { match: any | null }) {
  const t = useTranslations("home");
  const tMatches = useTranslations("matches");
  if (!match) return null;

  const name = venueName(match) || tMatches("venue");
  const left = spotsLeft(match);
  const meta = [
    left > 0 ? tMatches("spotsLeft", { count: left }) : tMatches("full"),
    dayjs(match.startTime).format("HH:mm"),
    match.format,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/match/${match.id}`}
      onClick={() => hapticImpact("light")}
      className="relative block mx-4 rounded-2xl overflow-hidden active:scale-[0.99] transition-transform"
      style={{ aspectRatio: "16 / 10" }}
    >
      <PhotoOrInitials
        src={matchPhoto(match)}
        initials={initialsOf(name)}
        className="absolute inset-0"
        initialsClassName="text-white/90 font-extrabold text-5xl"
      />

      {/* Bottom-up dark scrim for text contrast */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 55%)",
        }}
      />

      {/* Circular "open" affordance, top-right */}
      <span
        className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-white"
        style={{
          background: "rgba(255,255,255,0.18)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <ArrowUpRight size={20} />
      </span>

      {/* Copy in the scrim */}
      <div className="absolute left-4 right-4 bottom-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70 mb-1">
          {t("featured")}
        </div>
        <div className="text-white text-lg font-semibold leading-tight line-clamp-1">
          {name}
        </div>
        <div className="text-[13px] text-white/80 mt-0.5">{meta}</div>
      </div>
    </Link>
  );
}
