"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { getSlotCounts } from "@/lib/api";
import { hapticImpact } from "@/lib/telegram";

export interface SlotFilter {
  date: string; // YYYY-MM-DD
  from?: string;
  to?: string;
  slots: string[]; // explicitly chosen slot chips (union)
  mode: "games" | "free";
}

const PRESETS = [
  { key: "morning", from: "06:00", to: "12:00" },
  { key: "afternoon", from: "12:00", to: "17:00" },
  { key: "evening", from: "17:00", to: "22:00" },
  { key: "late", from: "22:00", to: "23:59" },
] as const;

/**
 * "When do you want to play?" sheet. Two intents: games to join vs free courts.
 * Slot chips show live counts so the user sees where the activity is. The Free
 * toggle hides entirely when no venue in the city has opening hours.
 */
export function SlotSheet({
  sport,
  city,
  district,
  initial,
  onApply,
  onClose,
}: {
  sport: string;
  city?: string;
  district?: string;
  initial: SlotFilter | null;
  onApply: (f: SlotFilter | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations("slots");
  const [date, setDate] = useState(initial?.date ?? dayjs().format("YYYY-MM-DD"));
  const [from, setFrom] = useState<string | undefined>(initial?.from);
  const [to, setTo] = useState<string | undefined>(initial?.to);
  const [slots, setSlots] = useState<string[]>(initial?.slots ?? []);
  const [mode, setMode] = useState<"games" | "free">(initial?.mode ?? "games");

  const { data: counts } = useQuery({
    queryKey: ["slot-counts", sport, city, district, date],
    queryFn: () => getSlotCounts({ sport, date, city, district }),
  });

  const today = dayjs().format("YYYY-MM-DD");
  const tomorrow = dayjs().add(1, "day").format("YYYY-MM-DD");

  const freeAvailable = counts?.freeCourtsAvailable ?? false;
  // If the free toggle isn't available, force games mode.
  const effectiveMode = !freeAvailable && mode === "free" ? "games" : mode;

  const toggleSlot = (s: string) => {
    hapticImpact("light");
    setFrom(undefined);
    setTo(undefined);
    setSlots((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const pickPreset = (p: (typeof PRESETS)[number]) => {
    hapticImpact("light");
    setSlots([]);
    if (from === p.from && to === p.to) { setFrom(undefined); setTo(undefined); }
    else { setFrom(p.from); setTo(p.to); }
  };

  const hasWindow = slots.length > 0 || (from && to);
  const chips = counts?.chips ?? [];

  const apply = () => {
    hapticImpact("medium");
    onApply({ date, from, to, slots, mode: effectiveMode });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--tg-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">{t("title")}</h2>

        {/* Date */}
        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--tg-hint)" }}>{t("date")}</div>
        <div className="flex gap-2 mb-4">
          <Chip active={date === today} onClick={() => { setDate(today); }}>{t("today")}</Chip>
          <Chip active={date === tomorrow} onClick={() => { setDate(tomorrow); }}>{t("tomorrow")}</Chip>
          <label className={`px-3 py-2 rounded-xl text-sm font-semibold relative ${date !== today && date !== tomorrow ? "text-white" : ""}`}
            style={{ background: date !== today && date !== tomorrow ? "#00C853" : "var(--tg-card)" }}>
            {date !== today && date !== tomorrow ? dayjs(date).format("MMM D") : t("pick")}
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className="absolute inset-0 opacity-0" />
          </label>
        </div>

        {/* Time presets */}
        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--tg-hint)" }}>{t("time")}</div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {PRESETS.map((p) => (
            <Chip key={p.key} active={from === p.from && to === p.to} onClick={() => pickPreset(p)}>{t(p.key)}</Chip>
          ))}
        </div>

        {/* Slot chips with counts */}
        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--tg-hint)" }}>{t("orChooseSlot")}</div>
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {chips.map((c) => {
            const active = slots.includes(c.slot);
            const label = effectiveMode === "free"
              ? (c.free ? t("free") : "—")
              : (c.games > 0 ? `${c.games}` : "·");
            return (
              <button key={c.slot} onClick={() => toggleSlot(c.slot)}
                className="shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border transition-colors"
                style={{
                  background: active ? "#0D1117" : "var(--tg-card)",
                  color: active ? "#fff" : "var(--tg-text)",
                  borderColor: active ? "#0D1117" : "transparent",
                }}>
                <span className="text-sm font-semibold">{c.slot}</span>
                <span className="text-[11px]" style={{ color: active ? "rgba(255,255,255,0.7)" : (c.free || c.games ? "#00875A" : "var(--tg-hint)") }}>
                  {label}
                </span>
              </button>
            );
          })}
          {chips.length === 0 && <span className="text-sm py-2" style={{ color: "var(--tg-hint)" }}>{t("loading")}</span>}
        </div>

        {/* Show toggle (Free hidden when no hours anywhere) */}
        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--tg-hint)" }}>{t("show")}</div>
        <div className="flex gap-2 mb-5">
          <SegBtn active={effectiveMode === "games"} onClick={() => setMode("games")}>{t("gamesToJoin")}</SegBtn>
          {freeAvailable && <SegBtn active={effectiveMode === "free"} onClick={() => setMode("free")}>{t("freeCourts")}</SegBtn>}
        </div>

        <div className="flex gap-2">
          {(hasWindow || initial) && (
            <button onClick={() => { hapticImpact("light"); onApply(null); onClose(); }}
              className="px-4 py-3 rounded-2xl text-sm font-semibold" style={{ background: "var(--tg-card)" }}>
              {t("reset")}
            </button>
          )}
          <button onClick={apply} className="flex-1 rounded-2xl py-3 text-sm font-bold text-white" style={{ background: "#00C853" }}>
            {t("apply")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
      style={{ background: active ? "#00C853" : "var(--tg-card)", color: active ? "#fff" : "var(--tg-text)" }}>
      {children}
    </button>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
      style={{ background: active ? "#0D1117" : "var(--tg-card)", color: active ? "#fff" : "var(--tg-text)" }}>
      {children}
    </button>
  );
}

/** Human summary for the applied pill, e.g. "19:00 +1" or "Evening". */
export function slotFilterLabel(f: SlotFilter, t: (k: string) => string): string {
  if (f.slots.length === 1) return f.slots[0];
  if (f.slots.length > 1) return `${f.slots[0]} +${f.slots.length - 1}`;
  if (f.from && f.to) {
    const preset = PRESETS.find((p) => p.from === f.from && p.to === f.to);
    if (preset) return t(preset.key);
    return `${f.from}–${f.to}`;
  }
  return dayjs(f.date).format("MMM D");
}
