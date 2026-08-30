import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  user: any | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: any, token: string, refreshToken: string) => void;
  clearAuth: () => void;
  loadAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: async (user, token, refreshToken) => {
    await SecureStore.setItemAsync('access_token', token);
    await SecureStore.setItemAsync('refresh_token', refreshToken);
    set({ user, token });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ user: null, token: null });
  },

  loadAuth: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (token) {
        set({ token });
      }
    } catch {}
    set({ isLoading: false });
  },
}));
