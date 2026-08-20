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

/** Manually mark a user's phone as verified (method = ADMIN, written to audit log). */
export async function verifyUserPhone(id: string, phone: string) {
  const { data } = await adminApi.post(`/admin/users/${id}/verify-phone`, { phone });
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

export async function getAllPitches(params?: { sport?: string }): Promise<any[]> {
  const { data } = await adminApi.get("/admin/pitches", { params: { limit: 200, ...params } });
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
export async function getMatches(params?: { page?: number; limit?: number; sport?: string }): Promise<any[]> {
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

// ─── Padel Analytics ──────────────────────────────────────────
export async function getPadelAnalytics(): Promise<{
  totalAssessed: number;
  distribution: { band: string; count: number }[];
  matchTypeSplit: { casual: number; competitive: number };
}> {
  const { data } = await adminApi.get("/admin/analytics/padel");
  return data;
}

export async function getFootballAnalytics(): Promise<{
  totalMatches: number;
  formats: { format: string; matches: number; fillRate: number }[];
}> {
  const { data } = await adminApi.get("/admin/analytics/football");
  return data;
}

// ─── Disputed result moderation ───────────────────────────────
export async function getDisputes(): Promise<any[]> {
  const { data } = await adminApi.get("/admin/disputes");
  return Array.isArray(data) ? data : data?.data ?? [];
}

export async function resolveDispute(matchId: string, confirm: boolean) {
  const { data } = await adminApi.post(`/admin/disputes/${matchId}/resolve`, { confirm });
  return data;
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

// ─── Venue Owner CRM Oversight ───────────────────────────────
export async function getCrmUsage(): Promise<any[]> {
  const { data } = await adminApi.get("/admin/crm/usage");
  return data;
}

export async function getContactRevealLog(): Promise<any[]> {
  const { data } = await adminApi.get("/admin/crm/reveals");
  return data;
}

export async function getBroadcastLog(): Promise<any[]> {
  const { data } = await adminApi.get("/admin/crm/broadcasts");
  return data;
}

export async function getVenueReports(includeResolved = false): Promise<any[]> {
  const { data } = await adminApi.get("/admin/crm/reports", { params: { includeResolved } });
  return data;
}

export async function resolveVenueReport(id: string) {
  const { data } = await adminApi.post(`/admin/crm/reports/${id}/resolve`);
  return data;
}

export async function setOwnerCrmFlags(
  ownerId: string,
  flags: { crmDisabled?: boolean; broadcastDisabled?: boolean },
) {
  const { data } = await adminApi.patch(`/admin/crm/owners/${ownerId}/flags`, flags);
  return data;
}

// ─── Public community groups ─────────────────────────────────
export async function getPublicGroups(): Promise<any[]> {
  const { data } = await adminApi.get("/messages/groups");
  return Array.isArray(data) ? data : [];
}

export async function createPublicGroup(body: { title: string; city?: string; sport?: string }) {
  const { data } = await adminApi.post("/messages/groups", body);
  return data;
}

// ─── Organizations (multi-tenant partners) ───────────────────
export async function getOrganizations(params?: { search?: string; status?: string }): Promise<any[]> {
  const { data } = await adminApi.get("/admin/organizations", { params });
  return Array.isArray(data) ? data : data?.data ?? [];
}

export async function createOrganization(dto: any) {
  const { data } = await adminApi.post("/admin/organizations", dto);
  return data;
}

export async function getOrganization(id: string) {
  const { data } = await adminApi.get(`/admin/organizations/${id}`);
  return data;
}

export async function updateOrganization(id: string, dto: any) {
  const { data } = await adminApi.patch(`/admin/organizations/${id}`, dto);
  return data;
}

export async function setOrganizationStatus(id: string, status: string) {
  const { data } = await adminApi.patch(`/admin/organizations/${id}/status`, { status });
  return data;
}

export async function getOrganizationVenues(id: string): Promise<{ venues: any[]; unassigned: any[] }> {
  const { data } = await adminApi.get(`/admin/organizations/${id}/venues`);
  return data;
}

export async function assignOrganizationVenue(id: string, pitchId: string, confirmMove = false) {
  const { data } = await adminApi.post(`/admin/organizations/${id}/venues`, { pitchId, confirmMove });
  return data;
}

export async function removeOrganizationVenue(id: string, pitchId: string) {
  const { data } = await adminApi.delete(`/admin/organizations/${id}/venues/${pitchId}`);
  return data;
}

export async function getOrganizationStaff(id: string): Promise<{ members: any[]; invites: any[] }> {
  const { data } = await adminApi.get(`/admin/organizations/${id}/staff`);
  return data;
}

export async function inviteOrganizationStaff(id: string, dto: { phone?: string; telegramId?: string; role?: string }) {
  const { data } = await adminApi.post(`/admin/organizations/${id}/invites`, dto);
  return data;
}

export async function revokeOrganizationInvite(id: string, inviteId: string) {
  const { data } = await adminApi.delete(`/admin/organizations/${id}/invites/${inviteId}`);
  return data;
}

export async function attachOrganizationUser(id: string, userId: string, role: string) {
  const { data } = await adminApi.post(`/admin/organizations/${id}/staff`, { userId, role });
  return data;
}

export async function changeOrganizationMemberRole(id: string, memberId: string, role: string) {
  const { data } = await adminApi.patch(`/admin/organizations/${id}/staff/${memberId}`, { role });
  return data;
}

export async function removeOrganizationMember(id: string, memberId: string) {
  const { data } = await adminApi.delete(`/admin/organizations/${id}/staff/${memberId}`);
  return data;
}

export async function getOrganizationPlayers(id: string): Promise<any[]> {
  const { data } = await adminApi.get(`/admin/organizations/${id}/players`);
  return Array.isArray(data) ? data : [];
}

export async function getOrganizationRevenue(id: string) {
  const { data } = await adminApi.get(`/admin/organizations/${id}/revenue`);
  return data;
}

// ─── Partner CRM (PART 3) ───────────────────
export async function getOrganizationCrm(id: string) {
  const { data } = await adminApi.get(`/admin/organizations/${id}/crm`);
  return data;
}

export async function addOrganizationContact(
  id: string,
  dto: { type?: string; summary: string; followUpDate?: string | null },
) {
  const { data } = await adminApi.post(`/admin/organizations/${id}/contacts`, dto);
  return data;
}

export async function setOrganizationPipeline(id: string, stage: string) {
  const { data } = await adminApi.patch(`/admin/organizations/${id}/pipeline`, { stage });
  return data;
}

export async function setOrganizationFollowUp(id: string, dto: { date: string | null; userId?: string | null }) {
  const { data } = await adminApi.patch(`/admin/organizations/${id}/followup`, dto);
  return data;
}

export async function getOrganizationsInsights() {
  const { data } = await adminApi.get(`/admin/organizations/insights`);
  return data;
}
