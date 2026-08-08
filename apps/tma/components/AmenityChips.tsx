"use client";

import { useTranslations } from "next-intl";

// Icon per amenity type (matches the AmenityType enum on the API).
const AMENITY_ICON: Record<string, string> = {
  PARKING: "🚗",
  CHANGING_ROOM: "🚿",
  BATHROOM: "🚻",
  WATER_FOUNTAIN: "🚰",
  CAFE: "☕",
  SECURITY: "🛡️",
  LIGHTS: "💡",
  INDOOR: "🏠",
  COVERED: "⛱️",
};

/**
 * Renders a venue's amenity flags as small icon+label chips. Only shows
 * amenities that are actually set — no "not available" clutter. Accepts the
 * raw amenities relation ([{type}]) plus optional isIndoor/isCovered pseudo-flags.
 */
export function AmenityChips({
  amenities,
  isIndoor,
  isCovered,
}: {
  amenities?: { type: string }[];
  isIndoor?: boolean;
  isCovered?: boolean;
}) {
  const t = useTranslations("amenities");
  const types = new Set((amenities ?? []).map((a) => a.type));
  if (isIndoor) types.add("INDOOR");
  if (isCovered) types.add("COVERED");

  const list = Array.from(types).filter((tp) => AMENITY_ICON[tp]);
  if (list.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {list.map((tp) => (
        <span
          key={tp}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px]"
          style={{ background: "var(--tg-card)", color: "var(--tg-text)" }}
        >
          <span>{AMENITY_ICON[tp]}</span>
          {t(tp)}
        </span>
      ))}
    </div>
  );
}
