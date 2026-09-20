"use client";

import { useTranslations } from "next-intl";
import {
  Car,
  ShowerHead,
  Bath,
  Droplets,
  Coffee,
  Shield,
  Lightbulb,
  Home,
  Umbrella,
  type LucideIcon,
} from "lucide-react";

// Icon per amenity type (matches the AmenityType enum on the API).
const AMENITY_ICON: Record<string, LucideIcon> = {
  PARKING: Car,
  CHANGING_ROOM: ShowerHead,
  BATHROOM: Bath,
  WATER_FOUNTAIN: Droplets,
  CAFE: Coffee,
  SECURITY: Shield,
  LIGHTS: Lightbulb,
  INDOOR: Home,
  COVERED: Umbrella,
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
      {list.map((tp) => {
        const Icon = AMENITY_ICON[tp];
        return (
          <span
            key={tp}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px]"
            style={{ background: "var(--tg-card)", color: "var(--tg-text)" }}
          >
            <Icon size={14} style={{ color: "var(--tg-hint)" }} />
            {t(tp)}
          </span>
        );
      })}
    </div>
  );
}
