"use client";

import { LOCALES, LOCALE_LABELS, useLocale, setLocale, type Locale } from "@/lib/locale-store";

/**
 * Compact language selector for the admin sidebar/header. Purely client-side —
 * admin UI strings switch instantly; there is no per-admin stored preference.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const active = useLocale();
  return (
    <select
      value={active}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className={`text-xs rounded-md bg-white/10 text-white border border-white/15 px-2 py-1 outline-none ${className}`}
      aria-label="Language"
    >
      {LOCALES.map((loc) => (
        <option key={loc} value={loc} className="text-black">
          {LOCALE_LABELS[loc]}
        </option>
      ))}
    </select>
  );
}
