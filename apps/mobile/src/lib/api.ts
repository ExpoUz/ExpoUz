import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from '@/lib/storage';
import { useAuthStore } from '@/store/auth.store';
import {
  IMatch,
  IMatchDetail,
  IMatchFormation,
  IBooking,
  IBookingDetail,
  IUser,
  IUserPublic,
  IConversation,
  IMessage,
  IPitch,
  IPitchDetail,
  INotification,
  IPitchBooking,
  Sport,
  MatchStatus,
  PaymentGateway,
  MatchPosition,
  TeamSide,
  PitchBookingType,
} from '@expouz/shared';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'https://api.expouz.uz/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor: attach Bearer token ─────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: refresh on 401 ────────────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            if (original.headers) original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL ?? 'https://api.expouz.uz/v1'}/auth/refresh`,
          { refreshToken },
        );

        const { accessToken, refreshToken: newRefresh } = data;
        useAuthStore.getState().setAuth(useAuthStore.getState().user!, accessToken, newRefresh);
        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', newRefresh);

        refreshQueue.forEach((cb) => cb(accessToken));
        refreshQueue = [];

        if (original.headers) original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearAuth();
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  sendOtp: (phone: string) =>
    api.post<{ message: string }>('/auth/send-otp', { phone }),

  verifyOtp: (phone: string, code: string) =>
    api.post<{ accessToken: string; refreshToken: string; isNewUser: boolean; user?: IUser }>(
      '/auth/verify-otp',
      { phone, otp: code },
    ),

  register: (data: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    city?: string;
    referralCode?: string;
  }) => api.post<{ accessToken: string; refreshToken: string; user: IUser }>('/auth/register', data),

  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken }),

  logout: () => api.post('/auth/logout'),

  googleAuth: (credential: string) =>
    api.post<{ accessToken: string; refreshToken: string; isNewUser: boolean; user: IUser }>(
      '/auth/google',
      { credential },
    ),

  telegramAuth: (initData: string) =>
    api.post<{ accessToken: string; refreshToken: string; isNewUser: boolean; user: IUser }>(
      '/auth/telegram',
      { initData },
    ),
};

