import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, Text, FlatList, Image, RefreshControl, TouchableOpacity, ScrollView, Animated, Easing, Dimensions, StatusBar, TextInput, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { CreateWishlistModal } from '../components/CreateWishlistModal';
import { EditWishlistModal } from '../components/EditWishlistModal';
import { useAuthStore } from '../state/auth';
import { api, wishlistApi, userApi, endpoints } from '../api/client';

const { width, height } = Dimensions.get('window');

const CATEGORIES = ['All', 'Electronics', 'Books', 'Clothing', 'Home & Garden', 'Sports', 'Beauty', 'Toys', 'Food', 'Health', 'Other'];

// Mock data for development
const mockWishlists: WishlistItem[] = [
  {
    id: '1',
    title: 'My Birthday Wishlist 🎉',
    description: 'Things I would love for my birthday this year!',
    category: 'Birthday',
    isPublic: true,
    gifts: [
      { id: '1', name: 'AirPods Pro', price: 249 },
      { id: '2', name: 'Nike Air Max', price: 150 },
      { id: '3', name: 'Coffee Maker', price: 89 },
    ],
    likes: 12,
    isLiked: false,
    createdAt: '2024-01-15T10:30:00Z',
    user: {
      id: 'user1',
      name: 'Alex Johnson',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Alex',
      username: 'alexj',
    },
  },
  {
    id: '2',
    title: 'Holiday Gifts 🎄',
    description: 'Perfect gifts for the holiday season',
    category: 'Holiday',
    isPublic: true,
    gifts: [
      { id: '4', name: 'Wireless Headphones', price: 199 },
      { id: '5', name: 'Smart Watch', price: 299 },
    ],
    likes: 8,
    isLiked: true,
    createdAt: '2024-01-14T15:45:00Z',
    user: {
      id: 'user2',
      name: 'Sarah Wilson',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Sarah',
      username: 'sarahw',
    },
  },
];

type WishlistItem = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  isPublic?: boolean;
  gifts: Array<{
    id: string;
    name: string;
    price?: number;
    image?: string;
  }>;
  likes: number;
  isLiked: boolean;
  isBookmarked?: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatar: string;
    username: string;
  };
};

