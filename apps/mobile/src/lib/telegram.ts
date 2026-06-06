/**
 * Telegram Mini App integration helper.
 * Works in both web (Telegram WebApp API) and native (Expo) contexts.
 */

import { Platform } from 'react-native';

/**
 * Returns true when the app is running inside a Telegram Mini App context (web mode).
 */
export function isTelegramMiniApp(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  return !!(window as any)?.Telegram?.WebApp?.initData;
}

/**
 * Get the raw initData string from Telegram WebApp.
 * Only available on web platform inside Telegram.
 */
export function getTelegramInitData(): string | null {
  if (!isTelegramMiniApp()) return null;
  return (window as any)?.Telegram?.WebApp?.initData ?? null;
}

/**
 * Get Telegram user info directly from the Mini App context.
 */
export function getTelegramUser(): {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
} | null {
  if (!isTelegramMiniApp()) return null;
  const tg = (window as any)?.Telegram?.WebApp;
  return tg?.initDataUnsafe?.user ?? null;
}

/**
 * Call Telegram's ready() to hide the loading screen.
 */
export function telegramReady(): void {
  if (isTelegramMiniApp()) {
    (window as any)?.Telegram?.WebApp?.ready();
  }
}

/**
 * Expand the Telegram Mini App to full screen.
 */
export function telegramExpand(): void {
  if (isTelegramMiniApp()) {
    (window as any)?.Telegram?.WebApp?.expand();
  }
}

/**
 * Set the Telegram Mini App header color.
 */
export function setTelegramHeaderColor(color: string): void {
  if (isTelegramMiniApp()) {
    (window as any)?.Telegram?.WebApp?.setHeaderColor(color);
  }
}

/**
 * Close the Mini App.
 */
export function closeTelegramApp(): void {
  if (isTelegramMiniApp()) {
    (window as any)?.Telegram?.WebApp?.close();
  }
}
