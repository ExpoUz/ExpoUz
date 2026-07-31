"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Check } from "lucide-react";
import { SPORTS, sportMeta, type Sport } from "@/lib/sport-store";
import { hapticImpact } from "@/lib/telegram";

export function SportCityHeader({
  sport,
  city,
  onSportChange,
  onCityClick,
}: {
  sport: Sport;
  city: string;
  onSportChange: (s: Sport) => void;
  onCityClick: () => void;
}) {
  const [sportOpen, setSportOpen] = useState(false);
  const t = useTranslations("sports");
  const tHome = useTranslations("home");
  const current = sportMeta(sport);
  const sportLabel = (s: Sport) => t(s === "PADEL" ? "padel" : "football");

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          className="dropdown"
          onClick={() => {
            hapticImpact("light");
            setSportOpen(true);
          }}
        >
          <span>{current.icon}</span>
          <span className="font-bold underline underline-offset-4">{sportLabel(sport)}</span>
          <ChevronDown size={16} />
        </button>
        <span className="text-sm" style={{ color: "var(--tg-hint)" }}>
          {tHome("in")}
        </span>
        <button
          className="dropdown"
          onClick={() => {
            hapticImpact("light");
            onCityClick();
          }}
        >
          <span className="font-bold underline underline-offset-4">{city}</span>
          <ChevronDown size={16} />
        </button>
      </div>

      {sportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={() => setSportOpen(false)}
        >
          <div
            className="w-full max-h-[70vh] overflow-y-auto rounded-t-3xl p-4 animate-sheet-up"
            style={{
              background: "var(--tg-bg)",
              paddingBottom: "calc(72px + env(safe-area-inset-bottom))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-bold text-base mb-3">{t("chooseSport")}</div>
            {SPORTS.map((s) => {
              const selected = s.id === sport;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    hapticImpact("light");
                    onSportChange(s.id);
                    setSportOpen(false);
                  }}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left"
                  style={{ color: selected ? "#00C853" : "var(--tg-text)" }}
                >
                  <span className="text-2xl">{s.icon}</span>
                  <span className="font-medium flex-1">{sportLabel(s.id)}</span>
                  {selected && <Check size={18} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        .dropdown {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 999px;
          background: var(--tg-card);
          font-size: 15px;
        }
      `}</style>
    </>
  );
}
