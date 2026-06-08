import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

export const authApi = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export const adminApi = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach token on every request
adminApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("admin_access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
adminApi.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem("admin_refresh_token");
        const { data } = await authApi.post("/auth/refresh", { refreshToken: refresh });
        localStorage.setItem("admin_access_token", data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return adminApi(original);
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
export async function getDashboard() {
  const { data } = await adminApi.get("/admin/dashboard");
  return data;
}

// ─── Users ───────────────────────────────────────────────────
export async function getUsers(params?: { page?: number; limit?: number; search?: string; role?: string }): Promise<any[]> {
  const { data } = await adminApi.get("/admin/users", { params: { limit: 200, ...params } });
  return data?.data ?? data ?? [];
}

export async function getUserById(id: string) {
  const { data } = await adminApi.get(`/admin/users/${id}`);
  return data;
}

// ─── Activity ────────────────────────────────────────────────
export async function getActivityLog(params?: {
  userId?: string;
  category?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: any[]; total: number; page: number; limit: number }> {
  const { data } = await adminApi.get("/admin/activity-log", {
    params: { limit: 50, ...params },
  });
  return data?.data ? data : { data: data ?? [], total: 0, page: 1, limit: 50 };
}

export async function changeUserRole(id: string, role: string) {
  const { data } = await adminApi.patch(`/admin/users/${id}/role`, { role });
  return data;
}

export async function banUser(id: string, reason: string) {
  const { data } = await adminApi.patch(`/admin/users/${id}/ban`, { reason });
  return data;
}

export async function deleteUser(id: string) {
  const { data } = await adminApi.delete(`/admin/users/${id}`);
  return data;
}

// ─── Pitches ─────────────────────────────────────────────────
export async function getPendingPitches(): Promise<any[]> {
  const { data } = await adminApi.get("/admin/pitches/pending");
  return Array.isArray(data) ? data : data?.data ?? [];
}

export async function verifyPitch(id: string, approved: boolean) {
  const { data } = await adminApi.patch(`/admin/pitches/${id}/verify`, { approved });
  return data;
}

export async function getAllPitches(): Promise<any[]> {
  const { data } = await adminApi.get("/admin/pitches");
  return data?.data ?? data ?? [];
}

export async function createPitch(dto: any) {
  const { data } = await adminApi.post("/admin/pitches", dto);
  return data;
}

export async function updatePitch(id: string, dto: any) {
  const { data } = await adminApi.patch(`/admin/pitches/${id}`, dto);
  return data;
}

// ─── Pitch Admins ─────────────────────────────────────────────
export async function getPitchAdmins(): Promise<any[]> {
  const { data } = await adminApi.get("/admin/pitch-admins");
  return data?.data ?? data ?? [];
}

export async function createPitchAdmin(dto: { phone: string; firstName: string; lastName?: string }) {
  const { data } = await adminApi.post("/admin/pitch-admins", dto);
  return data;
}

export async function updatePitchAdmin(id: string, dto: any) {
  const { data } = await adminApi.patch(`/admin/pitch-admins/${id}`, dto);
  return data;
}

export async function deletePitchAdmin(id: string) {
  const { data } = await adminApi.delete(`/admin/pitch-admins/${id}`);
  return data;
}

// ─── Locations ────────────────────────────────────────────────
export async function getLocations(): Promise<any[]> {
  const { data } = await adminApi.get("/admin/locations");
  return data?.data ?? data ?? [];
}

export async function createLocation(dto: { name: string; city: string; district?: string }) {
  const { data } = await adminApi.post("/admin/locations", dto);
  return data;
}

export async function updateLocation(id: string, dto: any) {
  const { data } = await adminApi.patch(`/admin/locations/${id}`, dto);
  return data;
}

export async function deleteLocation(id: string) {
  const { data } = await adminApi.delete(`/admin/locations/${id}`);
  return data;
}

// ─── Matches ─────────────────────────────────────────────────
export async function getMatches(params?: { page?: number; limit?: number }): Promise<any[]> {
  const { data } = await adminApi.get("/admin/matches", { params: { limit: 100, ...params } });
  return data?.data ?? data ?? [];
}

export async function cancelMatch(id: string) {
  const { data } = await adminApi.delete(`/admin/matches/${id}`);
  return data;
}

// ─── Transactions ─────────────────────────────────────────────
export async function getTransactions(params?: { page?: number; limit?: number }): Promise<any[]> {
  const { data } = await adminApi.get("/admin/transactions", { params: { limit: 100, ...params } });
  return data?.data ?? data ?? [];
}

export async function manualRelease(transactionId: string) {
  const { data } = await adminApi.post(`/admin/transactions/${transactionId}/release`);
  return data;
}

// ─── Revenue Analytics ────────────────────────────────────────
export async function getRevenue(period: "week" | "month" | "year" = "month"): Promise<any[]> {
  const { data } = await adminApi.get("/admin/analytics/revenue", { params: { period } });
  return Array.isArray(data) ? data : [];
}

// ─── Settings ─────────────────────────────────────────────────
export async function getSettings() {
  const { data } = await adminApi.get("/admin/settings");
  return data;
}

export async function updateCommission(rate: number) {
  const { data } = await adminApi.patch("/admin/settings/commission", { rate });
  return data;
}
