"use client";

import { useI18n } from "@/lib/i18n";

const SEGMENT_STYLES: Record<string, string> = {
  NEW: "bg-[#00B0FF]/15 text-[#0369A1]",
  REGULAR: "bg-[#00C853]/15 text-[#00875A]",
  LOYAL: "bg-[#8B5CF6]/15 text-[#6D28D9]",
  AT_RISK: "bg-[#F59E0B]/15 text-[#B45309]",
  LAPSED: "bg-[#6B7280]/15 text-[#374151]",
  RISKY: "bg-[#EF4444]/15 text-[#B91C1C]",
};

export function SegmentBadge({ segment }: { segment: string }) {
  const { t } = useI18n();
  const cls = SEGMENT_STYLES[segment] ?? "bg-[#6B7280]/15 text-[#374151]";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {t(`seg.${segment}`)}
    </span>
  );
}

/** Padel level (2.4) or football skill/ELO badge, per sport. */
export function LevelBadge({ padelLevel, skillLevel }: { padelLevel: number | null; skillLevel?: string }) {
  if (padelLevel != null && padelLevel > 0) {
    return (
      <span className="text-xs font-semibold text-[#6D28D9]">{padelLevel.toFixed(1)}</span>
    );
  }
  return <span className="text-xs font-medium text-[#6B7280]">{skillLevel ?? "—"}</span>;
}

export function Avatar({ url, first, last, size = 40 }: { url?: string | null; first?: string; last?: string; size?: number }) {
  const initials = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <div
      className="rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
