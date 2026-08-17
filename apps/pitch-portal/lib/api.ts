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

// ─── Org context (org identity + role for the panel shell) ───
export type OrgRole = "OWNER" | "MANAGER" | "STAFF";

export interface PortalContext {
  org: { id: string; name: string; logoUrl: string | null } | null;
  role: OrgRole;
  legacy: boolean;
}

export async function getPortalContext(): Promise<PortalContext> {
  const { data } = await portalApi.get("/pitch-admin/context");
  return data;
}

// ─── Invite acceptance (join an organization) ────────────────
export async function previewInvite(token: string): Promise<
  | { valid: false; reason: string }
  | { valid: true; orgName: string; orgLogoUrl: string | null; role: OrgRole }
> {
  const { data } = await portalApi.get(`/org/invites/${token}`);
  return data;
}

export async function acceptInvite(token: string): Promise<{ orgId: string; role: OrgRole }> {
  const { data } = await portalApi.post(`/org/invites/${token}/accept`);
  return data;
}

// ─── Staff management (OWNER only) ───────────────────────────
export async function getStaff(): Promise<{ members: any[]; invites: any[] }> {
  const { data } = await portalApi.get("/pitch-admin/staff");
  return data;
}

export async function inviteStaff(dto: { phone?: string; telegramId?: string; role?: OrgRole }) {
  const { data } = await portalApi.post("/pitch-admin/staff/invites", dto);
  return data;
}

export async function revokeStaffInvite(inviteId: string) {
  const { data } = await portalApi.delete(`/pitch-admin/staff/invites/${inviteId}`);
  return data;
}

export async function changeStaffRole(memberId: string, role: OrgRole) {
  const { data } = await portalApi.patch(`/pitch-admin/staff/${memberId}`, { role });
  return data;
}

export async function removeStaff(memberId: string) {
  const { data } = await portalApi.delete(`/pitch-admin/staff/${memberId}`);
  return data;
}

// ─── Dashboard ───────────────────────────────────────────────
export interface DashboardStats {
  totalPitches: number;
  matchesThisMonth: number;
  totalRevenue: number | null; // null for STAFF (revenue hidden)
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

export interface DayHours { open: string; close: string }
export type OpeningHours = Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", DayHours>>;

export async function setOpeningHours(
  id: string,
  body: { openingHours?: OpeningHours | null; slotDuration?: number; courtCount?: number },
) {
  const { data } = await portalApi.patch(`/pitch-admin/pitches/${id}/opening-hours`, body);
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

// ─── CRM: Players ────────────────────────────────────────────
export type Segment = "ALL" | "NEW" | "REGULAR" | "LOYAL" | "AT_RISK" | "LAPSED" | "RISKY";

export interface CrmPlayer {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  padelLevel: number | null;
  eloRating: number;
  skillLevel: string;
  gamesHere: number;
  firstVisit: string | null;
  lastVisit: string | null;
  noShowsHere: number;
  spentHere: number;
  favouriteSlot: string | null;
  segment: Segment;
}

export async function getCrmPlayers(params?: {
  search?: string;
  segment?: string;
  sort?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: CrmPlayer[]; total: number; page: number; limit: number }> {
  const { data } = await portalApi.get("/pitch-admin/players", { params: { limit: 50, ...params } });
  return data;
}

export async function getCrmSegments(): Promise<Record<string, number>> {
  const { data } = await portalApi.get("/pitch-admin/players/segments");
  return data;
}

export async function getCrmPlayer(id: string): Promise<
  CrmPlayer & { contactAvailable: boolean; notes: any[] }
> {
  const { data } = await portalApi.get(`/pitch-admin/players/${id}`);
  return data;
}

export async function getCrmPlayerHistory(id: string): Promise<any[]> {
  const { data } = await portalApi.get(`/pitch-admin/players/${id}/history`);
  return data;
}

export async function addCrmNote(id: string, note: string) {
  const { data } = await portalApi.post(`/pitch-admin/players/${id}/notes`, { note });
  return data;
}

export async function revealCrmContact(id: string, reason: string): Promise<{ phone: string | null; firstName?: string }> {
  const { data } = await portalApi.post(`/pitch-admin/players/${id}/reveal`, { reason });
  return data;
}

export async function messageCrmPlayer(id: string, content: string) {
  const { data } = await portalApi.post(`/pitch-admin/players/${id}/message`, { content });
  return data;
}

// ─── CRM: Insights ───────────────────────────────────────────
export async function getCrmInsights(): Promise<any> {
  const { data } = await portalApi.get("/pitch-admin/insights");
  return data;
}

// ─── CRM: Broadcast ──────────────────────────────────────────
export async function getBroadcastAudience(): Promise<{
  counts: Record<string, number>;
  sentThisWeek: number;
  weeklyLimit: number;
}> {
  const { data } = await portalApi.get("/pitch-admin/broadcast/audience");
  return data;
}

export async function sendBroadcast(segment: string, message: string): Promise<{ sent: number; segment: string }> {
  const { data } = await portalApi.post("/pitch-admin/broadcast", { segment, message });
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
// Currency formatting is shared across both admin panels — single source of truth.
export { formatUZS } from "@expouz/ui";
