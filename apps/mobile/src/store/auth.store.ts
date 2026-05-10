import { create } from 'zustand';
import { IUser } from '@fubles-uz/shared';

interface AuthState {
  user: IUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  setAuth: (user: IUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setUser: (user: IUser) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, accessToken, refreshToken) =>
    set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false }),

  clearAuth: () =>
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false }),

  setUser: (user) => set({ user }),

  setLoading: (isLoading) => set({ isLoading }),
}));
