import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, endpoints } from '../api/client';

type User = { id: string; username: string } | null;

type AuthState = {
  user: User;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  identify: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: false,
  error: null,
  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post(endpoints.login, { username, password });
      const token = res.data?.token || res.data; // backend may return raw token
      await AsyncStorage.setItem('auth_token', token);
      set({ token });
      await (useAuthStore.getState().identify());
    } catch (e: any) {
      set({ error: e?.response?.data?.message || 'Login failed' });
    } finally {
      set({ loading: false });
    }
  },
  register: async (username, password) => {
    set({ loading: true, error: null });
    try {
      await api.post(endpoints.register, { username, password });
      await (useAuthStore.getState().login(username, password));
    } catch (e: any) {
      set({ error: e?.response?.data?.message || 'Registration failed' });
    } finally {
      set({ loading: false });
    }
  },
  identify: async () => {
    try {
      const res = await api.get(endpoints.identification);
      set({ user: res.data });
    } catch {
      set({ user: null });
    }
  },
  logout: async () => {
    await AsyncStorage.removeItem('auth_token');
    set({ user: null, token: null });
  },
}));


