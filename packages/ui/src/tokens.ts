/**
 * Shared design tokens for the admin surfaces (Super Admin + Pitch Portal).
 * Light "Stadium Ops" theme. Components reference these so both panels stay
 * visually identical — change a colour here, both panels move together.
 */
export const tokens = {
  brand: "#00C853",
  brandDark: "#00875A",
  ink: "#0D1117",
  muted: "#6B7280",
  border: "#E5E7EB",
  surface: "#FFFFFF",
  danger: "#EF4444",
  dangerText: "#B91C1C",
  warn: "#F59E0B",
  info: "#00B0FF",
} as const;

/** Status → pill colours, shared by both panels. */
export const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-[#00C853]/15 text-[#00875A]",
  FULL: "bg-[#F59E0B]/15 text-[#B45309]",
  CONFIRMED: "bg-[#00B0FF]/15 text-[#0369A1]",
  IN_PROGRESS: "bg-[#8B5CF6]/15 text-[#6D28D9]",
  COMPLETED: "bg-[#6B7280]/15 text-[#374151]",
  CANCELLED: "bg-[#EF4444]/15 text-[#B91C1C]",
  CANCELLED_REFUND: "bg-[#EF4444]/15 text-[#B91C1C]",
  CANCELLED_PENALTY: "bg-[#EF4444]/15 text-[#B91C1C]",
  NO_SHOW: "bg-[#EF4444]/15 text-[#B91C1C]",
  PENDING_PAYMENT: "bg-[#F59E0B]/15 text-[#B45309]",
  PENDING: "bg-[#F59E0B]/15 text-[#B45309]",
  VERIFIED: "bg-[#00C853]/15 text-[#00875A]",
  REJECTED: "bg-[#EF4444]/15 text-[#B91C1C]",
};
