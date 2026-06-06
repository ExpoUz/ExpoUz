"use client";

/**
 * Lightweight Telegram WebApp wrapper.
 *
 * We talk to the global `window.Telegram.WebApp` object provided by Telegram's
 * official `telegram-web-app.js` script (loaded in the root layout). This avoids
 * an extra SDK dependency and degrades gracefully when opened outside Telegram
 * (e.g. in a normal browser during development).
 */

type WebApp = any;

function getWebApp(): WebApp | null {
  if (typeof window === "undefined") return null;
  return (window as any)?.Telegram?.WebApp ?? null;
}

export function isInTelegram(): boolean {
  const wa = getWebApp();
  return !!wa?.initData;
}

export function initTelegram(): void {
  const wa = getWebApp();
  if (!wa) return;
  try {
    wa.ready();
    wa.expand();
    // Sync header/background with our brand-friendly theme
    wa.setHeaderColor?.("secondary_bg_color");
  } catch {
    /* no-op outside Telegram */
  }
}

export function getInitData(): string | null {
  return getWebApp()?.initData || null;
}

export function getTelegramUser(): {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
} | null {
  return getWebApp()?.initDataUnsafe?.user ?? null;
}

export function getColorScheme(): "light" | "dark" {
  return getWebApp()?.colorScheme ?? "light";
}

// ─── Main Button ──────────────────────────────────────────────
export function showMainButton(text: string, onClick: () => void, color = "#00C853") {
  const wa = getWebApp();
  if (!wa?.MainButton) return () => {};
  const btn = wa.MainButton;
  btn.setText(text);
  btn.color = color;
  btn.textColor = "#FFFFFF";
  btn.onClick(onClick);
  btn.show();
  btn.enable();
  // Return a cleanup that detaches this handler
  return () => {
    try {
      btn.offClick(onClick);
      btn.hide();
    } catch {
      /* no-op */
    }
  };
}

export function setMainButtonLoading(loading: boolean) {
  const btn = getWebApp()?.MainButton;
  if (!btn) return;
  if (loading) btn.showProgress?.();
  else btn.hideProgress?.();
}

export function hideMainButton() {
  getWebApp()?.MainButton?.hide();
}

// ─── Back Button ──────────────────────────────────────────────
export function showBackButton(onClick: () => void) {
  const wa = getWebApp();
  if (!wa?.BackButton) return () => {};
  const btn = wa.BackButton;
  btn.onClick(onClick);
  btn.show();
  return () => {
    try {
      btn.offClick(onClick);
      btn.hide();
    } catch {
      /* no-op */
    }
  };
}

// ─── Haptics ──────────────────────────────────────────────────
export function hapticImpact(style: "light" | "medium" | "heavy" = "light") {
  getWebApp()?.HapticFeedback?.impactOccurred?.(style);
}
export function hapticSuccess() {
  getWebApp()?.HapticFeedback?.notificationOccurred?.("success");
}
export function hapticError() {
  getWebApp()?.HapticFeedback?.notificationOccurred?.("error");
}

export function showAlert(message: string) {
  const wa = getWebApp();
  if (wa?.showAlert) wa.showAlert(message);
  else if (typeof window !== "undefined") window.alert(message);
}
