import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Import auth store to clear user state on 401
let authStore: any = null;
try {
  // Dynamic import to avoid circular dependency
  const authModule = require('./state/auth');
  authStore = authModule.useAuthStore;
} catch (e) {
  console.log('Could not import auth store for 401 handling:', e);
}

// USE_LOCAL_BACKEND flag to control whether to use localhost or production
// Set to false to always use production API Gateway (recommended for mobile testing)
const USE_LOCAL_BACKEND = true;

// Determine the correct base URL for backend services
const getBaseUrl = () => {
  // PRODUCTION: Always use the API Gateway (recommended)
  if (!__DEV__ || !USE_LOCAL_BACKEND) {
    return 'https://wishera-app.onrender.com';
  }

  // DEVELOPMENT with LOCAL backend (requires all services running locally)
  if (__DEV__ && USE_LOCAL_BACKEND) {
    // For web platform, use localhost directly (backend must have CORS enabled)
    if (Platform.OS === 'web') {
      return 'http://localhost';
    }

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

    // Fallback for other platforms
    return packagerHost ? `http://${packagerHost}` : 'http://localhost';
  }

  // Fallback to production
  return 'https://wishera-app.onrender.com';
};

const baseUrl = getBaseUrl();
const isUsingApiGateway = baseUrl.includes('wishera-app.onrender.com') || !USE_LOCAL_BACKEND;

// When using API Gateway (production or dev mode), all requests go through the gateway
// When using local backend, different services run on different ports
export const authServiceUrl = isUsingApiGateway ? baseUrl : `${baseUrl}:5219`;
const userServiceUrl = isUsingApiGateway ? baseUrl : `${baseUrl}:5001`;
const wishlistServiceUrl = isUsingApiGateway ? baseUrl : `${baseUrl}:5003`;
export const chatServiceUrl = isUsingApiGateway ? baseUrl : `${baseUrl}:5002`;

