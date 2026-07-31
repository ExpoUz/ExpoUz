"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { LOCALES, LOCALE_LABELS, useLocale, setLocale, type Locale } from "@/lib/locale-store";
import { api } from "@/lib/api";
import { hapticImpact, showAlert } from "@/lib/telegram";

/**
 * Inline language selector for the profile/settings screen. Persists the choice
 * locally (instant UI switch) and to the user record (survives restart/device).
 */
export function LanguageSwitcher() {
  const active = useLocale();
  const t = useTranslations("language");
  const [saving, setSaving] = useState<Locale | null>(null);

  async function choose(next: Locale) {
    if (next === active) return;
    hapticImpact("light");
    setLocale(next); // instant switch — the whole app re-renders
    setSaving(next);
    try {
      await api.patch("/users/me", { language: next });
    } catch {
      // Non-fatal: local preference already applied; it'll sync next save.
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--tg-card)" }}>
      {LOCALES.map((loc, i) => (
        <button
          key={loc}
          onClick={() => choose(loc)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          style={{
            borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.06)",
            color: loc === active ? "#00C853" : "var(--tg-text)",
          }}
        >
          <span className="font-medium">{LOCALE_LABELS[loc]}</span>
          {loc === active && <Check size={18} />}
          {saving === loc && (
            <span className="w-4 h-4 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
          )}
        </button>
      ))}
    </div>
  );
}
