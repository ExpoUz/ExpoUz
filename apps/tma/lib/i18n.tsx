"use client";

import { NextIntlClientProvider } from "next-intl";
import { useLocale } from "./locale-store";
import uz from "@/messages/uz.json";
import ru from "@/messages/ru.json";
import en from "@/messages/en.json";

const MESSAGES: Record<string, any> = { uz, ru, en };

/**
 * Client-side next-intl provider (no URL routing — a Telegram Mini App lives on
 * a single path). Locale comes from the locale store (saved preference →
 * Telegram → navigator → uz). Missing keys fall back uz → ru → en so the UI
 * never shows a raw key.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES[locale] ?? MESSAGES.uz}
      timeZone="Asia/Tashkent"
      now={new Date()}
      getMessageFallback={({ key }) => {
        for (const l of ["ru", "en"]) {
          const val = key.split(".").reduce<any>((o, k) => (o == null ? o : o[k]), MESSAGES[l]);
          if (typeof val === "string") return val;
        }
        return key;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
