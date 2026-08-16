/**
 * Shared date/currency formatting. One source of truth so both admin panels
 * render money and dates identically.
 */

/** "50 000 UZS" — thousands grouped with spaces (uz/ru convention). */
export function formatUZS(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(n as number)) return "0 UZS";
  return `${Math.round(n as number).toLocaleString("ru-RU").replace(/,/g, " ")} UZS`;
}

/** Short date, e.g. "16 Aug 2026". */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Date + time, e.g. "16 Aug 2026, 19:00". */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatDate(d)}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}
