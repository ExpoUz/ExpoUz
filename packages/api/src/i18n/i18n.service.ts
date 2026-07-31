import { Injectable } from '@nestjs/common';
import { DEFAULT_LOCALE, FALLBACK_ORDER, Locale, normalizeLocale } from './locales';
import uz from './messages/uz';
import ru from './messages/ru';
import en from './messages/en';

const CATALOGS: Record<Locale, any> = { uz, ru, en };

/**
 * Server-side translator for text the API produces as final strings:
 * notifications, bot replies, auto-generated match titles. Client-facing
 * validation/errors should prefer error CODES that the frontend translates —
 * this service is for text that never passes through a client.
 *
 * Supports a small ICU subset: `{name}` interpolation and
 * `{count, plural, one {..} few {..} many {..} other {..}}` with correct
 * language plural rules via Intl.PluralRules (so Russian few/many are right).
 */
@Injectable()
export class I18nService {
  /** Translate `key` (dot-path) in `locale`, falling back uz → ru → en. */
  t(key: string, locale?: string | null, params: Record<string, any> = {}): string {
    const loc = normalizeLocale(locale);
    const raw = this.lookup(key, loc);
    if (raw == null) return key; // last resort: the key itself, never a crash
    return this.format(raw, loc, params);
  }

  private lookup(key: string, loc: Locale): string | null {
    const order: Locale[] = [loc, ...FALLBACK_ORDER.filter((l) => l !== loc)];
    for (const l of order) {
      const val = key.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), CATALOGS[l]);
      if (typeof val === 'string') return val;
    }
    return null;
  }

  private format(template: string, loc: Locale, params: Record<string, any>): string {
    // Resolve ICU plural blocks first, then simple {var} interpolation.
    const withPlurals = template.replace(
      /\{(\w+),\s*plural,\s*([^}]*(?:\{[^}]*\}[^}]*)*)\}/g,
      (_m, varName, body) => {
        const n = Number(params[varName] ?? 0);
        const cat = new Intl.PluralRules(loc).select(n); // one|few|many|other|...
        const branches: Record<string, string> = {};
        const re = /(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g;
        let match: RegExpExecArray | null;
        while ((match = re.exec(body))) branches[match[1]] = match[2];
        const chosen =
          branches[`=${n}`] ?? branches[cat] ?? branches.other ?? '';
        return chosen.replace(/#/g, String(n));
      },
    );
    return withPlurals.replace(/\{(\w+)\}/g, (_m, k) =>
      params[k] == null ? '' : String(params[k]),
    );
  }

  get defaultLocale(): Locale {
    return DEFAULT_LOCALE;
  }
}
