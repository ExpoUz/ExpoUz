"use client";

import { useSyncExternalStore } from "react";

export type Sport = "FOOTBALL" | "PADEL";

export interface SportMeta {
  id: Sport;
  label: string;
  icon: string;
  venueWord: string; // "Pitch" | "Court"
  formats: { id: string; label: string; maxPlayers: number }[];
}

export const SPORTS: SportMeta[] = [
  {
    id: "FOOTBALL",
    label: "Football",
    icon: "⚽",
    venueWord: "Pitch",
    formats: [
      { id: "5v5", label: "5 vs 5", maxPlayers: 10 },
      { id: "6v6", label: "6 vs 6", maxPlayers: 12 },
    ],
  },
  {
    id: "PADEL",
    label: "Padel",
    icon: "🎾",
    venueWord: "Court",
    formats: [
      { id: "1v1", label: "Singles (1v1)", maxPlayers: 2 },
      { id: "2v2", label: "Doubles (2v2)", maxPlayers: 4 },
    ],
  },
];

export function sportMeta(sport: Sport): SportMeta {
  return SPORTS.find((s) => s.id === sport) ?? SPORTS[1];
}

// ─── Minimal external store (avoids adding a state-management dependency) ─────
const STORAGE_KEY = "expouz_selected_sport";
const CITY_KEY = "expouz_selected_city";

interface State {
  sport: Sport;
  city: string;
}

function read(): State {
  if (typeof window === "undefined") return { sport: "PADEL", city: "Tashkent" };
  const sport = (localStorage.getItem(STORAGE_KEY) as Sport) || "PADEL";
  const city = localStorage.getItem(CITY_KEY) || "Tashkent";
  return { sport: sport === "FOOTBALL" ? "FOOTBALL" : "PADEL", city };
}

let state: State = read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setSport(sport: Sport) {
  if (state.sport === sport) return;
  state = { ...state, sport };
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, sport);
  emit();
}

export function setCity(city: string) {
  if (state.city === city) return;
  state = { ...state, city };
  if (typeof window !== "undefined") localStorage.setItem(CITY_KEY, city);
  emit();
}

const SERVER_SNAPSHOT: State = { sport: "PADEL", city: "Tashkent" };

export function useSportStore(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_SNAPSHOT,
  );
}
