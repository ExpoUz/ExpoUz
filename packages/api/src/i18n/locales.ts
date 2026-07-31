/**
 * Locale configuration — the single source of truth for which languages the
 * platform supports. Adding a locale (e.g. 'uz-Cyrl') is a data change here plus
 * a matching messages file; no code elsewhere hardcodes the list of three.
 */
export const SUPPORTED_LOCALES = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'uz';

/** Fallback chain when a key is missing in the active locale: uz → ru → en. */
export const FALLBACK_ORDER: Locale[] = ['uz', 'ru', 'en'];

export function isSupportedLocale(x: unknown): x is Locale {
  return typeof x === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(x);
}

/**
 * Map an arbitrary language tag (Telegram `language_code`, Accept-Language, a
 * stored preference) to a supported locale. Matches on the primary subtag so
 * 'ru-RU' → 'ru', 'uz-Latn' → 'uz'. Anything unknown falls back to `en` as the
 * dev/base language, NOT the default — Telegram giving us 'de' means the user is
 * likelier to read English than Uzbek.
 */
export function normalizeLocale(code?: string | null): Locale {
  if (!code) return DEFAULT_LOCALE;
  const primary = code.toLowerCase().split(/[-_]/)[0];
  if (isSupportedLocale(primary)) return primary;
  return 'en';
}
