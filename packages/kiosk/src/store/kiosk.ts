import { create } from 'zustand';

interface KioskState {
  eventSlug: string;
  language: string;
  lastInteraction: number;
  setLanguage: (lang: string) => void;
  touch: () => void;
}

export const useKioskStore = create<KioskState>((set) => ({
  eventSlug: import.meta.env.VITE_EVENT_SLUG || 'experts-live-netherlands-2026',
  language: 'nl',
  lastInteraction: Date.now(),
  setLanguage: (lang: string) => set({ language: lang }),
  touch: () => set({ lastInteraction: Date.now() }),
}));
