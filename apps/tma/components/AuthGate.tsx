"use client";

import { useAuth } from "@/lib/auth";
import { BrowserLogin } from "./BrowserLogin";
import { Logo } from "./Logo";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, error, retry, browserLogin } = useAuth();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Logo size={72} />
        <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[color:var(--tg-hint)]">Signing you in…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    // Browser context with the fallback enabled — show the phone+OTP form
    // instead of the "open from Telegram" message. The Telegram path is
    // untouched: if initData exists it always wins in AuthProvider.
    if (browserLogin) {
      return <BrowserLogin />;
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center">
        <Logo size={72} />
        <div className="text-xl font-bold">Sign-in required</div>
        <p className="text-sm text-[color:var(--tg-hint)] max-w-xs">{error}</p>
        <button
          onClick={retry}
          className="mt-2 px-5 py-2.5 rounded-xl bg-[#00C853] text-white font-semibold text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
