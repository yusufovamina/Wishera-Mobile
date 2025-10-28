import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, userApi, endpoints } from '../api/client';

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
      console.log('Attempting login with:', { email: username });
      // Backend expects email and password, using username as email for now
      const res = await api.post(endpoints.login, { email: username, password });
      console.log('Login response:', res.data);
      const token = res.data?.token || res.data; // backend may return raw token
      await AsyncStorage.setItem('auth_token', token);
      set({ token });
      console.log('Token set, calling identify...');
      await (useAuthStore.getState().identify());
      console.log('Login completed successfully');
    } catch (e: any) {
      console.log('Login error:', e?.response?.data || e.message);
      set({ error: e?.response?.data?.message || 'Login failed' });
    } finally {
      set({ loading: false });
    }
  },
  register: async (username, password) => {
    set({ loading: true, error: null });
    try {
      // Backend expects username, email, and password
      // Using username as email for now
      await api.post(endpoints.register, { username, email: username, password });
      await (useAuthStore.getState().login(username, password));
    } catch (e: any) {
      set({ error: e?.response?.data?.message || 'Registration failed' });
    } finally {
      set({ loading: false });
    }
  },
  identify: async () => {
    try {
      console.log('Calling identify endpoint:', endpoints.identification);
      // Use userApi since profile is on user-service (port 5001)
      const res = await userApi.get(endpoints.identification);
      console.log('Identify response:', res.data);
      
      // Transform user data to match expected format
      const userData = {
        id: res.data.id || res.data.userId,
        username: res.data.username,
        email: res.data.email,
        avatar: res.data.avatarUrl,
      };
      
      set({ user: userData });
    } catch (error: any) {
      console.log('Identify error:', error?.message);
      console.log('Identify error response:', error?.response?.data);
      set({ user: null });
    }
  },
  logout: async () => {
    await AsyncStorage.removeItem('auth_token');
    set({ user: null, token: null });
  },
}));


