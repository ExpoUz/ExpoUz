"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { AmenityChips } from "@/components/AmenityChips";
import { openLink, copyToClipboard, hapticImpact, showAlert } from "@/lib/telegram";

/**
 * "Where you'll play" — static map image (no interactive SDK inside the Mini
 * App) with a pin, address, amenity chips, and handoff to the real maps app.
 * If the venue has no coordinates the map is hidden and only the address shows —
 * never a broken image or a pin at 0,0.
 */
export function VenueMap({ pitch }: { pitch: any }) {
  const t = useTranslations("map");
  const tv = useTranslations("venue");
  const [mapFailed, setMapFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!pitch) return null;

  const lat = pitch.lat;
  const lng = pitch.lng;
  const hasCoords = typeof lat === "number" && typeof lng === "number" && !(lat === 0 && lng === 0);
  const name = pitch.name ?? "";
  const address = [pitch.addressLine, pitch.district, pitch.city].filter(Boolean).join(", ");

  const staticMapUrl = hasCoords
    ? `https://static-maps.yandex.ru/1.x/?ll=${lng},${lat}&z=16&size=600,300&l=map&pt=${lng},${lat},pm2rdm`
    : null;
  const openMapsUrl = hasCoords ? `https://yandex.com/maps/?pt=${lng},${lat}&z=16&l=map` : null;

  const openMaps = () => {
    if (!openMapsUrl) return;
    hapticImpact("light");
    openLink(openMapsUrl);
  };

  const copyAddress = async () => {
    hapticImpact("light");
    const ok = await copyToClipboard(address);
    showAlert(ok ? t("addressCopied") : address);
  };

  return (
    <div>
      <div className="text-sm font-semibold mb-2 px-1">{t("whereYoullPlay")}</div>
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--tg-card)" }}>
        {staticMapUrl && !mapFailed && (
          <button type="button" onClick={openMaps} className="block w-full active:opacity-90">
            <div className="relative w-full h-[150px] rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
              {!loaded && <div className="absolute inset-0 skeleton" />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={staticMapUrl}
                alt={name}
                onLoad={() => setLoaded(true)}
                onError={() => setMapFailed(true)}
                className={`w-full h-full object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
              />
            </div>
          </button>
        )}

        <div>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <MapPin size={15} className="text-[#00B0FF]" />
            {name || tv("upcomingHere")}
          </div>
          {address && (
            <div className="text-xs mt-1" style={{ color: "var(--tg-hint)" }}>
              {address}
            </div>
          )}
        </div>

        <AmenityChips amenities={pitch.amenities} isIndoor={pitch.isIndoor} isCovered={pitch.isCovered} />

        <div className="flex gap-2 pt-1">
          {hasCoords && (
            <button
              onClick={openMaps}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white"
              style={{ background: "#00B0FF" }}
            >
              {t("openInMaps")}
            </button>
          )}
          {address && (
            <button
              onClick={copyAddress}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
              style={{ background: "rgba(0,0,0,0.05)", color: "var(--tg-text)" }}
            >
              {t("copyAddress")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
