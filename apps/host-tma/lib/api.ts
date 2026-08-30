import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1' });

if (typeof window !== 'undefined') {
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('host_tma_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}

export const pitchAdminApi = {
  getDashboard: () => api.get('/pitch-admin/dashboard').then((r) => r.data),
  getPitches: () => api.get('/pitch-admin/pitches').then((r) => r.data),
  createPitch: (data: any) => api.post('/pitch-admin/pitches', data).then((r) => r.data),
  updatePitch: (id: string, data: any) => api.patch(`/pitch-admin/pitches/${id}`, data).then((r) => r.data),
  getSchedule: (pitchId: string, date?: string) => api.get(`/pitch-admin/pitches/${pitchId}/schedule`, { params: { date } }).then((r) => r.data),
  getPlayers: (matchId: string) => api.get(`/pitch-admin/matches/${matchId}/players`).then((r) => r.data),
  checkin: (matchId: string, bookingId: string) => api.post(`/pitch-admin/matches/${matchId}/checkin`, { bookingId }).then((r) => r.data),
  completeMatch: (matchId: string) => api.post(`/pitch-admin/matches/${matchId}/complete`).then((r) => r.data),
  getRevenue: (pitchId: string, range?: string) => api.get(`/pitch-admin/pitches/${pitchId}/revenue`, { params: { range } }).then((r) => r.data),
  getMatches: (params?: any) => api.get('/pitch-admin/matches', { params }).then((r) => r.data),
  createMatch: (data: any) => api.post('/pitch-admin/matches', data).then((r) => r.data),
};

export default api;
