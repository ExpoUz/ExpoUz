"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { LOCALES, LOCALE_LABELS, setLocale, hasChosenLocale, type Locale } from "@/lib/locale-store";
import { api } from "@/lib/api";
import { hapticImpact } from "@/lib/telegram";

/**
 * One-time language picker shown on first open when the user hasn't chosen a
 * language yet. Non-blocking and fast — it defaults to the auto-detected locale
 * if skipped. Renders nothing once a choice exists.
 */
export function FirstRunLanguageGate() {
  const t = useTranslations("language");
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only decide on the client, after hydration, to avoid a flash.
    if (!hasChosenLocale()) setShow(true);
  }, []);

  if (!show) return null;

  function pick(loc: Locale) {
    hapticImpact("light");
    setLocale(loc);
    api.patch("/users/me", { language: loc }).catch(() => {});
    setShow(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" style={{ background: "var(--tg-bg)" }}>
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-3">
          <Languages size={36} style={{ color: "#00C853" }} />
        </div>
        <h1 className="text-xl font-bold mb-1">{t("choose")}</h1>
        <p className="text-sm mb-6" style={{ color: "var(--tg-hint)" }}>
          {t("chooseSub")}
        </p>
        <div className="space-y-3">
          {LOCALES.map((loc) => (
            <button
              key={loc}
              onClick={() => pick(loc)}
              className="w-full py-3.5 rounded-2xl font-semibold text-base active:scale-[0.98] transition-transform"
              style={{ background: "var(--tg-card)", color: "var(--tg-text)" }}
            >
              {LOCALE_LABELS[loc]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
