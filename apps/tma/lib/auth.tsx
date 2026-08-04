"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { getInitData, getTelegramUser, initTelegram } from "./telegram";
import { adoptServerLocale } from "./locale-store";

interface TmaUser {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatarUrl?: string;
  role?: string;
  eloRating?: number;
  reliabilityScore?: number;
  skillLevel?: string;
  padelLevel?: number;
  padelReliability?: number;
  padelInitialSet?: boolean;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

// Opt-in browser (non-Telegram) login. Off by default so production behavior is
// unchanged; when on, an unauthenticated browser gets a phone+OTP form.
const BROWSER_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_BROWSER_LOGIN === "true";

interface AuthContextValue {
  user: TmaUser | null;
  status: AuthStatus;
  error: string | null;
  retry: () => void;
  /** True when the unauthenticated screen should show the browser login form. */
  browserLogin: boolean;
  /** Persist a session obtained outside the Telegram path (e.g. phone+OTP). */
  completeLogin: (data: {
    accessToken: string;
    refreshToken: string;
    user: TmaUser & { language?: string };
  }) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: "loading",
  error: null,
  retry: () => {},
  browserLogin: false,
  completeLogin: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TmaUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [browserLogin, setBrowserLogin] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setStatus("loading");
      setError(null);
      setBrowserLogin(false);
      initTelegram();

      // Already have a session? Trust it but refresh the profile.
      const existing = localStorage.getItem("tma_access_token");
      if (existing) {
        try {
          const { data } = await api.get("/users/me");
          if (!cancelled) {
            setUser(data);
            localStorage.setItem("tma_user", JSON.stringify(data));
            adoptServerLocale(data.language); // saved preference wins (detection #1)
            setStatus("authenticated");
          }
          return;
        } catch {
          // Dead session (e.g. tokens from before a DB reset) — drop both
          // tokens and fall through to a fresh Telegram initData login.
          localStorage.removeItem("tma_access_token");
          localStorage.removeItem("tma_refresh_token");
        }
      }

      const initData = getInitData();
      if (!initData) {
        // Outside Telegram (e.g. plain browser). With the browser-login flag on,
        // show the phone+OTP form; otherwise keep the "open from Telegram" message.
        if (!cancelled) {
          if (BROWSER_LOGIN_ENABLED) {
            setBrowserLogin(true);
          } else {
            const tgUser = getTelegramUser();
            setError(
              tgUser
                ? "Could not read Telegram sign-in data."
                : "Open this app from inside Telegram to sign in."
            );
          }
          setStatus("unauthenticated");
        }
        return;
      }

      try {
        const { data } = await api.post("/auth/telegram", { initData });
        if (cancelled) return;
        localStorage.setItem("tma_access_token", data.accessToken);
        localStorage.setItem("tma_refresh_token", data.refreshToken);
        localStorage.setItem("tma_user", JSON.stringify(data.user));
        adoptServerLocale(data.user?.language);
        setUser(data.user);
        setStatus("authenticated");
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.data?.message ?? "Telegram sign-in failed.");
        setStatus("unauthenticated");
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Persist a browser (phone+OTP) session exactly like the Telegram path above.
  function completeLogin(data: {
    accessToken: string;
    refreshToken: string;
    user: TmaUser & { language?: string };
  }) {
    localStorage.setItem("tma_access_token", data.accessToken);
    localStorage.setItem("tma_refresh_token", data.refreshToken);
    localStorage.setItem("tma_user", JSON.stringify(data.user));
    adoptServerLocale(data.user?.language);
    setUser(data.user);
    setError(null);
    setBrowserLogin(false);
    setStatus("authenticated");
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        error,
        retry: () => setAttempt((a) => a + 1),
        browserLogin,
        completeLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
