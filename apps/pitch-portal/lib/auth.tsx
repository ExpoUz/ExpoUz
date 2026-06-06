"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface PortalUser {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: "PITCH_OWNER" | "ADMIN" | "SUPER_ADMIN";
}

interface AuthContextValue {
  user: PortalUser | null;
  token: string | null;
  logout: () => void;
  setAuth: (token: string, refreshToken: string, user: PortalUser) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  logout: () => {},
  setAuth: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PortalUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("portal_access_token");
    const storedUser = localStorage.getItem("portal_user");
    if (stored && storedUser) {
      setToken(stored);
      setUser(JSON.parse(storedUser));
      document.cookie = `portal_token=${stored}; path=/; max-age=${60 * 60 * 24 * 7}`;
    } else {
      router.replace("/login");
    }
  }, []);

  function setAuth(accessToken: string, refreshToken: string, portalUser: PortalUser) {
    setToken(accessToken);
    setUser(portalUser);
    localStorage.setItem("portal_access_token", accessToken);
    localStorage.setItem("portal_refresh_token", refreshToken);
    localStorage.setItem("portal_user", JSON.stringify(portalUser));
    document.cookie = `portal_token=${accessToken}; path=/; max-age=${60 * 60 * 24 * 7}`;
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("portal_access_token");
    localStorage.removeItem("portal_refresh_token");
    localStorage.removeItem("portal_user");
    document.cookie = "portal_token=; path=/; max-age=0";
    router.replace("/login");
  }

  return (
    <AuthContext.Provider value={{ user, token, logout, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
