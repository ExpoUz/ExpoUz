import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

api.interceptors.response.use(undefined, async (error) => {
  if (error.response?.status === 401) {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
  }
  return Promise.reject(error);
});

export const authApi = {
  sendOtp: (phone: string) => api.post('/auth/send-otp', { phone }).then((r) => r.data),
  verifyOtp: (phone: string, code: string) => api.post('/auth/verify-otp', { phone, code }).then((r) => r.data),
  register: (data: any) => api.post('/auth/register', data).then((r) => r.data),
};

export const matchesApi = {
  getAll: (params?: any) => api.get('/matches', { params }).then((r) => r.data),
  getToday: () => api.get('/matches/today').then((r) => r.data),
  getOne: (id: string) => api.get(`/matches/${id}`).then((r) => r.data),
  getFormation: (id: string) => api.get(`/matches/${id}/formation`).then((r) => r.data),
  create: (data: any) => api.post('/matches', data).then((r) => r.data),
  rate: (id: string, ratings: any[]) => api.post(`/matches/${id}/rate`, { ratings }).then((r) => r.data),
};

export const bookingsApi = {
  create: (data: any) => api.post('/bookings', data).then((r) => r.data),
  getOne: (id: string) => api.get(`/bookings/${id}`).then((r) => r.data),
  cancel: (id: string) => api.post(`/bookings/${id}/cancel`).then((r) => r.data),
};

export const pitchesApi = {
  getAll: (params?: any) => api.get('/pitches', { params }).then((r) => r.data),
  getNearby: (lat: number, lng: number) => api.get('/pitches/nearby', { params: { lat, lng } }).then((r) => r.data),
  getOne: (id: string) => api.get(`/pitches/${id}`).then((r) => r.data),
};

export const usersApi = {
  getMe: () => api.get('/users/me').then((r) => r.data),
  updateMe: (data: any) => api.patch('/users/me', data).then((r) => r.data),
  getStats: () => api.get('/users/me/stats').then((r) => r.data),
  getMyBookings: () => api.get('/users/me/bookings').then((r) => r.data),
  getNotifications: (page = 1) => api.get('/users/me/notifications', { params: { page } }).then((r) => r.data),
  getPublicProfile: (id: string) => api.get(`/users/${id}/public`).then((r) => r.data),
};

export const paymentsApi = {
  getBalance: () => api.get('/payments/wallet/balance').then((r) => r.data),
  topup: (amount: number, gateway: string) => api.post('/payments/wallet/topup', { amount, gateway }).then((r) => r.data),
};

export default api;
