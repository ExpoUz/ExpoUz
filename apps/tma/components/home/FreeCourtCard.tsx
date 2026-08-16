"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatUZS, type FreeCourt } from "@/lib/api";
import { PhotoOrInitials, initialsOf } from "./PhotoOrInitials";
import { hapticImpact } from "@/lib/telegram";

/**
 * Free-court result card. Tapping a slot chip is the conversion path: it opens
 * the create-match flow pre-filled with pitch + date + time.
 */
export function FreeCourtCard({ court, date }: { court: FreeCourt; date: string }) {
  const router = useRouter();
  const t = useTranslations("slots");

  const openCreate = (time: string) => {
    hapticImpact("medium");
    router.push(`/create?pitchId=${court.pitch.id}&date=${date}&time=${time}`);
  };

  return (
    <div className="rounded-2xl overflow-hidden mx-4" style={{ background: "var(--tg-card)" }}>
      <div className="flex gap-3 p-3">
        <div className="w-16 h-16 shrink-0">
          <PhotoOrInitials src={court.pitch.photo} initials={initialsOf(court.pitch.name)} className="w-full h-full" rounded="rounded-xl" initialsClassName="text-white font-bold" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{court.pitch.name}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--tg-hint)" }}>{court.pitch.district}</div>
          <div className="text-xs mt-1 font-medium text-[#00875A]">{t("fromPerHr", { price: formatUZS(court.pitch.hourlyRate) })}</div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <div className="text-[11px] mb-1.5" style={{ color: "var(--tg-hint)" }}>{t("freeTitle")}</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {court.slots.map((s) => (
            <button key={s} onClick={() => openCreate(s)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold text-white active:scale-95 transition-transform"
              style={{ background: "#00C853" }}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
