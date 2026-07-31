"use client";

import { useSyncExternalStore } from "react";

// Data-driven locale list — adding one (e.g. "uz-Cyrl") means adding a messages
// file and an entry here, no other code changes.
export const LOCALES = ["uz", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";

export const LOCALE_LABELS: Record<Locale, string> = {
  uz: "O'zbek",
  ru: "Русский",
  en: "English",
};

const STORAGE_KEY = "expouz_locale";
// Marks that the user made an explicit choice (so we don't overwrite it with a
// re-detected value). Also gates the first-run picker.
const CHOSEN_KEY = "expouz_locale_chosen";

function normalize(code?: string | null): Locale | null {
  if (!code) return null;
  const primary = code.toLowerCase().split(/[-_]/)[0];
  return (LOCALES as readonly string[]).includes(primary) ? (primary as Locale) : null;
}

/** Telegram → navigator → default. Used only when nothing is saved. */
function detect(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const tg = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  return normalize(tg) ?? normalize(navigator.language) ?? DEFAULT_LOCALE;
}

function read(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  return normalize(localStorage.getItem(STORAGE_KEY)) ?? detect();
}

let locale: Locale = read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Explicit user choice: persist and mark as chosen. */
export function setLocale(next: Locale) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, next);
    localStorage.setItem(CHOSEN_KEY, "1");
  }
  if (locale === next) return;
  locale = next;
  emit();
}

/**
 * Adopt the server-saved preference (detection order #1) without marking it as
 * an explicit local choice — used when /users/me loads.
 */
export function adoptServerLocale(next?: string | null) {
  const n = normalize(next);
  if (!n || locale === n) return;
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, n);
  locale = n;
  emit();
}

export function hasChosenLocale(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(CHOSEN_KEY) === "1";
}

export function getLocale(): Locale {
  return locale;
}

export function useLocale(): Locale {
  return useSyncExternalStore(
    subscribe,
    () => locale,
    () => DEFAULT_LOCALE,
  );
}
