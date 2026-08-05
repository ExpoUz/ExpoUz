import dayjs from "dayjs";

/** Filled seats, mirroring the logic used by the match cards. */
export function filledSeats(m: any): number {
  return m?.currentPlayers ?? m?._count?.bookings ?? m?.bookings?.length ?? 0;
}

export function spotsLeft(m: any): number {
  return Math.max(0, (m?.maxPlayers ?? 0) - filledSeats(m));
}

/** First venue photo if present. */
export function matchPhoto(m: any): string | null {
  return m?.pitch?.photos?.[0] ?? null;
}

export function venueName(m: any): string {
  return m?.pitch?.name ?? "";
}

export function venueArea(m: any): string {
  return m?.pitch?.district ?? m?.pitch?.city ?? "";
}

export function sportBadge(sport?: string): string {
  return sport === "FOOTBALL" ? "⚽" : "🎾";
}

const byStartAsc = (a: any, b: any) =>
  dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf();

/**
 * Derive the discovery sections from the single (already filtered) matches
 * list — no parallel fetching. The hero match is excluded from the carousels so
 * it never appears twice.
 */
export function deriveSections(matches: any[]) {
  const now = dayjs();
  const upcoming = matches
    .filter((m) => dayjs(m.startTime).isAfter(now))
    .sort(byStartAsc);

  const todayUpcoming = upcoming.filter((m) =>
    dayjs(m.startTime).isSame(now, "day"),
  );
  const todayWithSpots = todayUpcoming.filter((m) => spotsLeft(m) > 0);

  // Hero: soonest match today with open spots → else next upcoming → else none.
  const hero = todayWithSpots[0] ?? upcoming[0] ?? null;
  const heroId = hero?.id;

  const today = todayUpcoming.filter((m) => m.id !== heroId);
  const open = upcoming.filter((m) => m.id !== heroId && spotsLeft(m) > 0);

  return { hero, today, open };
}
