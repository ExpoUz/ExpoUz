"use client";

import { NextIntlClientProvider } from "next-intl";
import { useLocale } from "./locale-store";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";
import en from "@/messages/en.json";

const MESSAGES: Record<string, any> = { ru, uz, en };

/**
 * Client-side next-intl provider for the admin panel (no URL routing). Locale
 * comes from the locale store (saved preference → navigator → ru). Missing keys
 * fall back ru → en so the UI never shows a raw key.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES[locale] ?? MESSAGES.ru}
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
