"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, useToast } from "@expouz/ui";
import { setOpeningHours, type OpeningHours, type DayHours } from "@/lib/api";

const DAYS: { key: keyof OpeningHours; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

/**
 * Owner editor for a venue's operating hours + slot/court config. A day toggled
 * off = closed. "Same every day" copies Monday's hours across. This data powers
 * the player-facing "Free courts" availability filter.
 */
export function OpeningHoursModal({ pitch, onClose }: { pitch: any; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const initial: OpeningHours = pitch.openingHours ?? {};
  const [hours, setHours] = useState<Record<string, DayHours | undefined>>(() => {
    const h: Record<string, DayHours | undefined> = {};
    for (const d of DAYS) h[d.key] = initial[d.key];
    return h;
  });
  const [slotDuration, setSlotDuration] = useState<number>(pitch.slotDuration ?? 60);
  const [courtCount, setCourtCount] = useState<number>(pitch.courtCount ?? 1);

  const save = useMutation({
    mutationFn: () => {
      const clean: OpeningHours = {};
      for (const d of DAYS) {
        const v = hours[d.key];
        if (v && v.open && v.close) clean[d.key] = { open: v.open, close: v.close };
      }
      return setOpeningHours(pitch.id, {
        openingHours: Object.keys(clean).length ? clean : null,
        slotDuration,
        courtCount,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-pitches"] });
      toast.success("Opening hours saved");
      onClose();
    },
    onError: () => toast.error("Could not save opening hours"),
  });

  const toggleDay = (key: string, on: boolean) =>
    setHours((h) => ({ ...h, [key]: on ? h[key] ?? { open: "08:00", close: "23:00" } : undefined }));

  const setField = (key: string, field: "open" | "close", val: string) =>
    setHours((h) => ({ ...h, [key]: { ...(h[key] ?? { open: "08:00", close: "23:00" }), [field]: val } }));

  const sameEveryDay = () => {
    const monday = hours.mon ?? { open: "08:00", close: "23:00" };
    const next: Record<string, DayHours> = {};
    for (const d of DAYS) next[d.key] = { ...monday };
    setHours(next);
  };

  return (
    <Modal
      title="Opening hours"
      subtitle={pitch.name}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6]">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#00C853] text-white hover:bg-[#00b34a] disabled:opacity-50">
            {save.isPending ? "Saving…" : "Save hours"}
          </button>
        </>
      }
    >
        <div className="space-y-4">
          <p className="text-xs text-[#6B7280] bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-3 py-2">
            Add your opening hours so players can find your free slots and book a game.
          </p>

          <button onClick={sameEveryDay} className="text-xs font-semibold text-[#00875A] hover:underline">
            Copy Monday to every day
          </button>

          <div className="space-y-2">
            {DAYS.map((d) => {
              const v = hours[d.key];
              const on = !!v;
              return (
                <div key={String(d.key)} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 w-28 shrink-0">
                    <input type="checkbox" checked={on} onChange={(e) => toggleDay(String(d.key), e.target.checked)} className="accent-[#00C853]" />
                    <span className="text-sm text-[#374151]">{d.label}</span>
                  </label>
                  {on ? (
                    <div className="flex items-center gap-2">
                      <input type="time" value={v!.open} onChange={(e) => setField(String(d.key), "open", e.target.value)}
                        className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm" />
                      <span className="text-[#9CA3AF]">–</span>
                      <input type="time" value={v!.close} onChange={(e) => setField(String(d.key), "close", e.target.value)}
                        className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                  ) : (
                    <span className="text-sm text-[#9CA3AF]">Closed</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <label className="block">
              <span className="text-xs text-[#6B7280]">Slot length</span>
              <select value={slotDuration} onChange={(e) => setSlotDuration(+e.target.value)}
                className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm">
                {[30, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[#6B7280]">Parallel courts</span>
              <input type="number" min={1} max={20} value={courtCount} onChange={(e) => setCourtCount(Math.max(1, +e.target.value || 1))}
                className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm" />
            </label>
          </div>
        </div>
    </Modal>
  );
}
