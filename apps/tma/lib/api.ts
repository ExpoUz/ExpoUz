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
    // Never try to refresh the refresh call itself — and use a bare axios
    // instance for it. Refreshing through `api` re-enters this interceptor on
    // failure and recurses forever (infinite "Signing you in…" spinner).
    const isRefreshCall = original?.url?.includes("/auth/refresh");
    if (err.response?.status === 401 && !original._retry && !isRefreshCall) {
      original._retry = true;
      const refresh = localStorage.getItem("tma_refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
            refreshToken: refresh,
          });
          localStorage.setItem("tma_access_token", data.accessToken);
          if (data.refreshToken) localStorage.setItem("tma_refresh_token", data.refreshToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          // Session is dead — clear it so the auth provider can re-login
          // via Telegram initData instead of looping.
          localStorage.removeItem("tma_access_token");
          localStorage.removeItem("tma_refresh_token");
        }
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

/** Host-only partial update (start time, duration, price, description). */
export async function updateMatch(
  id: string,
  patch: { startTime?: string; durationMinutes?: number; pricePerPlayer?: number; description?: string },
) {
  const { data } = await api.patch(`/matches/${id}`, patch);
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

// ── Wallet checkout ─────────────────────────────────────────────────────────
export async function initiatePayment(body: {
  bookingId?: string;
  pitchBookingId?: string;
  gateway?: string;
}) {
  const { data } = await api.post("/payments/initiate", { gateway: "WALLET", ...body });
  return data as { transactionId: string; amount: number };
}

export async function payWithWallet(transactionId: string) {
  const { data } = await api.post("/payments/wallet/pay", { transactionId });
  return data;
}

export function isInsufficientBalanceError(e: any): boolean {
  return (
    e?.response?.data?.code === "INSUFFICIENT_BALANCE" ||
    /insufficient wallet balance/i.test(e?.response?.data?.message ?? "")
  );
}

/** Amounts (needed / current balance) attached to an INSUFFICIENT_BALANCE error. */
export function insufficientBalanceInfo(
  e: any,
): { needed: number; balance: number } | null {
  const d = e?.response?.data;
  if (d?.code !== "INSUFFICIENT_BALANCE") return null;
  return { needed: Number(d.needed ?? 0), balance: Number(d.balance ?? 0) };
}

/**
 * Wallet checkout for a fresh match booking: create the transaction, then pay
 * it from the wallet. Throws (with the API's message) on insufficient balance.
 */
export async function payForBookingWithWallet(bookingId: string) {
  const { transactionId } = await initiatePayment({ bookingId });
  return payWithWallet(transactionId);
}

/**
 * Join a match. Joining is now atomic on the server — the wallet is debited and
 * the slot is taken in one transaction, or neither happens (e.g. on
 * INSUFFICIENT_BALANCE the error is thrown and no slot is held). The
 * `pricePerPlayer` arg is retained for call-site compatibility but unused.
 */
export async function joinMatchAndPay(
  id: string,
  body: { positionId?: string; teamSide?: string },
  _pricePerPlayer?: number | string,
) {
  return joinMatch(id, body);
}

export async function leaveMatch(id: string) {
  const { data } = await api.post(`/matches/${id}/leave`);
  return data;
}

export async function createMatch(body: any) {
  const { data } = await api.post("/matches", body);
  return data;
}

// ─── Slots (PART 6) ───────────────────────────────────────────
// Available, future slots to book into, grouped by venue. Price is set by the
// venue admin — users never set it.
export async function getAvailableSlots(params: {
  pitchId?: string;
  sport?: string;
  city?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<{ pitch: any; slots: any[] }[]> {
  const { data } = await api.get("/slots/available", { params });
  return data ?? [];
}

// ─── Match results & scoring ──────────────────────────────────
export async function getMatchResult(id: string) {
  const { data } = await api.get(`/matches/${id}/result`);
  return data;
}

export async function submitMatchResult(
  id: string,
  body: {
    team1Set1: number; team2Set1: number;
    team1Set2: number; team2Set2: number;
    team1Set3?: number; team2Set3?: number;
  },
) {
  const { data } = await api.post(`/matches/${id}/result`, body);
  return data;
}

export async function confirmMatchResult(id: string) {
  const { data } = await api.post(`/matches/${id}/result/confirm`);
  return data;
}

export async function disputeMatchResult(id: string) {
  const { data } = await api.post(`/matches/${id}/result/dispute`);
  return data;
}

// ─── Skill rating: onboarding, statistics, history ────────────
export async function submitOnboarding(answers: {
  experience: "never" | "few_times" | "months" | "years";
  otherRacketSports: boolean;
  selfAssessment: number;
  competitivePlay: boolean;
}) {
  const { data } = await api.post("/level/onboarding", answers);
  return data;
}

export async function getStatistics(id: string) {
  const { data } = await api.get(`/users/${id}/statistics`);
  return data;
}

export async function getLevelHistory(id: string): Promise<any[]> {
  const { data } = await api.get(`/level/${id}/history`);
  return Array.isArray(data) ? data : [];
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

export interface NearbyPitch {
  id: string;
  name: string;
  photo: string | null;
  city: string;
  district: string;
  sport: string;
  lat: number;
  lng: number;
  distance: number | null;
  gamesToday: number;
}

/** Home-feed "Pitches near you". Passes lat/lng only when the user granted it. */
export async function getNearbyPitches(params: {
  lat?: number;
  lng?: number;
  sport?: string;
  city?: string;
  district?: string;
  limit?: number;
}): Promise<NearbyPitch[]> {
  const { data } = await api.get("/pitches/nearby/home", { params });
  return Array.isArray(data) ? data : [];
}

export async function getPitch(id: string) {
  const { data } = await api.get(`/pitches/${id}`);
  return data;
}

// ─── Time-slot availability ──────────────────────────────────
export interface SlotChip { slot: string; games: number; free: boolean }
export interface SlotCounts { chips: SlotChip[]; freeCourtsAvailable: boolean }
export interface FreeCourt {
  pitch: { id: string; name: string; district: string; city: string; photo: string | null; lat: number; lng: number; hourlyRate: number };
  slots: string[];
}

export async function getSlotCounts(params: { sport: string; date: string; city?: string; district?: string }): Promise<SlotCounts> {
  const { data } = await api.get("/availability/counts", { params });
  return data;
}

export async function getFreeCourts(params: { sport: string; date: string; from?: string; to?: string; city?: string; district?: string; duration?: number }): Promise<FreeCourt[]> {
  const { data } = await api.get("/availability/slots", { params });
  return Array.isArray(data) ? data : [];
}

export async function getJoinableGames(params: { sport: string; date: string; from?: string; to?: string; city?: string; district?: string }): Promise<any[]> {
  const { data } = await api.get("/availability/games", { params });
  return Array.isArray(data) ? data : [];
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

// Skill-rating band metadata (mirrors API LevelService.getLevelBand)
export interface SkillBand {
  label: string;
  color: string;
  range: string;
}

// `key` is stable across locales; translate via t(`levels.bands.${key}`). `label`
// is the English fallback used if a translation is missing.
export function getSkillBand(level: number): SkillBand & { key: string } {
  if (level < 1.0) return { key: "initiation", label: "Initiation", color: "#9CA3AF", range: "0.0–1.0" };
  if (level < 1.5) return { key: "beginner", label: "Beginner", color: "#34D399", range: "1.0–1.5" };
  if (level < 2.5) return { key: "improver", label: "Improver", color: "#10B981", range: "1.5–2.5" };
  if (level < 3.5) return { key: "intermediate", label: "Intermediate", color: "#00B0FF", range: "2.5–3.5" };
  if (level < 4.5) return { key: "advancedIntermediate", label: "Advanced Intermediate", color: "#8B5CF6", range: "3.5–4.5" };
  if (level < 5.5) return { key: "advanced", label: "Advanced", color: "#F59E0B", range: "4.5–5.5" };
  if (level < 6.0) return { key: "competitive", label: "Competitive", color: "#EF4444", range: "5.5–6.0" };
  return { key: "pro", label: "Pro", color: "#FFD700", range: "6.0–7.0" };
}

export function formatLevel(level: number | null | undefined): string {
  return Number(level ?? 0).toFixed(2);
}

// Shared level metadata (mirrors API RankingService)
export const LEVEL_META: Record<string, { label: string; color: string }> = {
  NEW: { label: "New Player", color: "#9CA3AF" },
  ROOKIE: { label: "Rookie", color: "#10B981" },
  REGULAR: { label: "Regular", color: "#00B0FF" },
  EXPERIENCED: { label: "Experienced", color: "#8B5CF6" },
  VETERAN: { label: "Veteran", color: "#F59E0B" },
  ELITE: { label: "Elite", color: "#FFD700" },
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

// ─── Phone verification ───────────────────────────────────────
export interface PhoneStatus {
  phoneVerified: boolean;
  method: "TELEGRAM_CONTACT" | "TELEGRAM_GATEWAY" | "SMS" | "ADMIN" | null;
  verifiedAt: string | null;
  maskedPhone: string | null;
}

export async function getPhoneStatus(): Promise<PhoneStatus> {
  const { data } = await api.get("/users/me/phone/status");
  return data;
}

/** Tier 1: save a one-tap Telegram contact share (raw signed payload). */
export async function savePhoneContact(raw: string): Promise<{
  verified: boolean;
  method: string;
  maskedPhone: string;
}> {
  const { data } = await api.post("/users/me/phone/telegram-contact", { raw });
  return data;
}

/** Tier 2: request an OTP for a typed number. */
export async function requestPhoneCode(phone: string): Promise<{
  method: string;
  expiresIn: number;
}> {
  const { data } = await api.post("/users/me/phone/request-code", { phone });
  return data;
}

/** Tier 2: verify the OTP the user received. */
export async function verifyPhoneCode(code: string): Promise<{
  verified: boolean;
  method: string;
  maskedPhone: string;
}> {
  const { data } = await api.post("/users/me/phone/verify-code", { code });
  return data;
}

/** Extract the API error CODE (client translates it) from an axios error. */
export function apiErrorCode(e: any): string | null {
  return e?.response?.data?.code ?? null;
}

/** True when a gated action was blocked because the phone isn't verified. */
export function isPhoneRequiredError(e: any): boolean {
  return apiErrorCode(e) === "PHONE_REQUIRED";
}

// ─── Wallet ───────────────────────────────────────────────────
export interface WalletTransaction {
  id: string;
  type:
    | "TOPUP"
    | "MATCH_PAYMENT"
    | "REFUND"
    | "CANCELLATION_FEE"
    | "PAYOUT"
    | "ADMIN_ADJUSTMENT"
    | "REFERRAL_BONUS"
    | "WELCOME_BONUS";
  amount: string;
  balanceAfter: string;
  reference: string | null;
  description: string;
  createdAt: string;
}

export async function getWalletBalance(): Promise<{ balance: number }> {
  const { data } = await api.get("/payments/wallet/balance");
  return data;
}

export async function getWalletHistory(): Promise<WalletTransaction[]> {
  const { data } = await api.get("/payments/wallet/history");
  return Array.isArray(data) ? data : [];
}

export const WALLET_TX_META: Record<WalletTransaction["type"], { label: string }> = {
  TOPUP: { label: "Top-up" },
  MATCH_PAYMENT: { label: "Match payment" },
  REFUND: { label: "Refund" },
  CANCELLATION_FEE: { label: "Cancellation fee" },
  PAYOUT: { label: "Payout" },
  ADMIN_ADJUSTMENT: { label: "Adjustment" },
  REFERRAL_BONUS: { label: "Referral bonus" },
  WELCOME_BONUS: { label: "Welcome bonus" },
};

// ─── Messaging / chat ─────────────────────────────────────────
export interface ChatUser {
  id: string;
  firstName: string;
  lastName?: string | null;
  avatarUrl?: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type?: "USER" | "SYSTEM";
  readBy: string[];
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  sender?: ChatUser;
}

export interface MatchChatSummary {
  conversationId: string | null;
  memberCount: number;
  unreadCount: number;
  isMember: boolean;
  readOnly: boolean;
}

/** State for the "Match chat" row on the event detail (safe for non-members). */
export async function getMatchChatSummary(matchId: string): Promise<MatchChatSummary> {
  const { data } = await api.get(`/messages/match/${matchId}/summary`);
  return data;
}

/** Open the match group chat (403s for non-members). Returns members + readOnly. */
export async function getMatchChat(matchId: string): Promise<any> {
  const { data } = await api.get(`/messages/match/${matchId}`);
  return data;
}

export interface Conversation {
  id: string;
  type: "DIRECT" | "MATCH_GROUP" | "PITCH_HIRE" | "SUPPORT" | "PUBLIC_GROUP";
  matchId?: string | null;
  title?: string | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  otherMember: ChatUser | null;
  createdAt: string;
}

export async function getConversations(): Promise<Conversation[]> {
  const { data } = await api.get("/messages/conversations");
  return Array.isArray(data) ? data : [];
}

export async function getConversationMessages(
  id: string,
  page = 1,
  limit = 50,
): Promise<{ data: ChatMessage[]; total: number; page: number; limit: number }> {
  const { data } = await api.get(`/messages/conversations/${id}`, {
    params: { page, limit },
  });
  return data;
}

export async function sendChatMessage(id: string, content: string): Promise<ChatMessage> {
  const { data } = await api.post(`/messages/conversations/${id}`, { content });
  return data;
}

export async function editChatMessage(messageId: string, content: string): Promise<ChatMessage> {
  const { data } = await api.patch(`/messages/message/${messageId}`, { content });
  return data;
}

export async function deleteChatMessage(messageId: string): Promise<{ deleted: boolean }> {
  const { data } = await api.delete(`/messages/message/${messageId}`);
  return data;
}

export async function deleteConversation(conversationId: string): Promise<{ deleted: boolean }> {
  const { data } = await api.delete(`/messages/conversations/${conversationId}`);
  return data;
}

export async function startDirectConversation(userId: string): Promise<Conversation> {
  const { data } = await api.post(`/messages/direct/${userId}`);
  return data;
}

export interface PublicGroup {
  id: string;
  title: string | null;
  city: string | null;
  sport: string | null;
  memberCount: number;
  joined: boolean;
}

export async function getPublicGroups(params?: { city?: string; sport?: string }): Promise<PublicGroup[]> {
  const { data } = await api.get("/messages/groups", { params });
  return Array.isArray(data) ? data : [];
}

export async function joinPublicGroup(id: string): Promise<{ joined: boolean; conversationId: string }> {
  const { data } = await api.post(`/messages/groups/${id}/join`);
  return data;
}

export async function leavePublicGroup(id: string): Promise<{ joined: boolean }> {
  const { data } = await api.post(`/messages/groups/${id}/leave`);
  return data;
}

export async function ensureSupport(): Promise<{ id: string }> {
  const { data } = await api.post("/messages/support");
  return data;
}

export function chatUserName(u: ChatUser | null | undefined): string {
  if (!u) return "Conversation";
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "Player";
}

// ─── Helpers ──────────────────────────────────────────────────
import { getLocale, type Locale } from "./locale-store";

// Currency is always UZS; only the thousands separator and unit word are
// localized: "45 000 so'm" (uz) · "45 000 сум" (ru) · "45,000 UZS" (en).
const CURRENCY_UNIT: Record<Locale, string> = { uz: "so'm", ru: "сум", en: "UZS" };

export function formatCurrency(
  value: number | string | null | undefined,
  locale: Locale = getLocale(),
): string {
  const n = Number(value ?? 0);
  const grouped = n.toLocaleString(locale === "en" ? "en-US" : "ru-RU"); // ru-RU = space groups
  return `${grouped} ${CURRENCY_UNIT[locale]}`;
}

/** Back-compat wrapper — resolves the active locale at call time. */
export function formatUZS(value: number | string | null | undefined): string {
  return formatCurrency(value);
}
