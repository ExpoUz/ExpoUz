"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

// Persist tokens to localStorage AND the cookie the middleware checks.
function setSession(accessToken: string, refreshToken: string, user: any) {
  localStorage.setItem("admin_access_token", accessToken);
  localStorage.setItem("admin_refresh_token", refreshToken);
  localStorage.setItem("admin_user", JSON.stringify(user));
  document.cookie = `admin_token=${accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tgChecking, setTgChecking] = useState(true);

  // If launched inside Telegram (@ExpoUzAdminBot), authenticate via initData.
  useEffect(() => {
    const tg = (typeof window !== "undefined" && (window as any).Telegram?.WebApp) || null;
    const initData = tg?.initData;
    if (!initData) {
      setTgChecking(false);
      return;
    }
    tg.ready?.();
    tg.expand?.();
    (async () => {
      try {
        const { data } = await authApi.post("/auth/telegram/admin", { initData });
        setSession(data.accessToken, data.refreshToken, data.user);
        router.replace("/");
      } catch (err: any) {
        setError(
          err?.response?.data?.message ??
            "This Telegram account isn't authorized for admin access.",
        );
        setTgChecking(false);
      }
    })();
  }, [router]);

  if (tgChecking && typeof window !== "undefined" && (window as any).Telegram?.WebApp?.initData) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex flex-col items-center justify-center gap-3">
        <span className="w-7 h-7 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Signing you in…</p>
        {error && <p className="text-red-400 text-xs px-8 text-center">{error}</p>}
      </div>
    );
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.post("/auth/admin/login", {
        email: email.trim(),
        password,
      });
      const { accessToken, refreshToken, user } = data;

      if (!["ADMIN", "SUPER_ADMIN"].includes(user?.role)) {
        setError("Access denied. Admin accounts only.");
        setLoading(false);
        return;
      }

      setSession(accessToken, refreshToken, user);
      router.replace("/");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-512.png" alt="ExpoUz" width={72} height={72} className="rounded-2xl mb-3" style={{ width: 72, height: 72 }} />
          <div className="text-3xl font-extrabold tracking-tight mb-1">
            <span className="text-[#00C853]">Expo</span>
            <span className="text-white">Uz</span>
          </div>
          <p className="text-gray-500 text-sm">Admin Panel</p>
        </div>

        <div className="bg-[#161B22] rounded-2xl border border-white/10 p-8">
          <h1 className="text-white font-semibold text-lg mb-1">Sign in</h1>
          <p className="text-gray-500 text-sm mb-6">
            Enter your admin email and password
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              autoComplete="username"
              placeholder="admin@expouz.uz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0D1117] border border-white/10 rounded-xl text-white text-sm px-4 py-3 outline-none focus:ring-2 focus:ring-[#00C853]/40 placeholder:text-gray-600"
              autoFocus
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0D1117] border border-white/10 rounded-xl text-white text-sm px-4 py-3 outline-none focus:ring-2 focus:ring-[#00C853]/40 placeholder:text-gray-600"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email || password.length < 1}
              className="w-full py-3 rounded-xl bg-[#00C853] text-black font-semibold text-sm disabled:opacity-50 transition-opacity"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          Restricted to ADMIN and SUPER_ADMIN accounts only
        </p>
      </div>
    </div>
  );
}
