import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Determine the correct base host for backend services across simulator and devices
const getBaseUrl = () => {
  if (__DEV__) {
    // Prefer packager host IP for physical devices on LAN
    const hostUri = (Constants as any)?.expoConfig?.hostUri || (Constants as any)?.manifest?.debuggerHost || '';
    const packagerHost = typeof hostUri === 'string' ? hostUri.split(':')[0] : '';

    // Android emulator maps host to 10.0.2.2
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2';
    }

    // iOS simulator can use localhost; physical device must use LAN IP
    if (Platform.OS === 'ios') {
      return packagerHost && packagerHost !== 'localhost' ? `http://${packagerHost}` : 'http://localhost';
    }

    // Fallback for other platforms (web, etc.)
    return packagerHost ? `http://${packagerHost}` : 'http://localhost';
  }
  // In production, use your actual backend URL (env/remote)
  return 'https://your-production-url.com';
};

const baseUrl = getBaseUrl();

// Different services run on different ports
export const authServiceUrl = `${baseUrl}:5219`;  // Auth service
const userServiceUrl = `${baseUrl}:5001`;  // User service
const wishlistServiceUrl = `${baseUrl}:5003`; // Gift/wishlist service
export const chatServiceUrl = `${baseUrl}:5002`;  // Chat service

console.log('Platform:', Platform.OS);
console.log('Auth Service URL:', authServiceUrl);
console.log('User Service URL:', userServiceUrl);
console.log('Wishlist Service URL:', wishlistServiceUrl);
console.log('Chat Service URL:', chatServiceUrl);

// Auth API client
export const api = axios.create({ baseURL: authServiceUrl });

// User API client  
export const userApi = axios.create({ baseURL: userServiceUrl });

// Wishlist API client
export const wishlistApi = axios.create({ baseURL: wishlistServiceUrl });

// Chat API client
export const chatApi = axios.create({ baseURL: chatServiceUrl });

// Add error handler for debugging
api.interceptors.response.use(
  response => response,
  error => {
    // Don't log 400 errors for forgot-password as they're handled as success cases
    const isForgotPassword = error.config?.url?.includes('forgot-password');
    const isSecurityResponse = error.response?.status === 400 && 
                               error.response?.data?.message?.includes('password reset link will be sent');
    
    if (isForgotPassword && isSecurityResponse) {
      // This is expected - backend returns 400 for security, but we treat it as success
      console.log('Password reset email will be sent (security response)');
    } else {
      console.error('API Error:', error.message);
      console.error('Request URL:', error.config?.url);
      console.error('Response:', error.response?.data);
    }
    return Promise.reject(error);
  }
);

userApi.interceptors.response.use(
  response => response,
  error => {
    console.error('User API Error:', error.message);
    console.error('Request URL:', error.config?.url);
    console.error('Response:', error.response?.data);
    return Promise.reject(error);
  }
);

wishlistApi.interceptors.response.use(
  response => response,
  error => {
    console.error('Wishlist API Error:', error.message);
    console.error('Request URL:', error.config?.url);
    console.error('Response:', error.response?.data);
    return Promise.reject(error);
  }
);

chatApi.interceptors.response.use(
  response => response,
  error => {
    const url = error.config?.url || '';
    const status = error.response?.status;
    // Silence expected 404s for chat history by returning empty list
    if (status === 404 && typeof url === 'string' && url.startsWith('/api/chat/history')) {
      const fakeResponse = {
        data: [],
        status: 200,
        statusText: 'OK',
        headers: error.response?.headers ?? {},
        config: error.config,
      } as any;
      return Promise.resolve(fakeResponse);
    }

    // Only log server-side issues or unexpected client errors
    if (!status || status >= 500) {
      console.error('Chat API Error:', error.message);
      console.error('Request URL:', error.config?.url);
      console.error('Response:', error.response?.data);
    }
    return Promise.reject(error);
  }
);

// Add auth token to all API requests
const addAuthToken = async (config: any) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

api.interceptors.request.use(addAuthToken);
userApi.interceptors.request.use(addAuthToken);
wishlistApi.interceptors.request.use(addAuthToken);
chatApi.interceptors.request.use(addAuthToken);

