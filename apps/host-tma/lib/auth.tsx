'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface HostUser { id: string; firstName: string; lastName?: string; phone: string; avatarUrl?: string; role: string; }

interface AuthCtx {
  user: HostUser | null;
  token: string | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({ user: null, token: null, loading: true, logout: () => {} });

export function HostAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<HostUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('host_tma_token');
    if (stored) {
      setToken(stored);
      fetchMe(stored);
    } else {
      // Try Telegram WebApp initData auth
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.initData) {
        authWithTelegram(tg.initData, tg.initDataUnsafe?.user?.id?.toString());
      } else {
        setLoading(false);
      }
    }
  }, []);

  async function fetchMe(t: string) {
    try {
      const { data } = await axios.get(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${t}` } });
      if (data.role === 'PITCH_OWNER' || data.role === 'ADMIN' || data.role === 'SUPER_ADMIN') {
        setUser(data);
      } else {
        localStorage.removeItem('host_tma_token');
      }
    } catch { localStorage.removeItem('host_tma_token'); }
    setLoading(false);
  }

  async function authWithTelegram(initData: string, telegramId?: string) {
    try {
      const { data } = await axios.post(`${API_URL}/auth/telegram`, { initData, botType: 'host' });
      localStorage.setItem('host_tma_token', data.accessToken);
      setToken(data.accessToken);
      setUser(data.user);
    } catch { /* not registered yet */ }
    setLoading(false);
  }

  function logout() {
    localStorage.removeItem('host_tma_token');
    setToken(null); setUser(null);
  }

  return <AuthContext.Provider value={{ user, token, loading, logout }}>{children}</AuthContext.Provider>;
}

export function useHostAuth() { return useContext(AuthContext); }