export const HomeScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(), [theme]);
  const [wishlists, setWishlists] = useState<WishlistItem[]>([]);
  const [likedWishlists, setLikedWishlists] = useState<WishlistItem[]>([]);
  const [myWishlists, setMyWishlists] = useState<WishlistItem[]>([]);
  const [gifts, setGifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredWishlists, setFilteredWishlists] = useState<WishlistItem[]>([]);
  const [activeTab, setActiveTab] = useState('home');
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWishlist, setEditingWishlist] = useState<WishlistItem | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('');
  const { user, logout } = useAuthStore();
  
  // Animation refs
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(50)).current;
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Floating background animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: 20,
          duration: 6000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: -20,
          duration: 6000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const fetchGiftsForWishlist = async (wishlistId: string): Promise<Array<any>> => {
    try {
      console.log(`[fetchGiftsForWishlist] Fetching gifts for wishlist ${wishlistId}`);
      
      // Try the specific gifts endpoint first
      try {
        const res = await wishlistApi.get(`/api/wishlists/${wishlistId}/gifts`);
        console.log(`[fetchGiftsForWishlist] Response for ${wishlistId}:`, res.data);
        const gifts = res.data || [];
        console.log(`[fetchGiftsForWishlist] Raw gifts array length:`, gifts.length);
        
        const mappedGifts = gifts.map((gift: any) => {
          const mapped = {
            id: gift.id || gift.giftId || `gift-${Math.random()}`,
            name: gift.name || gift.giftName || 'Unnamed Gift',
            price: gift.price || gift.priceAmount || 0,
            image: gift.imageUrl || gift.image || gift.imageUri || '',
          };
          console.log(`[fetchGiftsForWishlist] Mapped gift:`, mapped);
          return mapped;
        });
        
        console.log(`[fetchGiftsForWishlist] Mapped gifts count for ${wishlistId}:`, mappedGifts.length);
        return mappedGifts;
      } catch (giftsError: any) {
        // 404 is expected - the endpoint might not exist, so we'll fall back to wishlistById
        // Only log non-404 errors
        if (giftsError.response?.status !== 404) {
          console.log(`[fetchGiftsForWishlist] Gifts endpoint failed (${giftsError.response?.status}), trying wishlistById endpoint`);
        }
        
        // Fallback: try getting the full wishlist which might include gifts
        try {
          const wishlistRes = await wishlistApi.get(endpoints.wishlistById(wishlistId));
          console.log(`[fetchGiftsForWishlist] WishlistById response for ${wishlistId}:`, JSON.stringify(wishlistRes.data, null, 2));
          
          const wishlistData = wishlistRes.data || {};
          let gifts = [];
          
          // Check if gifts are in the response - try multiple possible structures
          if (Array.isArray(wishlistData.gifts)) {
            gifts = wishlistData.gifts;
            console.log(`[fetchGiftsForWishlist] Found gifts array with ${gifts.length} items`);
          } else if (wishlistData.gifts && typeof wishlistData.gifts === 'object') {
            // Try various nested structures
            gifts = wishlistData.gifts.items || 
                   wishlistData.gifts.data || 
                   wishlistData.gifts.gifts ||
                   (Array.isArray(wishlistData.gifts) ? wishlistData.gifts : []) ||
                   Object.values(wishlistData.gifts).find((val: any) => Array.isArray(val)) ||
                   [];
            console.log(`[fetchGiftsForWishlist] Found gifts object, extracted ${gifts.length} items`);
          } else if (wishlistData.items && Array.isArray(wishlistData.items)) {
            // Maybe gifts are in an items array
            gifts = wishlistData.items;
            console.log(`[fetchGiftsForWishlist] Found items array with ${gifts.length} items`);
          } else if (wishlistData.data && Array.isArray(wishlistData.data)) {
            // Maybe gifts are in a data array
            gifts = wishlistData.data;
            console.log(`[fetchGiftsForWishlist] Found data array with ${gifts.length} items`);
          }
          
          // Log the full response structure for debugging
          console.log(`[fetchGiftsForWishlist] Full wishlist data keys:`, Object.keys(wishlistData));
          console.log(`[fetchGiftsForWishlist] Extracted ${gifts.length} gifts from wishlistById response`);
          
          if (gifts.length === 0) {
            console.log(`[fetchGiftsForWishlist] No gifts found in wishlistById response. Full structure:`, JSON.stringify(wishlistData, null, 2));
          }
          
          const mappedGifts = gifts.map((gift: any, idx: number) => {
            console.log(`[fetchGiftsForWishlist] Processing gift ${idx + 1}:`, gift);
            const mapped = {
              id: gift.id || gift.giftId || `gift-${Math.random()}`,
              name: gift.name || gift.giftName || gift.title || 'Unnamed Gift',
              price: gift.price || gift.priceAmount || gift.cost || 0,
              image: gift.imageUrl || gift.image || gift.imageUri || gift.imageUrl || '',
            };
            console.log(`[fetchGiftsForWishlist] Mapped gift ${idx + 1}:`, mapped);
            return mapped;
          });
          
          console.log(`[fetchGiftsForWishlist] Returning ${mappedGifts.length} mapped gifts`);
          return mappedGifts;
        } catch (wishlistError: any) {
          console.log(`[fetchGiftsForWishlist] WishlistById endpoint also failed:`, wishlistError.message);
          console.log(`[fetchGiftsForWishlist] Error response:`, wishlistError.response?.data);
          return [];
        }
      }
    } catch (error: any) {
      // Only log non-404 errors
      if (error.response?.status !== 404) {
        console.log(`[fetchGiftsForWishlist] Error fetching gifts for wishlist ${wishlistId}:`, error.message);
        console.log(`[fetchGiftsForWishlist] Error response:`, error.response?.data);
        console.log(`[fetchGiftsForWishlist] Error status:`, error.response?.status);
      }
      return [];
    }
  };

  const fetchFeed = async () => {
    setLoading(true);
    try {
      console.log('[fetchFeed] Fetching feed from:', wishlistApi.defaults.baseURL + endpoints.wishlistsFeed);
      const res = await wishlistApi.get(endpoints.wishlistsFeed, { 
        params: { page: 1, pageSize: 20 } 
      });
      console.log('[fetchFeed] Feed response:', JSON.stringify(res.data, null, 2));
      const data = res.data || [];
      console.log('[fetchFeed] Feed data array length:', data.length);
      
      // Transform data to match our UI structure
      const transformedData: WishlistItem[] = await Promise.all(
        data.map(async (item: any, index: number) => {
          console.log(`[fetchFeed] Processing wishlist ${index + 1}/${data.length}:`, {
            id: item.id,
            title: item.title,
            hasGifts: !!item.gifts,
            giftsType: typeof item.gifts,
            giftsIsArray: Array.isArray(item.gifts),
            giftsKeys: item.gifts && typeof item.gifts === 'object' ? Object.keys(item.gifts) : null,
          });
          
          // Handle gifts - check if they're in the response first
          let gifts = [];
          if (Array.isArray(item.gifts)) {
            gifts = item.gifts;
            console.log(`[fetchFeed] Wishlist ${item.id} has gifts array with ${gifts.length} items`);
          } else if (item.gifts && typeof item.gifts === 'object') {
            // Try various nested structures
            gifts = item.gifts.items || 
                   item.gifts.data || 
                   item.gifts.gifts ||
                   Object.values(item.gifts).find((val: any) => Array.isArray(val)) ||
                   [];
            console.log(`[fetchFeed] Wishlist ${item.id} has gifts object, extracted ${gifts.length} items`);
          } else if (item.items && Array.isArray(item.items)) {
            // Maybe gifts are in an items array
            gifts = item.items;
            console.log(`[fetchFeed] Wishlist ${item.id} has items array with ${gifts.length} items`);
          } else if (item.data && Array.isArray(item.data)) {
            // Maybe gifts are in a data array
            gifts = item.data;
            console.log(`[fetchFeed] Wishlist ${item.id} has data array with ${gifts.length} items`);
          } else {
            console.log(`[fetchFeed] Wishlist ${item.id} has no gifts in response. Item keys:`, Object.keys(item));
          }
          
          // If no gifts in response, fetch them separately
          if (gifts.length === 0 && item.id) {
            console.log(`[fetchFeed] Fetching gifts separately for wishlist ${item.id}`);
            gifts = await fetchGiftsForWishlist(item.id);
            console.log(`[fetchFeed] Fetched ${gifts.length} gifts separately for wishlist ${item.id}`);
          } else {
            console.log(`[fetchFeed] Using ${gifts.length} gifts from feed response for wishlist ${item.id}`);
          }
          
          const transformedGifts = gifts.map((gift: any, idx: number) => {
            console.log(`[fetchFeed] Processing gift ${idx + 1} for wishlist ${item.id}:`, gift);
            const transformed = {
              id: gift.id || gift.giftId || `gift-${Math.random()}`,
              name: gift.name || gift.giftName || gift.title || 'Unnamed Gift',
              price: gift.price || gift.priceAmount || gift.cost || 0,
              image: gift.imageUrl || gift.image || gift.imageUri || '',
            };
            console.log(`[fetchFeed] Transformed gift ${idx + 1} for wishlist ${item.id}:`, transformed);
            return transformed;
          });
          
          const wishlistItem = {
            id: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            isPublic: item.isPublic,
            gifts: transformedGifts,
            likes: item.likeCount || item.likes || 0,
            isLiked: item.isLiked || false,
            createdAt: item.createdAt || item.createdAtDate,
            user: {
              id: item.userId || item.user?.id,
              name: item.username || item.user?.name || item.user?.username,
              avatar: item.avatarUrl || item.user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.username || item.user?.username || 'User')}`,
              username: item.username || item.user?.username || 'user',
            },
          };
          
          console.log(`[fetchFeed] Final wishlist item ${item.id}:`, {
            id: wishlistItem.id,
            title: wishlistItem.title,
            giftsCount: wishlistItem.gifts.length,
            gifts: wishlistItem.gifts.map((g: any) => ({ id: g.id, name: g.name, hasImage: !!g.image })),
          });
          
          return wishlistItem;
        })
      );
      
      console.log('[fetchFeed] Transformed wishlists summary:', transformedData.map(w => ({ 
        id: w.id, 
        title: w.title, 
        giftsCount: w.gifts?.length || 0,
        gifts: w.gifts?.map((g: any) => ({ id: g.id, name: g.name, hasImage: !!g.image })) || []
      })));
      
      const totalGifts = transformedData.reduce((sum, w) => sum + (w.gifts?.length || 0), 0);
      console.log(`[fetchFeed] Total wishlists: ${transformedData.length}, Total gifts: ${totalGifts}`);
      
      setWishlists(transformedData);
      setFilteredWishlists(transformedData);
    } catch (error: any) {
      console.log('[fetchFeed] Error fetching feed:', error.message);
      console.log('[fetchFeed] Error details:', error.response?.data || error);
      console.log('[fetchFeed] Error status:', error.response?.status);
      
      // Check if error is due to no auth token
      if (error.response?.status === 401) {
        console.log('[fetchFeed] Not authenticated, showing mock data');
      }
      
      // Use mock data for now
      console.log('[fetchFeed] Using mock wishlists with gifts:', mockWishlists.map(w => ({ id: w.id, title: w.title, giftsCount: w.gifts?.length || 0 })));
      setWishlists(mockWishlists);
      setFilteredWishlists(mockWishlists);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let result = wishlists;
    
    // Apply search filter
    if (searchQuery.trim()) {
      result = result.filter(w => 
        w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply category filter
    if (selectedCategory && selectedCategory !== 'All') {
      result = result.filter(w => w.category === selectedCategory);
    }
    
    // Apply sorting
    if (sortBy === 'likes') {
      result = [...result].sort((a, b) => b.likes - a.likes);
    } else if (sortBy === 'recent') {
      result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'title') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }
    
    setFilteredWishlists(result);
  }, [searchQuery, wishlists, selectedCategory, sortBy]);

  useEffect(() => {
    fetchFeed();
  }, []);

  // Load data based on active tab
  useEffect(() => {
    const loadTabData = async () => {
      try {
        setLoading(true);
        switch (activeTab) {
          case 'home':
            await fetchFeed();
            break;
          case 'liked':
            await fetchLikedWishlists();
            break;
          case 'my-wishlists':
            await fetchMyWishlists();
            break;
          case 'my-gifts':
            await fetchMyGifts();
            break;
        }
      } catch (error) {
        console.log('Error loading tab data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadTabData();
  }, [activeTab]);

  const fetchLikedWishlists = async () => {
    try {
      console.log('[fetchLikedWishlists] Fetching liked wishlists');
      const res = await wishlistApi.get(endpoints.likedWishlists(1, 20));
      const data = res.data || [];
      console.log('[fetchLikedWishlists] Response data length:', data.length);
      
      const transformedData: WishlistItem[] = await Promise.all(
        data.map(async (item: any) => {
          let gifts = [];
          if (Array.isArray(item.gifts)) {
            gifts = item.gifts;
          } else if (item.gifts && typeof item.gifts === 'object') {
            gifts = item.gifts.items || 
                   item.gifts.data || 
                   item.gifts.gifts ||
                   Object.values(item.gifts).find((val: any) => Array.isArray(val)) ||
                   [];
          } else if (item.items && Array.isArray(item.items)) {
            gifts = item.items;
          } else if (item.data && Array.isArray(item.data)) {
            gifts = item.data;
          }
          
          // If no gifts in response, fetch them separately
          if (gifts.length === 0 && item.id) {
            console.log(`[fetchLikedWishlists] Fetching gifts separately for wishlist ${item.id}`);
            gifts = await fetchGiftsForWishlist(item.id);
          }
          
          return {
            id: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            isPublic: item.isPublic,
            gifts: gifts.map((gift: any) => ({
              id: gift.id || gift.giftId || `gift-${Math.random()}`,
              name: gift.name || gift.giftName || gift.title || 'Unnamed Gift',
              price: gift.price || gift.priceAmount || gift.cost || 0,
              image: gift.imageUrl || gift.image || gift.imageUri || '',
            })),
            likes: item.likeCount || item.likes || 0,
            isLiked: item.isLiked || false,
            createdAt: item.createdAt || item.createdAtDate,
            user: {
              id: item.userId || item.user?.id,
              name: item.username || item.user?.name || item.user?.username,
              avatar: item.avatarUrl || item.user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.username || item.user?.username || 'User')}`,
              username: item.username || item.user?.username || 'user',
            },
          };
        })
      );
      
      console.log('[fetchLikedWishlists] Transformed wishlists with gifts:', transformedData.map(w => ({ id: w.id, title: w.title, giftsCount: w.gifts?.length || 0 })));
      setLikedWishlists(transformedData);
    } catch (error: any) {
      console.log('[fetchLikedWishlists] Error fetching liked wishlists:', error.message);
      console.log('[fetchLikedWishlists] Error response:', error.response?.data);
      setLikedWishlists([]);
    }
  };

  const fetchMyWishlists = async () => {
    try {
      console.log('[fetchMyWishlists] Fetching my wishlists for user:', user?.id);
      const res = await wishlistApi.get(endpoints.userWishlists(user?.id || '', 1, 20));
      const data = res.data || [];
      console.log('[fetchMyWishlists] Response data length:', data.length);
      
      const transformedData: WishlistItem[] = await Promise.all(
        data.map(async (item: any) => {
          let gifts = [];
          if (Array.isArray(item.gifts)) {
            gifts = item.gifts;
          } else if (item.gifts && typeof item.gifts === 'object') {
            gifts = item.gifts.items || 
                   item.gifts.data || 
                   item.gifts.gifts ||
                   Object.values(item.gifts).find((val: any) => Array.isArray(val)) ||
                   [];
          } else if (item.items && Array.isArray(item.items)) {
            gifts = item.items;
          } else if (item.data && Array.isArray(item.data)) {
            gifts = item.data;
          }
          
          // If no gifts in response, fetch them separately
          if (gifts.length === 0 && item.id) {
            console.log(`[fetchMyWishlists] Fetching gifts separately for wishlist ${item.id}`);
            gifts = await fetchGiftsForWishlist(item.id);
          }
          
          return {
            id: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            isPublic: item.isPublic,
            gifts: gifts.map((gift: any) => ({
              id: gift.id || gift.giftId || `gift-${Math.random()}`,
              name: gift.name || gift.giftName || gift.title || 'Unnamed Gift',
              price: gift.price || gift.priceAmount || gift.cost || 0,
              image: gift.imageUrl || gift.image || gift.imageUri || '',
            })),
            likes: item.likeCount || item.likes || 0,
            isLiked: item.isLiked || false,
            createdAt: item.createdAt || item.createdAtDate,
            user: {
              id: item.userId || item.user?.id,
              name: item.username || item.user?.name || item.user?.username,
              avatar: item.avatarUrl || item.user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.username || item.user?.username || 'User')}`,
              username: item.username || item.user?.username || 'user',
            },
          };
        })
      );
      
      console.log('[fetchMyWishlists] Transformed wishlists with gifts:', transformedData.map(w => ({ id: w.id, title: w.title, giftsCount: w.gifts?.length || 0 })));
      setMyWishlists(transformedData);
    } catch (error: any) {
      console.log('[fetchMyWishlists] Error fetching my wishlists:', error.message);
      console.log('[fetchMyWishlists] Error response:', error.response?.data);
      setMyWishlists([]);
    }
  };

  const fetchMyGifts = async () => {
    try {
      const res = await wishlistApi.get(endpoints.giftsForUser);
      setGifts(res.data || []);
    } catch (error) {
      console.log('Error fetching my gifts:', error);
      setGifts([]);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  }, []);

  const handleLike = async (wishlistId: string) => {
    try {
      const target = wishlists.find(w => w.id === wishlistId) || 
                     likedWishlists.find(w => w.id === wishlistId) ||
                     myWishlists.find(w => w.id === wishlistId);
      
      if (target?.isLiked) {
        // Unlike if already liked
        await wishlistApi.delete(endpoints.wishlistUnlike(wishlistId));
        setWishlists(prev => prev.map(w => 
          w.id === wishlistId 
            ? { ...w, isLiked: false, likes: Math.max(0, (w.likes || 0) - 1) }
            : w
        ));
        setLikedWishlists(prev => prev.map(w => 
          w.id === wishlistId 
            ? { ...w, isLiked: false, likes: Math.max(0, (w.likes || 0) - 1) }
            : w
        ));
        setMyWishlists(prev => prev.map(w => 
          w.id === wishlistId 
            ? { ...w, isLiked: false, likes: Math.max(0, (w.likes || 0) - 1) }
            : w
        ));
      } else {
        // Like if not liked
        await wishlistApi.post(endpoints.wishlistLike(wishlistId));
        setWishlists(prev => prev.map(w => 
          w.id === wishlistId 
            ? { ...w, isLiked: true, likes: (w.likes || 0) + 1 }
            : w
        ));
        setLikedWishlists(prev => prev.map(w => 
          w.id === wishlistId 
            ? { ...w, isLiked: true, likes: (w.likes || 0) + 1 }
            : w
        ));
        setMyWishlists(prev => prev.map(w => 
          w.id === wishlistId 
            ? { ...w, isLiked: true, likes: (w.likes || 0) + 1 }
            : w
        ));
      }
    } catch (err: any) {
      const msg = err?.response?.data || err?.message || '';
      // Treat "already liked" from backend as idempotent success
      if (typeof msg === 'string' && msg.toLowerCase().includes('already liked')) {
        setWishlists(prev => prev.map(w => 
          w.id === wishlistId 
            ? { ...w, isLiked: true, likes: w.isLiked ? w.likes : (w.likes || 0) + 1 }
            : w
        ));
        return;
      }
      console.log('Error liking/unliking wishlist:', err);
    }
  };

  const handleFollow = async (userId: string) => {
    try {
      await userApi.post(`/api/Users/follow/${userId}`);
      // Update wishlists to reflect follow status
      setWishlists(prev => prev.map(w => 
        w.user.id === userId ? { ...w, user: { ...w.user, isFollowing: true } } : w
      ));
    } catch (error) {
      console.log('Error following user:', error);
    }
  };

  const handleUnfollow = async (userId: string) => {
    try {
      await userApi.delete(`/api/Users/unfollow/${userId}`);
      setWishlists(prev => prev.map(w => 
        w.user.id === userId ? { ...w, user: { ...w.user, isFollowing: false } } : w
      ));
    } catch (error) {
      console.log('Error unfollowing user:', error);
    }
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case 'home':
        return filteredWishlists;
      case 'liked':
        return likedWishlists;
      case 'my-wishlists':
        return myWishlists;
      case 'my-gifts':
        return gifts.map(gift => ({
          id: gift.id,
          title: gift.name,
          description: `$${gift.price}`,
          category: gift.category,
          isPublic: true,
          gifts: [gift],
          likes: 0,
          isLiked: false,
          createdAt: new Date().toISOString(),
          user: {
            id: user?.id || '',
            name: user?.username || 'You',
            avatar: (user as any)?.avatar || '',
            username: user?.username || 'you',
          },
        }));
      default:
        return filteredWishlists;
    }
  };

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'home':
        return searchQuery ? t('home.emptySearch', 'No wishlists found') : t('home.empty', 'No wishlists yet');
      case 'liked':
        return t('home.emptyLiked', 'No liked wishlists yet');
      case 'my-wishlists':
        return t('home.emptyMyWishlists', "You haven't created any wishlists yet");
      case 'my-gifts':
        return t('home.emptyGifts', 'No gifts in your wishlist yet');
      default:
        return t('common.empty', 'No data available');
    }
  };

  const handleEditWishlist = (wishlist: WishlistItem) => {
    setEditingWishlist(wishlist);
    setShowEditModal(true);
  };

  const handleUpdateWishlist = async (data: any) => {
    if (!editingWishlist) return;
    
    try {
      setEditLoading(true);
      await wishlistApi.put(endpoints.wishlistUpdate(editingWishlist.id), {
        title: data.title,
        description: data.description || null,
        category: data.category,
        isPublic: data.isPublic,
      });
      
      // Update the wishlist in all relevant lists
      const updateWishlist = (w: WishlistItem) => 
        w.id === editingWishlist.id 
          ? { ...w, title: data.title, description: data.description, category: data.category, isPublic: data.isPublic }
          : w;
      
      setWishlists(prev => prev.map(updateWishlist));
      setLikedWishlists(prev => prev.map(updateWishlist));
      setMyWishlists(prev => prev.map(updateWishlist));
      
      setShowEditModal(false);
      setEditingWishlist(null);
    } catch (error) {
      console.log('Error updating wishlist:', error);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteWishlist = async (wishlist: WishlistItem) => {
    Alert.alert(
      'Delete Wishlist',
      `Are you sure you want to delete "${wishlist.title}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await wishlistApi.delete(endpoints.wishlistById(wishlist.id));
              
              // Remove from current data
              setWishlists(prev => prev.filter(w => w.id !== wishlist.id));
              setLikedWishlists(prev => prev.filter(w => w.id !== wishlist.id));
              setMyWishlists(prev => prev.filter(w => w.id !== wishlist.id));
              
              console.log('Wishlist deleted successfully');
            } catch (error) {
              console.log('Error deleting wishlist:', error);
              Alert.alert('Error', 'Failed to delete wishlist. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCreateWishlist = async (data: any) => {
    try {
      setCreateLoading(true);
      await wishlistApi.post('/api/wishlists', {
        title: data.title,
        description: data.description || null,
        category: data.category,
        isPublic: data.isPublic,
      });
      
      // Refresh the current tab data
      switch (activeTab) {
        case 'home':
          await fetchFeed();
          break;
        case 'my-wishlists':
          await fetchMyWishlists();
          break;
      }
      
      setShowCreateModal(false);
    } catch (error) {
      console.log('Error creating wishlist:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleBookmark = (wishlistId: string) => {
    setWishlists(prev => prev.map(w => 
      w.id === wishlistId ? { ...w, isBookmarked: !w.isBookmarked } : w
    ));
    setLikedWishlists(prev => prev.map(w => 
      w.id === wishlistId ? { ...w, isBookmarked: !w.isBookmarked } : w
    ));
    setMyWishlists(prev => prev.map(w => 
      w.id === wishlistId ? { ...w, isBookmarked: !w.isBookmarked } : w
    ));
    console.log('Bookmark toggled for wishlist:', wishlistId);
  };

  const renderWishlistCard = ({ item }: { item: WishlistItem }) => (
    <Animated.View
      style={[
        styles.wishlistCard,
        {
          opacity: fadeIn,
          transform: [{ translateY: slideUp }],
        },
      ]}
    >
      <View style={styles.cardTouchable}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('WishlistDetail', { id: item.id })}
          activeOpacity={0.9}
        >
          {/* Header with user info */}
          <View style={styles.cardHeader}>
            <View style={styles.userInfo}>
              <Image source={{ uri: item.user.avatar }} style={styles.userAvatar} />
              <View>
                <Text style={styles.userCardName}>{item.user.name}</Text>
                <Text style={styles.userHandle}>@{item.user.username}</Text>
              </View>
            </View>
          </View>

          {/* Wishlist content */}
          <View style={styles.cardContent}>
            <Text style={styles.wishlistTitle}>{item.title}</Text>
            {item.description && (
              <Text style={styles.wishlistDescription}>{item.description}</Text>
            )}
            
            {/* Gifts preview */}
            {(() => {
              const hasGifts = item.gifts && Array.isArray(item.gifts) && item.gifts.length > 0;
              console.log(`[renderWishlistCard] Wishlist ${item.id} - hasGifts:`, hasGifts, 'gifts count:', item.gifts?.length || 0);
              if (!hasGifts) {
                console.log(`[renderWishlistCard] Wishlist ${item.id} has no gifts, skipping preview`);
                return null;
              }
              console.log(`[renderWishlistCard] Rendering ${item.gifts.length} gifts for wishlist ${item.id}`);
              return (
                <View style={styles.giftsPreviewContainer}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.giftsPreviewScroll}
                    contentContainerStyle={styles.giftsPreviewContent}
                    nestedScrollEnabled={true}
                  >
                    {item.gifts.map((gift, index) => {
                      if (!gift || !gift.name) {
                        console.log(`[renderWishlistCard] Gift ${index} is invalid:`, gift);
                        return null;
                      }
                      console.log(`[renderWishlistCard] Rendering gift ${index + 1}/${item.gifts.length}:`, {
                        id: gift.id,
                        name: gift.name,
                        hasImage: !!gift.image,
                        image: gift.image,
                      });
                      return (
                        <View key={gift.id || `gift-${index}`} style={styles.giftPreviewCard}>
                          {/* Gift Image */}
                          <View style={styles.giftPreviewImageContainer}>
                            {gift.image ? (
                              <Image 
                                source={{ uri: gift.image }} 
                                style={styles.giftPreviewImage}
                                resizeMode="cover"
                                onError={(error) => {
                                  console.log(`[renderWishlistCard] Image load error for gift ${gift.id}:`, error.nativeEvent.error);
                                }}
                                onLoad={() => {
                                  console.log(`[renderWishlistCard] Image loaded successfully for gift ${gift.id}`);
                                }}
                              />
                            ) : (
                              <LinearGradient
                                colors={[colors.gradientStart + '40', colors.gradientMid + '30']}
                                style={styles.giftPreviewPlaceholder}
                              >
                                <Text style={styles.giftPreviewIcon}>🎁</Text>
                              </LinearGradient>
                            )}
                          </View>
                          
                          {/* Gift Info */}
                          <View style={styles.giftPreviewCardContent}>
                            <Text style={styles.giftPreviewName} numberOfLines={2}>
                              {gift.name || 'Unnamed Gift'}
                            </Text>
                            {(() => {
                              const price = gift.price;
                              if (price !== undefined && price !== null && !isNaN(Number(price))) {
                                return (
                                  <Text style={styles.giftPreviewPrice}>${Number(price).toFixed(2)}</Text>
                                );
                              }
                              return null;
                            })()}
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            })()}
          </View>
        </TouchableOpacity>

        {/* Card footer with actions - outside TouchableOpacity so buttons work */}
        <View style={styles.cardFooter}>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleLike(item.id)}
            >
              <Text style={[styles.actionIcon, item.isLiked && styles.likedIcon]}>
                {item.isLiked ? 'Liked' : 'Like'}
              </Text>
              <Text style={styles.actionText}>{item.likes || 0}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleBookmark(item.id)}
            >
              <Text style={styles.actionIcon}>
                {item.isBookmarked ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>
            
            {/* Edit/Delete buttons for own wishlists */}
            {item.user.id === user?.id && (
              <>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleEditWishlist(item)}
                >
                  <Text style={styles.actionIcon}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => {
                    console.log('Delete button pressed for wishlist:', item.id);
                    handleDeleteWishlist(item);
                  }}
                >
                  <Text style={[styles.actionIcon, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          
          <Text style={styles.timestamp}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </Animated.View>
  );

  const Header = useMemo(() => (
    <Animated.View 
      style={[
        styles.header,
        {
          opacity: fadeIn,
          transform: [{ translateY: slideUp }],
        },
      ]}
    >
      {/* Background blobs */}
      <View style={styles.blobContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.blob,
            styles.blob1,
            {
              transform: [{ translateY: floatY }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob2,
            {
              transform: [{ translateY: floatY.interpolate({ 
                inputRange: [-20, 20], 
                outputRange: [20, -20] 
              }) }],
            },
          ]}
        />
      </View>

      {/* Header content */}
      <View style={styles.headerContent}>
        <View style={styles.headerTop}>
          <View style={styles.userSection}>
            <Image 
              source={{ uri: (user as any)?.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=User' }} 
              style={styles.headerAvatar} 
            />
            <View>
              <Text style={styles.greeting}>{t('home.welcomeBack', 'Welcome back!')}</Text>
              <Text style={styles.userName}>{user?.username || 'User'}</Text>
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={() => console.log('Notifications')}>
              <Text style={styles.headerButtonIcon}>Icon</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => console.log('Messages')}>
              <Text style={styles.headerButtonIcon}>Icon</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔎</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t('home.searchPlaceholder', 'Search wishlists...')}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'home' && styles.activeTab]} 
              onPress={() => setActiveTab('home')}
            >
              <Text style={[styles.tabText, activeTab === 'home' && styles.activeTabText]}>{t('tabs.home', 'Home')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'my-wishlists' && styles.activeTab]} 
              onPress={() => setActiveTab('my-wishlists')}
            >
              <Text style={[styles.tabText, activeTab === 'my-wishlists' && styles.activeTabText]}>{t('tabs.myWishlists', 'My Wishlists')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'liked' && styles.activeTab]} 
              onPress={() => setActiveTab('liked')}
            >
              <Text style={[styles.tabText, activeTab === 'liked' && styles.activeTabText]}>{t('tabs.liked', 'Liked')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'my-gifts' && styles.activeTab]} 
              onPress={() => setActiveTab('my-gifts')}
            >
              <Text style={[styles.tabText, activeTab === 'my-gifts' && styles.activeTabText]}>{t('tabs.myGifts', 'My Gifts')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'profile' && styles.activeTab]} 
              onPress={() => setActiveTab('profile')}
            >
              <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>{t('tabs.profile', 'Profile')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Filter & Sort Controls */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[styles.filterChip, selectedCategory === category && styles.filterChipActive]}
                onPress={() => setSelectedCategory(category === selectedCategory ? '' : category)}
              >
                <Text style={[styles.filterChipText, selectedCategory === category && styles.filterChipTextActive]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <View style={styles.sortContainer}>
            <Text style={styles.sortLabel}>{t('home.sort', 'Sort:')}</Text>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'recent' && styles.sortButtonActive]}
              onPress={() => setSortBy(sortBy === 'recent' ? '' : 'recent')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'recent' && styles.sortButtonTextActive]}>{t('home.sortRecent', 'Recent')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'likes' && styles.sortButtonActive]}
              onPress={() => setSortBy(sortBy === 'likes' ? '' : 'likes')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'likes' && styles.sortButtonTextActive]}>{t('home.sortPopular', 'Popular')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'title' && styles.sortButtonActive]}
              onPress={() => setSortBy(sortBy === 'title' ? '' : 'title')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'title' && styles.sortButtonTextActive]}>{t('home.sortAZ', 'A-Z')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  ), [user, fadeIn, slideUp, floatY, activeTab, selectedCategory, sortBy]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <FlatList
        data={getCurrentData()}
        keyExtractor={(item) => item.id}
        renderItem={renderWishlistCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            tintColor={colors.primary} 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
          />
        }
        ListHeaderComponent={Header}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {getEmptyMessage()}
            </Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
          style={styles.fabGradient}
        >
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Create Wishlist Modal */}
      <CreateWishlistModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateWishlist}
        loading={createLoading}
      />

      {/* Edit Wishlist Modal */}
      <EditWishlistModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingWishlist(null);
        }}
        onSubmit={handleUpdateWishlist}
        wishlist={editingWishlist}
        loading={editLoading}
      />
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Header styles
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    position: 'relative',
  },
  blobContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.1,
  },
  blob1: {
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: colors.primary,
    top: -width * 0.1,
    right: -width * 0.1,
  },
  blob2: {
    width: width * 0.4,
    height: width * 0.4,
    backgroundColor: colors.accent,
    top: height * 0.1,
    left: -width * 0.1,
  },
  headerContent: {
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  greeting: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  userName: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerButtonIcon: {
    fontSize: 20,
  },
  searchContainer: {
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  searchInput: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '700',
  },

  // Tab Navigation styles
  tabContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  tabScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.muted,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: 'white',
  },

  // Filter & Sort styles
  filtersContainer: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  filterScrollContent: {
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: 'white',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginRight: 4,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.muted,
  },
  sortButtonActive: {
    backgroundColor: colors.primary,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  sortButtonTextActive: {
    color: 'white',
  },

  // List styles
  listContent: {
    paddingBottom: 100,
  },

  // Wishlist card styles
  wishlistCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  cardTouchable: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  userHandle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  cardContent: {
    marginBottom: 16,
  },
  wishlistTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  wishlistDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  giftsPreviewContainer: {
    marginTop: 16,
    marginBottom: 4,
    minHeight: 180,
  },
  giftsPreviewScroll: {
    flexGrow: 0,
    height: 180,
  },
  giftsPreviewContent: {
    paddingRight: 20,
    paddingLeft: 0,
    alignItems: 'center',
    minHeight: 180,
  },
  giftPreviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginRight: 12,
    width: 140,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  giftPreviewImageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: colors.muted,
  },
  giftPreviewImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.muted,
  },
  giftPreviewPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  giftPreviewIcon: {
    fontSize: 40,
  },
  giftPreviewCardContent: {
    padding: 12,
  },
  giftPreviewName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    lineHeight: 18,
  },
  giftPreviewPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  likedIcon: {
    color: colors.danger,
    fontWeight: '600',
  },
  actionText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 12,
    color: colors.textMuted,
  },

  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabIcon: {
    fontSize: 24,
    color: 'white',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});