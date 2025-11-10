import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

type PreferencesState = {
  theme: 'light' | 'dark';
  language: 'en' | 'ru' | 'az';
  hydrated: boolean;
  setTheme: (t: 'light' | 'dark') => Promise<void>;
  setLanguage: (l: 'en' | 'ru' | 'az') => Promise<void>;
  hydrate: () => Promise<void>;
};

export const usePreferences = create<PreferencesState>((set, get) => ({
  theme: 'light',
  language: 'en',
  hydrated: false,
  setTheme: async (t) => {
    set({ theme: t });
    await AsyncStorage.setItem('pref_theme', t);
  },
  setLanguage: async (l) => {
    set({ language: l });
    await AsyncStorage.setItem('pref_lang', l);
  },
  hydrate: async () => {
    try {
      const [t, l] = await Promise.all([
        AsyncStorage.getItem('pref_theme'),
        AsyncStorage.getItem('pref_lang'),
      ]);
      set({ theme: (t as any) === 'dark' ? 'dark' : 'light', language: ((l as any) || 'en') as any, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));



