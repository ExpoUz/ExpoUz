"use client";

import { useSyncExternalStore } from "react";

export type SportFilter = "ALL" | "FOOTBALL" | "PADEL";

export const SPORT_OPTIONS: { id: SportFilter; label: string; icon: string }[] = [
  { id: "ALL", label: "All Sports", icon: "🏅" },
  { id: "FOOTBALL", label: "Football", icon: "⚽" },
  { id: "PADEL", label: "Padel", icon: "🎾" },
];

// `undefined` when ALL, so callers can spread it straight into request params.
export function sportParam(s: SportFilter): string | undefined {
  return s === "ALL" ? undefined : s;
}

const KEY = "admin_sport_filter";
let state: SportFilter =
  typeof window !== "undefined" ? ((localStorage.getItem(KEY) as SportFilter) || "ALL") : "ALL";
const listeners = new Set<() => void>();

export function setSportFilter(s: SportFilter) {
  if (state === s) return;
  state = s;
  if (typeof window !== "undefined") localStorage.setItem(KEY, s);
  listeners.forEach((l) => l());
}

export function useSportFilter(): SportFilter {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => "ALL",
  );
}
