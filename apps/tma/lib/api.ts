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

// ─── Booking types / invites / pricing ────────────────────────
export async function getPricingPreview(body: {
  pitchId: string;
  bookingType: string;
  organizerPlayerCount?: number;
  extraSpotsAvailable?: number;
  fullBookingHours?: number;
  pricePerPlayer?: number;
}) {
  const { data } = await api.post("/matches/pricing/calculate", body);
  return data;
}

export async function getMatchByShareCode(shareCode: string) {
  const { data } = await api.get(`/matches/code/${shareCode}`);
  return data;
}

export async function joinByShareCode(
  shareCode: string,
  body: { positionId?: string; teamSide?: string } = {},
) {
  const { data } = await api.post(`/matches/join/code/${shareCode}`, body);
  return data;
}

export async function getShareLink(id: string): Promise<{
  id: string;
  shareCode: string;
  telegramShareLink: string;
  title?: string;
}> {
  const { data } = await api.get(`/matches/${id}/share`);
  return data;
}

export async function cancelBooking(bookingId: string): Promise<{
  cancelled: boolean;
  status: string;
  hoursUntilMatch: number;
  withinCancellationWindow: boolean;
  refundAmount: number;
  penaltyAmount: number;
  refundedToWallet: boolean;
  message: string;
}> {
  const { data } = await api.delete(`/bookings/${bookingId}`);
  return data;
}

export async function getCities(): Promise<{ city: string; districts: string[] }[]> {
  const { data } = await api.get("/matches/cities");
  return Array.isArray(data) ? data : [];
}

// ─── Pitches (for create flow) ────────────────────────────────
export async function getPitches(params?: Record<string, any>): Promise<any[]> {
  const { data } = await api.get("/pitches", { params: { limit: 50, ...params } });
  return Array.isArray(data) ? data : data?.data ?? [];
}

// ─── Players / ranking / social ───────────────────────────────
export async function searchPlayers(q: string, city?: string): Promise<any[]> {
  const { data } = await api.get("/users/search", { params: { q, ...(city ? { city } : {}) } });
  return Array.isArray(data) ? data : [];
}

export async function getPlayerProfile(id: string) {
  const { data } = await api.get(`/users/${id}`);
  return data;
}

export async function getPlayerRanking(id: string) {
  const { data } = await api.get(`/users/${id}/ranking`);
  return data;
}

export async function getLeaderboard(city?: string): Promise<any[]> {
  const { data } = await api.get("/users/leaderboard", { params: city ? { city } : {} });
  return Array.isArray(data) ? data : [];
}

export async function getMatchPlayers(matchId: string): Promise<any[]> {
  const { data } = await api.get(`/users/match/${matchId}/players`);
  return Array.isArray(data) ? data : [];
}

// Shared level metadata (mirrors API RankingService)
export const LEVEL_META: Record<string, { label: string; color: string; icon: string }> = {
  NEW: { label: "New Player", color: "#9CA3AF", icon: "🌱" },
  ROOKIE: { label: "Rookie", color: "#10B981", icon: "🎾" },
  REGULAR: { label: "Regular", color: "#00B0FF", icon: "🔵" },
  EXPERIENCED: { label: "Experienced", color: "#8B5CF6", icon: "🔥" },
  VETERAN: { label: "Veteran", color: "#F59E0B", icon: "⭐" },
  ELITE: { label: "Elite", color: "#FFD700", icon: "👑" },
};

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
