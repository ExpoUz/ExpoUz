import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
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
  Sport,
  MatchStatus,
  PaymentGateway,
  MatchPosition,
  TeamSide,
} from '@fubles-uz/shared';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'https://api.fublesuz.com/v1',
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
          `${process.env.EXPO_PUBLIC_API_URL ?? 'https://api.fublesuz.com/v1'}/auth/refresh`,
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
      { phone, code },
    ),

  register: (data: {
    phone: string;
    name: string;
    username: string;
    dateOfBirth: string;
    gender: string;
    city: string;
    preferredPositions: MatchPosition[];
    referralCode?: string;
    avatarUrl?: string;
  }) => api.post<{ accessToken: string; refreshToken: string; user: IUser }>('/auth/register', data),

  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken }),

  logout: () => api.post('/auth/logout'),
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
    title: string;
    description?: string;
    sport: Sport;
    formation: string;
    maxPlayers: number;
    scheduledAt: string;
    durationMinutes: number;
    isPublic: boolean;
    allowWatchers: boolean;
    skillLevel?: string;
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
    position: MatchPosition;
    team: TeamSide;
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
    api.post<IMessage>(`/messages/conversations/${conversationId}`, { body }),

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
  initiate: (bookingId: string, gateway: PaymentGateway) =>
    api.post<{ paymentUrl?: string; invoiceId?: string }>('/payments/initiate', { bookingId, gateway }),

  getWalletBalance: () => api.get<{ balance: number; currency: string }>('/payments/wallet'),
};
