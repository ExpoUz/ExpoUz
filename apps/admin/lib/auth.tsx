"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: "ADMIN" | "SUPER_ADMIN";
}

interface AuthContextValue {
  user: AdminUser | null;
  token: string | null;
  logout: () => void;
  setAuth: (token: string, refreshToken: string, user: AdminUser) => void;
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
  const [user, setUser] = useState<AdminUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("admin_access_token");
    const storedUser = localStorage.getItem("admin_user");
    if (stored && storedUser) {
      setToken(stored);
      setUser(JSON.parse(storedUser));
      // Also set cookie for middleware
      document.cookie = `admin_token=${stored}; path=/; max-age=${60 * 60 * 24 * 7}`;
    } else {
      router.replace("/login");
    }
  }, []);

  function setAuth(accessToken: string, refreshToken: string, adminUser: AdminUser) {
    setToken(accessToken);
    setUser(adminUser);
    localStorage.setItem("admin_access_token", accessToken);
    localStorage.setItem("admin_refresh_token", refreshToken);
    localStorage.setItem("admin_user", JSON.stringify(adminUser));
    document.cookie = `admin_token=${accessToken}; path=/; max-age=${60 * 60 * 24 * 7}`;
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("admin_access_token");
    localStorage.removeItem("admin_refresh_token");
    localStorage.removeItem("admin_user");
    document.cookie = "admin_token=; path=/; max-age=0";
    router.replace("/login");
  }

  return (
    <AuthContext.Provider value={{ user, token, logout, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
