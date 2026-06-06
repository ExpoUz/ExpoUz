import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("tma_access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem("tma_refresh_token");
        if (refresh) {
          const { data } = await api.post("/auth/refresh", { refreshToken: refresh });
          localStorage.setItem("tma_access_token", data.accessToken);
          if (data.refreshToken) localStorage.setItem("tma_refresh_token", data.refreshToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        }
      } catch {
        /* fall through */
      }
    }
    return Promise.reject(err);
  }
);

// ─── Matches ──────────────────────────────────────────────────
export async function getMatches(params?: Record<string, any>): Promise<{
  data: any[];
  total: number;
  page: number;
  limit: number;
}> {
  const { data } = await api.get("/matches", { params: { limit: 30, ...params } });
  if (Array.isArray(data)) return { data, total: data.length, page: 1, limit: data.length };
  return data;
}

export async function getMatch(id: string) {
  const { data } = await api.get(`/matches/${id}`);
  return data;
}

export async function getFormation(id: string): Promise<{ home: any[]; away: any[] }> {
  const { data } = await api.get(`/matches/${id}/formation`);
  return data;
}

export async function joinMatch(id: string, body: { positionId?: string; teamSide?: string }) {
  const { data } = await api.post(`/matches/${id}/join`, body);
  return data;
}

export async function leaveMatch(id: string) {
  const { data } = await api.post(`/matches/${id}/leave`);
  return data;
}

export async function createMatch(body: any) {
  const { data } = await api.post("/matches", body);
  return data;
}

// ─── Pitches (for create flow) ────────────────────────────────
export async function getPitches(params?: Record<string, any>): Promise<any[]> {
  const { data } = await api.get("/pitches", { params: { limit: 50, ...params } });
  return Array.isArray(data) ? data : data?.data ?? [];
}

// ─── Profile ──────────────────────────────────────────────────
export async function getMe() {
  const { data } = await api.get("/users/me");
  return data;
}

export async function getMyStats() {
  const { data } = await api.get("/users/me/stats");
  return data;
}

export async function getMyBookings(): Promise<any[]> {
  const { data } = await api.get("/users/me/bookings");
  return Array.isArray(data) ? data : data?.data ?? [];
}

// ─── Helpers ──────────────────────────────────────────────────
export function formatUZS(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString("en-US")} UZS`;
}