export const endpoints = {
  // Align to web/frontend routes (lowercase)
  login: '/api/auth/login',
  register: '/api/auth/register',
  forgotPassword: '/api/auth/forgot-password',
  verifyResetCode: '/api/auth/verify-reset-code',
  resetPassword: '/api/auth/reset-password',
  googleLogin: '/api/ExternalAuth/login/google',
  deleteAccount: '/api/auth/delete-account',
  identification: '/api/users/profile',
  updateProfile: '/api/users/profile',
  uploadAvatar: '/api/users/avatar',
  wishlistsFeed: '/api/wishlists/feed',
  wishlistById: (id: string) => `/api/wishlists/${id}`,
  wishlistLike: (id: string) => `/api/wishlists/${id}/like`,
  giftsForUser: '/api/gift/wishlist',
  // Parity with web app
  updateBirthday: '/api/users/birthday',
  followers: (userId: string, page: number = 1, pageSize: number = 10) => `/api/users/${userId}/followers?page=${page}&pageSize=${pageSize}`,
  following: (userId: string, page: number = 1, pageSize: number = 10) => `/api/users/${userId}/following?page=${page}&pageSize=${pageSize}`,
  likedWishlists: (page: number = 1, pageSize: number = 20) => `/api/wishlists/liked?page=${page}&pageSize=${pageSize}`,
  userWishlists: (userId: string, page: number = 1, pageSize: number = 20) => `/api/wishlists/user/${userId}?page=${page}&pageSize=${pageSize}`,
  reservedGifts: '/api/gift/reserved',
  // Events
  createEvent: '/api/events',
  myEvents: (page: number = 1, pageSize: number = 10) => `/api/events/my-events?page=${page}&pageSize=${pageSize}`,
  invitedEvents: (page: number = 1, pageSize: number = 10) => `/api/events/invited-events?page=${page}&pageSize=${pageSize}`,
  eventById: (id: string) => `/api/events/${id}`,
  cancelEvent: (id: string) => `/api/events/${id}/cancel`,
  deleteEvent: (id: string) => `/api/events/${id}`,
  myInvitations: (page: number = 1, pageSize: number = 10) => `/api/events/my-invitations?page=${page}&pageSize=${pageSize}`,
  respondInvitation: (invitationId: string) => `/api/events/invitations/${invitationId}/respond`,
  // Chat endpoints
  chatHistory: (userId: string, peerUserId: string, page: number = 1, pageSize: number = 50) => 
    `/api/chat/history/${userId}/${peerUserId}?page=${page}&pageSize=${pageSize}`,
  searchUsers: (query: string, page: number = 1, pageSize: number = 10) => 
    `/api/users/search?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
  getFollowing: (userId: string, page: number = 1, pageSize: number = 50) => 
    `/api/users/${userId}/following?page=${page}&pageSize=${pageSize}`,
  getUserProfile: (userId: string) => `/api/users/${userId}`,
  followUser: (userId: string) => `/api/users/follow/${userId}`,
  unfollowUser: (userId: string) => `/api/users/unfollow/${userId}`,
  getSuggestedUsers: (page: number = 1, pageSize: number = 10) => 
    `/api/users/suggested?page=${page}&pageSize=${pageSize}`,
  getMyFriends: (page: number = 1, pageSize: number = 20) => 
    `/api/users/my-friends?page=${page}&pageSize=${pageSize}`,
  // Chat message operations
  editChatMessage: '/api/chat/message/edit',
  deleteChatMessage: '/api/chat/message/delete',
  // Chat pins
  getPinnedMessages: (meUserId: string, peerUserId: string) => 
    `/api/chat/pins?me=${encodeURIComponent(meUserId)}&peer=${encodeURIComponent(peerUserId)}`,
  pinChatMessage: '/api/chat/pins',
  unpinChatMessage: '/api/chat/pins',
  // Chat wallpaper
  getConversationWallpaper: (meUserId: string, peerUserId: string) => 
    `/api/chat/preferences/wallpaper?me=${encodeURIComponent(meUserId)}&peer=${encodeURIComponent(peerUserId)}`,
  setConversationWallpaper: '/api/chat/preferences/wallpaper',
  getWallpaperCatalog: (userId?: string) => 
    userId ? `/api/chat/wallpapers?userId=${encodeURIComponent(userId)}` : '/api/chat/wallpapers',
  uploadCustomWallpaper: '/api/chat/upload-wallpaper',
  getCustomWallpapers: (userId: string) => 
    `/api/chat/custom-wallpapers?userId=${encodeURIComponent(userId)}`,
  deleteCustomWallpaper: (wallpaperId: string, userId: string) => 
    `/api/chat/custom-wallpapers/${encodeURIComponent(wallpaperId)}?userId=${encodeURIComponent(userId)}`,
  // Chat media upload
  uploadChatMedia: '/api/chat/upload-media',
};

// Helper to use correct API client based on endpoint
export const getApiClient = (endpoint: string) => {
  if (endpoint.startsWith('/api/Auth')) {
    return api;
  } else if (endpoint.startsWith('/api/Users') || endpoint.startsWith('/api/users')) {
    return userApi;
  } else if (endpoint.startsWith('/api/Wishlists') || endpoint.startsWith('/api/Gift')) {
    return wishlistApi;
  } else if (endpoint.startsWith('/api/chat')) {
    return chatApi;
  }
  return api; // default
};


