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

interface AuthContextValue {
  user: TmaUser | null;
  status: AuthStatus;
  error: string | null;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: "loading",
  error: null,
  retry: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TmaUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setStatus("loading");
      setError(null);
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
        // Outside Telegram (e.g. plain browser dev). Surface a clear message.
        if (!cancelled) {
          const tgUser = getTelegramUser();
          setError(
            tgUser
              ? "Could not read Telegram sign-in data."
              : "Open this app from inside Telegram to sign in."
          );
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

  return (
    <AuthContext.Provider value={{ user, status, error, retry: () => setAttempt((a) => a + 1) }}>
      {children}
    </AuthContext.Provider>
  );
}
