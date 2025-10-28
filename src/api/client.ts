import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Determine the correct localhost address based on the platform
const getBaseUrl = () => {
  // For iOS simulator use localhost, for Android emulator use 10.0.2.2
  // For physical devices, replace with your actual IP address
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2'; // Android emulator
    } else {
      return 'http://localhost'; // iOS simulator and web
    }
  }
  // In production, use your actual backend URL
  return 'https://your-production-url.com';
};

const baseUrl = getBaseUrl();

// Different services run on different ports
const authServiceUrl = `${baseUrl}:5219`;  // Auth service
const userServiceUrl = `${baseUrl}:5001`;  // User service
const wishlistServiceUrl = `${baseUrl}:5003`; // Gift/wishlist service
const chatServiceUrl = `${baseUrl}:5002`;  // Chat service

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
    console.error('Chat API Error:', error.message);
    console.error('Request URL:', error.config?.url);
    console.error('Response:', error.response?.data);
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
  login: '/api/Auth/login',
  register: '/api/Auth/register',
  identification: '/api/Users/profile', // Get current user profile
  wishlistsFeed: '/api/Wishlists/feed', // casing based on WishlistApp
  wishlistById: (id: string) => `/api/Wishlists/${id}`,
  wishlistLike: (id: string) => `/api/Wishlists/${id}/like`,
  giftsForUser: '/api/Gift/wishlist',
  // Chat endpoints
  chatHistory: (userId: string, peerUserId: string, page: number = 1, pageSize: number = 50) => 
    `/api/chat/history/${userId}/${peerUserId}?page=${page}&pageSize=${pageSize}`,
  searchUsers: (query: string, page: number = 1, pageSize: number = 10) => 
    `/api/users/search?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
  getFollowing: (userId: string, page: number = 1, pageSize: number = 50) => 
    `/api/users/${userId}/following?page=${page}&pageSize=${pageSize}`,
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


