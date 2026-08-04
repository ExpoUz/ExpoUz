"use client";

import { useSyncExternalStore } from "react";

// Data-driven locale list — adding one needs a messages file + an entry here.
export const LOCALES = ["ru", "uz", "en"] as const;
export type Locale = (typeof LOCALES)[number];
// Admin operators are predominantly Russian-speaking — default to ru.
export const DEFAULT_LOCALE: Locale = "ru";

export const LOCALE_LABELS: Record<Locale, string> = {
  ru: "Русский",
  uz: "O'zbek",
  en: "English",
};

const STORAGE_KEY = "admin_locale";

function normalize(code?: string | null): Locale | null {
  if (!code) return null;
  const primary = code.toLowerCase().split(/[-_]/)[0];
  return (LOCALES as readonly string[]).includes(primary) ? (primary as Locale) : null;
}

function read(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  return normalize(localStorage.getItem(STORAGE_KEY)) ?? normalize(navigator.language) ?? DEFAULT_LOCALE;
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

export function setLocale(next: Locale) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, next);
  if (locale === next) return;
  locale = next;
  emit();
}

export function useLocale(): Locale {
  return useSyncExternalStore(
    subscribe,
    () => locale,
    () => DEFAULT_LOCALE,
  );
}
