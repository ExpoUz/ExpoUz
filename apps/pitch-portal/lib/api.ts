import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

export const authApi = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export const portalApi = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach token on every request
portalApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("portal_access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
portalApi.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem("portal_refresh_token");
        const { data } = await authApi.post("/auth/refresh", { refreshToken: refresh });
        localStorage.setItem("portal_access_token", data.accessToken);
        if (data.refreshToken) localStorage.setItem("portal_refresh_token", data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return portalApi(original);
      } catch {
        if (typeof window !== "undefined") {
          localStorage.clear();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(err);
  }
);

// ─── Dashboard ───────────────────────────────────────────────
export interface DashboardStats {
  totalPitches: number;
  matchesThisMonth: number;
  totalRevenue: number;
  uniquePlayers: number;
}

export async function getDashboard(): Promise<DashboardStats> {
  const { data } = await portalApi.get("/pitch-admin/dashboard");
  return data;
}

// ─── Pitches ─────────────────────────────────────────────────
export async function getPitches(): Promise<any[]> {
  const { data } = await portalApi.get("/pitch-admin/pitches");
  return Array.isArray(data) ? data : data?.data ?? [];
}

export async function getPitchDetail(id: string) {
  const { data } = await portalApi.get(`/pitch-admin/pitches/${id}`);
  return data;
}

export async function setPitchAvailability(id: string, isActive: boolean) {
  const { data } = await portalApi.patch(`/pitch-admin/pitches/${id}/availability`, { isActive });
  return data;
}

// ─── Matches ─────────────────────────────────────────────────
export async function getMatches(params?: { page?: number; limit?: number }): Promise<{
  data: any[];
  total: number;
  page: number;
  limit: number;
}> {
  const { data } = await portalApi.get("/pitch-admin/matches", { params: { limit: 50, ...params } });
  return data;
}

export async function cancelMatch(id: string) {
  const { data } = await portalApi.delete(`/pitch-admin/matches/${id}`);
  return data;
}

// ─── Schedule ─────────────────────────────────────────────────
export async function getSchedule(from: string, to: string): Promise<any[]> {
  const { data } = await portalApi.get("/pitch-admin/schedule", { params: { from, to } });
  return Array.isArray(data) ? data : data?.data ?? [];
}

// ─── Players ─────────────────────────────────────────────────
export async function getPlayers(params?: { search?: string; pitchId?: string; page?: number; limit?: number }): Promise<{
  data: any[];
  total: number;
  page: number;
  limit: number;
}> {
  const { data } = await portalApi.get("/pitch-admin/users", { params: { limit: 50, ...params } });
  // The /users endpoint returns paginated; /players returns a flat list. Prefer paginated.
  if (Array.isArray(data)) return { data, total: data.length, page: 1, limit: data.length };
  return data;
}

// ─── Revenue ─────────────────────────────────────────────────
export interface RevenueBreakdown {
  grossRevenue: number;
  commissionDeducted: number;
  netRevenue: number;
}

export async function getRevenue(): Promise<RevenueBreakdown> {
  const { data } = await portalApi.get("/pitch-admin/revenue");
  return data;
}

// ─── Helpers ─────────────────────────────────────────────────
export function formatUZS(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString("en-US")} UZS`;
}
