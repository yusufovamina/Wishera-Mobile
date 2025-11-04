import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, userApi, endpoints, authServiceUrl } from '../api/client';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

type User = { id: string; username: string } | null;

type AuthState = {
  user: User;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  verifyResetCode: (email: string, code: string) => Promise<string>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  identify: () => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
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
      await (get().identify());
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
      await (get().login(username, password));
    } catch (e: any) {
      set({ error: e?.response?.data?.message || 'Registration failed' });
    } finally {
      set({ loading: false });
    }
  },
  forgotPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      // Add X-Client-Type header to indicate this is a mobile request
      await api.post(endpoints.forgotPassword, { email }, {
        headers: {
          'X-Client-Type': 'mobile'
        }
      });
      // If we get here, it was a successful 200 response
    } catch (e: any) {
      // Backend returns 400 for security reasons (doesn't reveal if email exists)
      // But includes a success message in the response
      const message = e?.response?.data?.message || '';
      const status = e?.response?.status;
      
      if (status === 400 && (message.includes('password reset code will be sent') || message.includes('password reset link will be sent'))) {
        // This is actually a success case - backend is just being security-conscious
        // Don't set error, don't throw - treat as success
        console.log('Forgot password request handled successfully (security response)');
        return;
      }
      
      // Only set error for actual failures
      set({ error: message || 'Failed to send reset email' });
      throw e;
    } finally {
      set({ loading: false });
    }
  },
  verifyResetCode: async (email, code) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post(endpoints.verifyResetCode, { email, code });
      const token = response.data.token;
      return token;
    } catch (e: any) {
      set({ error: e?.response?.data?.message || 'Invalid or expired code' });
      throw e;
    } finally {
      set({ loading: false });
    }
  },
  resetPassword: async (token, newPassword) => {
    set({ loading: true, error: null });
    try {
      await api.post(endpoints.resetPassword, { token, newPassword });
    } catch (e: any) {
      set({ error: e?.response?.data?.message || 'Failed to reset password' });
      throw e;
    } finally {
      set({ loading: false });
    }
  },
  loginWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      // For web platform, we need to handle OAuth differently
      if (Platform.OS === 'web') {
        // On web, redirect directly to the backend endpoint
        // The backend will detect the Origin header and redirect back to the same origin
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
        console.log('[Web OAuth] Current origin:', currentOrigin);
        console.log('[Web OAuth] Redirecting to:', `${authServiceUrl}${endpoints.googleLogin}`);
        
        // Open in same window - backend will redirect to Google, then back
        // The backend should detect the Origin header and redirect to currentOrigin/oauth-complete
        window.location.href = `${authServiceUrl}${endpoints.googleLogin}`;
        return; // Don't wait for completion, browser handles it
      }
      
      // For mobile platforms, use deep linking
      // Create a deep link URL for the OAuth callback
      // Format: wishera://oauth-complete?token=xxx&userId=xxx&username=xxx
      const redirectUrl = Linking.createURL('/oauth-complete');
      
      // Add clientType parameter to tell backend this is a mobile client
      const authUrl = `${authServiceUrl}${endpoints.googleLogin}?clientType=mobile`;
      
      console.log('[Mobile OAuth] Opening Google OAuth:', authUrl);
      console.log('[Mobile OAuth] Expected redirect to:', redirectUrl);
      console.log('[Mobile OAuth] Platform:', Platform.OS);
      
      // Open browser for OAuth flow - it will follow redirects
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUrl
      );
      
      console.log('[Mobile OAuth] OAuth result:', result.type);
      console.log('[Mobile OAuth] Result URL:', result.url);
      
      if (result.type === 'success') {
        // Parse the callback URL to extract token
        const url = result.url;
        console.log('[Mobile OAuth] Parsing URL:', url);
        const parsedUrl = Linking.parse(url);
        const token = parsedUrl.queryParams?.token as string;
        const userId = parsedUrl.queryParams?.userId as string;
        const username = parsedUrl.queryParams?.username as string;
        
        console.log('[Mobile OAuth] Parsed OAuth callback:', { token: token ? 'present' : 'missing', userId, username });
        console.log('[Mobile OAuth] Parsed URL details:', parsedUrl);
        
        if (token) {
          await AsyncStorage.setItem('auth_token', token);
          set({ token });
          // Fetch user profile
          await get().identify();
        } else {
          // If backend redirected to HTTP URL instead of deep link, try to extract token from HTTP URL
          if (url.includes('localhost:3000') || url.includes('http://') || url.includes('https://')) {
            console.log('[Mobile OAuth] Backend redirected to HTTP URL, extracting token from URL');
            // Try to parse as regular URL
            try {
              const httpUrl = new URL(url);
              const httpToken = httpUrl.searchParams.get('token');
              const httpUserId = httpUrl.searchParams.get('userId');
              const httpUsername = httpUrl.searchParams.get('username');
              
              if (httpToken) {
                console.log('[Mobile OAuth] Extracted token from HTTP URL');
                await AsyncStorage.setItem('auth_token', httpToken);
                set({ token: httpToken });
                await get().identify();
                return; // Successfully handled
              }
            } catch (e) {
              console.error('[Mobile OAuth] Failed to parse HTTP URL:', e);
            }
            
            throw new Error('Backend redirected to web URL but no token found. Check backend logs - state should start with "google_mobile_".');
          }
          throw new Error('No token received from Google login');
        }
      } else if (result.type === 'cancel') {
        throw new Error('Google login was cancelled');
      } else {
        throw new Error(`Google login failed: ${result.type}`);
      }
    } catch (e: any) {
      console.log('Google login error:', e?.response?.data || e.message);
      set({ error: e?.response?.data?.message || e.message || 'Google login failed' });
    } finally {
      set({ loading: false });
    }
  },
  identify: async () => {
    try {
      // First, try to load token from AsyncStorage if not already set
      const currentState = get();
      let token = currentState.token;
      if (!token) {
        token = await AsyncStorage.getItem('auth_token');
        if (token) {
          set({ token });
        }
      }
      
      // If no token, can't identify
      if (!token) {
        console.log('No token found, skipping identify');
        set({ user: null });
        return;
      }
      
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
      // Clear invalid token
      await AsyncStorage.removeItem('auth_token');
      set({ user: null, token: null });
    }
  },
  logout: async () => {
    await AsyncStorage.removeItem('auth_token');
    set({ user: null, token: null });
  },
  hydrate: async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        set({ token });
        // Try to identify user with the token
        await get().identify();
      }
    } catch (error) {
      console.log('Hydrate error:', error);
    }
  },
}));


