import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiBaseUrl = (Constants.expoConfig?.extra as any)?.apiBaseUrl || 'http://localhost:5219';

export const api = axios.create({ baseURL: apiBaseUrl });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const endpoints = {
  login: '/api/login',
  register: '/api/registration',
  identification: '/api/identification',
  wishlistsFeed: '/api/Wishlists/feed', // casing based on WishlistApp
  wishlistById: (id: string) => `/api/Wishlists/${id}`,
  wishlistLike: (id: string) => `/api/Wishlists/${id}/like`,
  giftsForUser: '/api/Gift/wishlist',
};