console.log('=== Wishera Mobile API Configuration ===');
console.log('Platform:', Platform.OS);
console.log('Environment:', __DEV__ ? 'Development' : 'Production');
console.log('Using API Gateway:', isUsingApiGateway);
console.log('Auth Service URL:', authServiceUrl);
console.log('User Service URL:', userServiceUrl);
console.log('Wishlist Service URL:', wishlistServiceUrl);
console.log('Chat Service URL:', chatServiceUrl);
console.log('=====================================');

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
    console.error('API Error:', error.message);
    console.error('Request URL:', error.config?.url);
    console.error('Response:', error.response?.data);
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
  async error => {
    console.error('Wishlist API Error:', error.message);
    console.error('Request URL:', error.config?.url);
    console.error('Response:', error.response?.data);
    console.error('Response Status:', error.response?.status);
    
    // Handle 500 errors - might be "already reserved" error from backend
    if (error?.response?.status === 500) {
      const errorData = error.response.data;
      const errorMessage = typeof errorData === 'string' 
        ? errorData 
        : errorData?.message || errorData?.error || errorData?.title || '';
      
      // If the error message contains "already reserved", convert to 400 error
      if (errorMessage.includes('already reserved') || errorMessage.includes('Already reserved') || errorMessage.includes('Gift is already reserved')) {
        // Create a more user-friendly error response
        error.response.status = 400;
        error.response.data = {
          ...(typeof errorData === 'object' ? errorData : {}),
          message: 'This gift is already reserved by someone else.',
          error: 'Gift is already reserved!',
        };
      }
    }
    
    // Handle 401 Unauthorized - token expired or invalid
    if (error?.response?.status === 401) {
      console.warn('401 Unauthorized - token may be expired or invalid');
      // Clear invalid token and user state
      try {
        await AsyncStorage.removeItem('auth_token');
        console.log('Cleared invalid auth token');
        // Clear auth store state if available
        if (authStore) {
          const logout = authStore.getState()?.logout;
          if (logout) {
            await logout();
            console.log('Cleared auth store state');
          }
        }
      } catch (e) {
        console.error('Error clearing token:', e);
      }
    }
    
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
  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Auth token added to request:', config.url);
    } else {
      console.warn('No auth token found for request:', config.url);
    }
    return config;
  } catch (error) {
    console.error('Error adding auth token:', error);
    return config;
  }
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
  verifyLoginCode: '/api/auth/verify-login-code',
  resendLoginCode: '/api/auth/resend-login-code',
  googleLogin: '/api/auth/google',
  googleLoginMobile: '/api/auth/google-mobile',
  deleteAccount: '/api/auth/delete-account',
  identification: '/api/users/profile',
  updateProfile: '/api/users/profile',
  uploadAvatar: '/api/users/avatar',
  wishlistsFeed: '/api/wishlists/feed',
  wishlistById: (id: string) => `/api/wishlists/${id}`,
  updateWishlist: (id: string) => `/api/wishlists/${id}`,
  wishlistLike: (id: string) => `/api/wishlists/${id}/like`,
  wishlistUnlike: (id: string) => `/api/wishlists/${id}/unlike`,
  giftsForUser: '/api/gift/wishlist',
  updateGift: (id: string) => `/api/gift/${id}`,
  uploadGiftImage: (id: string) => `/api/gift/${id}/upload-image`,
  // Parity with web app
  updateBirthday: '/api/users/birthday',
  followers: (userId: string, page: number = 1, pageSize: number = 10) => `/api/users/${userId}/followers?page=${page}&pageSize=${pageSize}`,
  following: (userId: string, page: number = 1, pageSize: number = 10) => `/api/users/${userId}/following?page=${page}&pageSize=${pageSize}`,
  likedWishlists: (page: number = 1, pageSize: number = 20) => `/api/wishlists/liked?page=${page}&pageSize=${pageSize}`,
  userWishlists: (userId: string, page: number = 1, pageSize: number = 20) => `/api/wishlists/user/${userId}?page=${page}&pageSize=${pageSize}`,
  reservedGifts: '/api/gift/reserved',
  unreserveGift: (giftId: string) => `/api/Gift/${giftId}/unreserve`,
  // Events
  createEvent: '/api/events',
  myEvents: (page: number = 1, pageSize: number = 10) => `/api/events/my-events?page=${page}&pageSize=${pageSize}`,
  invitedEvents: (page: number = 1, pageSize: number = 10) => `/api/events/invited-events?page=${page}&pageSize=${pageSize}`,
  eventById: (id: string) => `/api/events/${id}`,
  updateEvent: (id: string) => `/api/events/${id}`,
  cancelEvent: (id: string) => `/api/events/${id}/cancel`,
  deleteEvent: (id: string) => `/api/events/${id}`,
  eventInvitations: (eventId: string) => `/api/events/${eventId}/invitations`,
  myInvitations: (page: number = 1, pageSize: number = 10) => `/api/events/my-invitations?page=${page}&pageSize=${pageSize}`,
  respondInvitation: (invitationId: string) => `/api/events/invitations/${invitationId}/respond`,
  // Chat endpoints
  chatHistory: (userId: string, peerUserId: string, page: number = 1, pageSize: number = 50) => 
    `/api/chat/history/${userId}/${peerUserId}?page=${page}&pageSize=${pageSize}`,
  searchUsers: (query: string, page: number = 1, pageSize: number = 10) => 
    `/api/users/search?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
  getFollowing: (userId: string, page: number = 1, pageSize: number = 50) => 
    `/api/users/${userId}/following?page=${page}&pageSize=${pageSize}`,
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
  // Notifications endpoints
  getNotifications: (page: number = 1, pageSize: number = 20) => `/api/Notifications?page=${page}&pageSize=${pageSize}`,
  markNotificationRead: '/api/Notifications/mark-read',
  markAllNotificationsRead: '/api/Notifications/mark-all-read',
  deleteNotification: (notificationId: string) => `/api/Notifications/${notificationId}`,
  // Birthday endpoints
  getUpcomingBirthdays: (daysAhead: number = 30) => `/api/notifications/birthdays?daysAhead=${daysAhead}`,
};

// Helper to use correct API client based on endpoint
export const getApiClient = (endpoint: string) => {
  // When using API Gateway, all endpoints go through the same base URL
  // So we can use any client (they all point to the same gateway)
  if (isUsingApiGateway) {
    // For API Gateway, we still route to the correct client for proper baseURL
    // But they all point to the same gateway URL anyway
    if (endpoint.startsWith('/api/auth') || endpoint.startsWith('/api/Auth')) {
      return api;
    } else if (endpoint.startsWith('/api/Users') || endpoint.startsWith('/api/users')) {
      return userApi;
    } else if (endpoint.startsWith('/api/Wishlists') || endpoint.startsWith('/api/wishlists') || endpoint.startsWith('/api/Gift') || endpoint.startsWith('/api/gift')) {
      return wishlistApi;
    } else if (endpoint.startsWith('/api/chat')) {
      return chatApi;
    } else if (endpoint.startsWith('/api/events')) {
      return userApi; // Events are handled by user service
    } else if (endpoint.startsWith('/api/notifications') || endpoint.startsWith('/api/Notifications')) {
      return userApi; // Notifications are handled by user service
    }
    return api; // default to api gateway
  }

  // When using local backend (microservices on different ports)
  if (endpoint.startsWith('/api/Auth') || endpoint.startsWith('/api/auth')) {
    return api;
  } else if (endpoint.startsWith('/api/Users') || endpoint.startsWith('/api/users')) {
    return userApi;
  } else if (endpoint.startsWith('/api/Wishlists') || endpoint.startsWith('/api/wishlists') || endpoint.startsWith('/api/Gift') || endpoint.startsWith('/api/gift')) {
    return wishlistApi;
  } else if (endpoint.startsWith('/api/chat')) {
    return chatApi;
  } else if (endpoint.startsWith('/api/events')) {
    return userApi; // Events are handled by user service
  } else if (endpoint.startsWith('/api/notifications') || endpoint.startsWith('/api/Notifications')) {
    return userApi; // Notifications are handled by user service
  }
  return api; // default
};


