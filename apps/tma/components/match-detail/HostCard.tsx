"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { Crown, Star, Building2, Check } from "lucide-react";
import { startDirectConversation, getSkillBand, formatLevel } from "@/lib/api";
import { hapticImpact } from "@/lib/telegram";

/**
 * "Hosted by" card for the event detail. Shows the host's avatar, name, sport
 * level + band, games hosted, reliability, thumbs-up rating and bio. Viewer who
 * is the host sees "Edit match" instead of View profile / Message.
 */
export function HostCard({
  host,
  matchId,
  sport,
  isViewerHost,
}: {
  host: any;
  matchId: string;
  sport: "PADEL" | "FOOTBALL";
  isViewerHost: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("host");
  const tBands = useTranslations("levels.bands");
  const tFootball = useTranslations("levels.football");

  const message = useMutation({
    mutationFn: () => startDirectConversation(host.id),
    onSuccess: (convo: any) => router.push(`/messages/${convo.id}`),
  });

  if (!host) return null;

  const isPadel = sport === "PADEL";
  const padelLevel = Number(host.padelLevel ?? 0);
  const band = getSkillBand(padelLevel);
  const levelText = isPadel
    ? host.padelInitialSet && padelLevel > 0
      ? `${formatLevel(padelLevel)} · ${tBands(band.key)}`
      : null
    : `${host.eloRating ?? 1000} · ${
        ["BEGINNER", "AMATEUR", "PRO"].includes(host.skillLevel) ? tFootball(host.skillLevel) : host.skillLevel ?? ""
      }`;

  const reliability = isPadel ? host.padelReliability : Math.round(Number(host.reliabilityScore ?? 0));
  const initials = `${host.firstName?.[0] ?? ""}${host.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  return (
    <div>
      <div className="text-sm font-semibold mb-2 px-1">{t("hostedBy")}</div>
      <div className="rounded-2xl p-4" style={{ background: "var(--tg-card)" }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-base font-bold overflow-hidden shrink-0">
            {host.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={host.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold truncate">
                {host.firstName} {host.lastName}
              </span>
              <Crown size={14} className="shrink-0" style={{ color: "#F59E0B" }} aria-label={t("host")} />
            </div>
            {levelText && (
              <div className="text-xs mt-0.5" style={{ color: "var(--tg-hint)" }}>
                {levelText}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          {host.ratingPercent != null && (
            <Stat
              value={
                <span className="inline-flex items-center gap-1">
                  <Star size={13} style={{ color: "#F59E0B" }} /> {host.ratingPercent}%
                </span>
              }
              label={t("rating")}
            />
          )}
          <Stat
            value={
              <span className="inline-flex items-center gap-1">
                <Building2 size={13} style={{ color: "var(--tg-hint)" }} /> {host.gamesHosted ?? 0}
              </span>
            }
            label={t("hosted")}
          />
          <Stat
            value={
              <span className="inline-flex items-center gap-1">
                <Check size={13} style={{ color: "#00875A" }} /> {reliability}%
              </span>
            }
            label={t("reliability")}
          />
        </div>

        {host.bio && (
          <p className="text-sm mt-3 italic" style={{ color: "var(--tg-hint)" }}>
            “{host.bio}”
          </p>
        )}

        <div className="flex gap-2 mt-4">
          {isViewerHost ? (
            <button
              onClick={() => {
                hapticImpact("light");
                router.push(`/match/${matchId}/edit`);
              }}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white"
              style={{ background: "#00C853" }}
            >
              {t("editMatch")}
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  hapticImpact("light");
                  router.push(`/players/${host.id}`);
                }}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
                style={{ background: "rgba(0,0,0,0.05)", color: "var(--tg-text)" }}
              >
                {t("viewProfile")}
              </button>
              <button
                onClick={() => {
                  hapticImpact("light");
                  message.mutate();
                }}
                disabled={message.isPending}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "#00B0FF" }}
              >
                {t("message")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div>
      <div className="text-sm font-bold">{value}</div>
      <div className="text-[11px] mt-0.5" style={{ color: "var(--tg-hint)" }}>
        {label}
      </div>
    </div>
  );
}
