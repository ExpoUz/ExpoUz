"use client";

import { useTranslations } from "next-intl";
import { getSkillBand, formatLevel } from "@/lib/api";

// The small colored skill-rating badge (e.g. "2.62") used on avatars and cards.
export function SkillBadge({
  level,
  size = "sm",
  showLabel = false,
}: {
  level: number | null | undefined;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
}) {
  const tBands = useTranslations("levels.bands");
  const value = Number(level ?? 0);
  const band = getSkillBand(value);
  const dims =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5"
      : size === "md"
        ? "text-sm px-2.5 py-1"
        : "text-[11px] px-2 py-0.5";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-md font-bold text-white ${dims}`}
        style={{ background: band.color }}
      >
        {formatLevel(value)}
      </span>
      {showLabel && (
        <span className="text-xs font-medium" style={{ color: band.color }}>
          {tBands(band.key)}
        </span>
      )}
    </span>
  );
}
