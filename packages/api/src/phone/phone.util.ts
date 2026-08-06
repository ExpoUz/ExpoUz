/**
 * Phone-number helpers shared across the phone-verification flow.
 *
 * Uzbekistan is the primary market: local numbers are +998 followed by 9
 * digits (12 chars total). We normalise to strict E.164 and treat anything
 * that doesn't match as unverified — this is what distinguishes a real,
 * verified number from the "+998000…" placeholder some accounts carry.
 */

/**
 * Normalise a raw phone string to E.164 (`+` then digits). Strips spaces,
 * dashes and parentheses; adds `+` if the caller passed a bare international
 * number. Does NOT validate country-specific length — use isE164() for that.
 */
export function normalizeE164(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = String(raw).trim().replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  if (!s.startsWith('+')) s = `+${s}`;
  // Keep only a leading '+' and digits.
  s = '+' + s.slice(1).replace(/\D/g, '');
  return s;
}

/** True when `phone` is a plausible E.164 number (7–15 digits after '+'). */
export function isE164(phone: string | null | undefined): boolean {
  return !!phone && /^\+[1-9]\d{6,14}$/.test(phone);
}

/** Mask the middle of a number for display/logs: +998 90 *** ** 45. */
export function maskPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '•'.repeat(digits.length);
  const head = phone.slice(0, phone.length - 6);
  const tail = phone.slice(-2);
  return `${head}****${tail}`;
}