// ─── Users API ────────────────────────────────────────────────────────────────
export const usersApi = {
  getMe: () => api.get<IUser>('/users/me'),

  getById: (id: string) => api.get<IUserPublic>(`/users/${id}`),

  updateMe: (data: Partial<IUser>) => api.patch<IUser>('/users/me', data),

  uploadAvatar: (formData: FormData) =>
    api.post<{ url: string }>('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteAccount: () => api.delete('/users/me'),
};

// ─── Matches API ──────────────────────────────────────────────────────────────
export interface MatchQueryParams {
  sport?: Sport;
  city?: string;
  status?: MatchStatus;
  date?: string;
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
  radius?: number;
}

export const matchesApi = {
  list: (params?: MatchQueryParams) => api.get<{ data: IMatch[]; total: number }>('/matches', { params }),

  getById: (id: string) => api.get<IMatchDetail>(`/matches/${id}`),

  create: (data: {
    pitchId: string;
    sport?: Sport;
    format: string;
    formation?: string;
    maxPlayers: number;
    minPlayers?: number;
    startTime: string;
    durationMinutes?: number;
    pricePerPlayer: number;
    isCoEd?: boolean;
    skillFilter?: string;
    description?: string;
  }) => api.post<IMatch>('/matches', data),

  update: (id: string, data: Partial<IMatch>) => api.patch<IMatch>(`/matches/${id}`, data),

  cancel: (id: string) => api.post(`/matches/${id}/cancel`),

  getFormation: (id: string) => api.get<IMatchFormation>(`/matches/${id}/formation`),

  updateFormation: (id: string, formation: string) =>
    api.patch<IMatchFormation>(`/matches/${id}/formation`, { formation }),

  ratePlayer: (id: string, data: {
    ratedId: string;
    overall: number;
    pace?: number;
    shooting?: number;
    passing?: number;
    dribbling?: number;
    defending?: number;
    physical?: number;
    comment?: string;
  }) => api.post(`/matches/${id}/rate`, data),
};

// ─── Bookings API ─────────────────────────────────────────────────────────────
export const bookingsApi = {
  create: (data: {
    matchId: string;
    positionId?: string;
    teamSide?: TeamSide;
    gateway: PaymentGateway;
  }) => api.post<IBooking>('/bookings', data),

  getMyBookings: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<{ data: IBookingDetail[]; total: number }>('/bookings/mine', { params }),

  getById: (id: string) => api.get<IBookingDetail>(`/bookings/${id}`),

  cancel: (id: string) => api.post(`/bookings/${id}/cancel`),
};

// ─── Pitches API ──────────────────────────────────────────────────────────────
export const pitchesApi = {
  list: (params?: { city?: string; sport?: Sport; lat?: number; lng?: number; radius?: number }) =>
    api.get<{ data: IPitch[]; total: number }>('/pitches', { params }),

  getById: (id: string) => api.get<IPitchDetail>(`/pitches/${id}`),

  search: (query: string, city?: string) =>
    api.get<IPitch[]>('/pitches/search', { params: { q: query, city } }),
};

// ─── Messages API ─────────────────────────────────────────────────────────────
export const messagesApi = {
  getConversations: () => api.get<IConversation[]>('/messages/conversations'),

  getMessages: (conversationId: string, params?: { before?: string; limit?: number }) =>
    api.get<IMessage[]>(`/messages/conversations/${conversationId}`, { params }),

  sendMessage: (conversationId: string, body: string) =>
    api.post<IMessage>(`/messages/conversations/${conversationId}`, { content: body }),

  sendImage: (conversationId: string, formData: FormData) =>
    api.post<IMessage>(`/messages/conversations/${conversationId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  createConversation: (participantId: string) =>
    api.post<IConversation>('/messages/conversations', { participantId }),
};

// ─── Notifications API ────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => api.get<INotification[]>('/notifications'),

  markRead: (id: string) => api.patch(`/notifications/${id}/read`),

  markAllRead: () => api.patch('/notifications/read-all'),

  registerPushToken: (token: string) =>
    api.post('/notifications/push-token', { token }),
};

// ─── Payments API ─────────────────────────────────────────────────────────────
export const paymentsApi = {
  initiate: (dto: { bookingId?: string; pitchBookingId?: string; gateway: string }) =>
    api.post<{
      transactionId: string;
      paymentUrl: string;
      amount: number;
      gateway: string;
      status: string;
      bookingType: 'MATCH' | 'PITCH';
    }>('/payments/initiate', dto),

  getStatus: (transactionId: string) =>
    api.get<{
      transactionId: string;
      status: string;
      amount: number;
      gateway: string;
      isPaid: boolean;
      bookingType: 'MATCH' | 'PITCH';
      booking: any | null;
      pitchBooking: any | null;
    }>(`/payments/status/${transactionId}`),

  payWithWallet: (transactionId: string) =>
    api.post<{ message: string; isPaid: boolean }>('/payments/wallet/pay', { transactionId }),

  getWalletBalance: () => api.get<{ balance: number }>('/payments/wallet/balance'),

  topUpWallet: (amount: number, gateway: string) =>
    api.post<{ transaction: any; paymentUrl: string }>('/payments/wallet/topup', { amount, gateway }),
};

// ─── Pitch Bookings API ───────────────────────────────────────────────────────
export const pitchBookingsApi = {
  create: (data: {
    pitchId: string;
    title: string;
    type: PitchBookingType;
    startTime: string;
    durationHours: number;
    maxParticipants?: number;
    notes?: string;
    gateway?: PaymentGateway;
  }) => api.post<IPitchBooking>('/pitch-bookings', data),

  listOpen: (pitchId?: string) =>
    api.get<IPitchBooking[]>('/pitch-bookings/open', { params: pitchId ? { pitchId } : undefined }),

  myBookings: () => api.get<IPitchBooking[]>('/pitch-bookings/my'),

  getById: (id: string) => api.get<IPitchBooking>(`/pitch-bookings/${id}`),

  join: (id: string) => api.post<{ message: string }>(`/pitch-bookings/${id}/join`),

  cancel: (id: string) =>
    api.delete<{ message: string; refundAmount?: number; feeCharged?: number }>(`/pitch-bookings/${id}`),

  getTelegramInvite: () => api.get<{ inviteLink: string }>('/pitch-bookings/telegram-invite'),
};

// ─── Pitch Admin API ──────────────────────────────────────────────────────────
export const pitchAdminApi = {
  getDashboard: () => api.get('/pitch-admin/dashboard'),

  getPitches: () => api.get('/pitch-admin/pitches'),

  getPitchDetail: (id: string) => api.get(`/pitch-admin/pitches/${id}`),

  updateAvailability: (id: string, isActive: boolean) =>
    api.patch(`/pitch-admin/pitches/${id}/availability`, { isActive }),

  getMatches: (params?: { page?: number; limit?: number }) =>
    api.get('/pitch-admin/matches', { params }),

  cancelMatch: (id: string) => api.delete(`/pitch-admin/matches/${id}`),

  getPitchBookings: (params?: { status?: string; pitchId?: string; page?: number; limit?: number }) =>
    api.get('/pitch-admin/pitch-bookings', { params }),

  cancelPitchBooking: (id: string) => api.delete(`/pitch-admin/pitch-bookings/${id}`),

  getUsers: (params?: { pitchId?: string; search?: string; page?: number; limit?: number }) =>
    api.get('/pitch-admin/users', { params }),

  getRevenue: () => api.get('/pitch-admin/revenue'),
};

// ─── Super Admin API ──────────────────────────────────────────────────────────
export const superAdminApi = {
  getPitchAdmins: (params?: { search?: string; city?: string; page?: number; limit?: number }) =>
    api.get('/admin/pitch-admins', { params }),

  getPitchAdminById: (id: string) => api.get(`/admin/pitch-admins/${id}`),

  createPitchAdmin: (dto: any) => api.post('/admin/pitch-admins', dto),

  updatePitchAdmin: (id: string, dto: any) => api.patch(`/admin/pitch-admins/${id}`, dto),

  deletePitchAdmin: (id: string) => api.delete(`/admin/pitch-admins/${id}`),

  getUserById: (id: string) => api.get(`/admin/users/${id}`),

  getUsers: (params?: { role?: string; search?: string; page?: number; limit?: number }) =>
    api.get('/admin/users', { params }),

  updateUser: (id: string, dto: any) => api.patch(`/admin/users/${id}`, dto),

  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),

  getLocations: (params?: { city?: string; search?: string }) =>
    api.get('/admin/locations', { params }),

  createLocation: (dto: any) => api.post('/admin/locations', dto),

  updateLocation: (id: string, dto: any) => api.patch(`/admin/locations/${id}`, dto),

  deleteLocation: (id: string) => api.delete(`/admin/locations/${id}`),

  getAllPitches: (params?: any) => api.get('/admin/pitches', { params }),

  createPitch: (dto: any) => api.post('/admin/pitches', dto),

  updatePitch: (id: string, dto: any) => api.patch(`/admin/pitches/${id}`, dto),

  getActivityLog: (params?: any) => api.get('/admin/activity-log', { params }),

  getOnlineStatus: () => api.get('/admin/online-status'),

  // ─── AI / Gemini ─────────────────────────────────────────────────────────
  aiSnapshot: () => api.get('/admin/ai/snapshot'),

  aiAnalyze: (prompt?: string) => api.post('/admin/ai/analyze', { prompt }),

  aiChat: (message: string) => api.post('/admin/ai/chat', { message }),

  aiResetChat: () => api.post('/admin/ai/reset', {}),
};
