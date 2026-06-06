import { create } from 'zustand';
import { Sport } from '@playwithus/shared';

type Language = 'en' | 'uz' | 'ru';

interface AppState {
  language: Language;
  city: string;
  sport: Sport;
}

interface AppActions {
  setLanguage: (language: Language) => void;
  setCity: (city: string) => void;
  setSport: (sport: Sport) => void;
}

export const useAppStore = create<AppState & AppActions>((set) => ({
  language: 'uz',
  city: 'Tashkent',
  sport: Sport.FOOTBALL,

  setLanguage: (language) => set({ language }),
  setCity: (city) => set({ city }),
  setSport: (sport) => set({ sport }),
}));
