import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, Text, FlatList, Image, RefreshControl, TouchableOpacity, ScrollView, Animated, Easing, Dimensions, StatusBar, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { CreateWishlistModal } from '../components/CreateWishlistModal';
import { SafeImage } from '../components/SafeImage';
import { BirthdayCalendar } from '../components/BirthdayCalendar';
import { BirthdayCountdownBanner } from '../components/BirthdayCountdownBanner';
import { CalendarIcon, SearchIcon, CloseIcon } from '../components/Icon';
import { useAuthStore } from '../state/auth';
import { api, wishlistApi, userApi, endpoints } from '../api/client';

const { width, height } = Dimensions.get('window');

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
    imageUrl?: string;
    description?: string;
    category?: string;
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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredWishlists, setFilteredWishlists] = useState<WishlistItem[]>([]);
  const [activeTab, setActiveTab] = useState('home');
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [showBirthdayNotification, setShowBirthdayNotification] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const { user, logout } = useAuthStore();
  
  // Animation refs
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(50)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const calendarSlideAnim = useRef(new Animated.Value(width)).current;

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

  const fetchFeed = async () => {
    setLoading(true);
    try {
      console.log('Fetching feed from:', wishlistApi.defaults.baseURL + endpoints.wishlistsFeed);
      const res = await wishlistApi.get(endpoints.wishlistsFeed, { 
        params: { page: 1, pageSize: 20 } 
      });
      console.log('Feed response:', res.data);
      console.log('Feed response type:', typeof res.data);
      console.log('Feed response is array:', Array.isArray(res.data));
      
      // Handle different response formats
      let data: any[] = [];
      if (Array.isArray(res.data)) {
        data = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        // Paginated response
        data = res.data.data;
      } else if (res.data && res.data.items && Array.isArray(res.data.items)) {
        // Alternative paginated format
        data = res.data.items;
      } else if (res.data && typeof res.data === 'object') {
        // Try to extract array from object
        const keys = Object.keys(res.data);
        const arrayKey = keys.find(key => Array.isArray(res.data[key]));
        if (arrayKey) {
          data = res.data[arrayKey];
        }
      }
      
      console.log('Extracted data:', data);
      console.log('Data length:', data.length);
      
      // Transform data to match our UI structure
      const transformedData = data
        .map((item: any): WishlistItem | null => {
          if (!item || !item.id) {
            console.warn('Invalid wishlist item:', item);
            return null;
          }
          // Log gift data for debugging
          console.log(`Wishlist ${item.id} - Raw gifts:`, item.gifts);
          console.log(`Wishlist ${item.id} - Raw items:`, item.items);
          console.log(`Wishlist ${item.id} - Gifts array?:`, Array.isArray(item.gifts));
          console.log(`Wishlist ${item.id} - Items array?:`, Array.isArray(item.items));
          console.log(`Wishlist ${item.id} - Gifts length:`, item.gifts?.length || 0);
          console.log(`Wishlist ${item.id} - Items length:`, item.items?.length || 0);
          
          // Check both gifts and items (backend may use either)
          const giftSource = item.gifts || item.items || [];
          const transformedGifts = giftSource.map((gift: any, idx: number) => {
            const transformed = {
              id: gift.giftId || gift.id || `gift-${idx}`,
              name: gift.title || gift.name || gift.name || 'Unnamed Gift',
              price: gift.price,
              imageUrl: gift.imageUrl || gift.image || gift.imageUrl,
              description: gift.description,
              category: gift.category,
            };
            console.log(`  Gift ${idx}:`, transformed);
            return transformed;
          }).filter((gift: any) => gift.name && gift.name !== 'Unnamed Gift' || gift.id);
          
          console.log(`Wishlist ${item.id} - Transformed gifts:`, transformedGifts);
          console.log(`Wishlist ${item.id} - Transformed gifts length:`, transformedGifts.length);
          
          const result: WishlistItem = {
            id: item.id,
            title: item.title || 'Untitled Wishlist',
            isPublic: item.isPublic !== undefined ? item.isPublic : true,
            gifts: transformedGifts,
            likes: item.likeCount || item.likes || 0,
            isLiked: item.isLiked || false,
            createdAt: item.createdAt || new Date().toISOString(),
            user: {
              id: item.userId || item.user?.id || '',
              name: item.username || item.user?.username || item.user?.name || 'Unknown',
              avatar: item.avatarUrl || item.user?.avatarUrl || item.user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.username || item.user?.username || 'User')}`,
              username: item.username || item.user?.username || 'unknown',
            },
          };
          if (item.description) {
            result.description = item.description;
          }
          if (item.category) {
            result.category = item.category;
          }
          console.log(`Wishlist ${item.id} - Final result gifts:`, result.gifts);
          return result;
        })
        .filter((item): item is WishlistItem => item !== null);
      
      console.log('Transformed data length:', transformedData.length);
      setWishlists(transformedData);
      setFilteredWishlists(transformedData);
    } catch (error: any) {
      console.error('Error fetching feed:', error.message);
      console.error('Error details:', error.response?.data || error);
      console.error('Error status:', error.response?.status);
      console.error('Error headers:', error.response?.headers);
      // Clear data on error (no mock fallbacks)
      setWishlists([]);
      setFilteredWishlists([]);
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
    
    setFilteredWishlists(result);
  }, [searchQuery, wishlists]);

  // Hydrate wishlists with gifts if missing
  useEffect(() => {
    if (!user?.id || wishlists.length === 0) return;

    const hydrateItems = async () => {
      const wishlistsToHydrate = wishlists.filter(w => !w.gifts || w.gifts.length === 0);
      
      if (wishlistsToHydrate.length === 0) return;

      console.log(`[HomeScreen] Hydrating ${wishlistsToHydrate.length} wishlists with missing gifts`);
      
      for (const w of wishlistsToHydrate) {
        try {
          console.log(`[HomeScreen] Fetching detailed wishlist for ${w.id}`);
          const res = await wishlistApi.get(endpoints.wishlistById(w.id));
          const detailedWishlist = res.data;
          
          // Extract gifts from detailed response (check both gifts and items)
          const gifts = detailedWishlist.gifts || detailedWishlist.items || [];
          const transformedGifts = gifts.map((gift: any, idx: number) => ({
            id: gift.giftId || gift.id || `gift-${idx}`,
            name: gift.title || gift.name || 'Unnamed Gift',
            price: gift.price,
            imageUrl: gift.imageUrl || gift.image,
            description: gift.description,
            category: gift.category,
          })).filter((gift: any) => gift.name && gift.name !== 'Unnamed Gift' || gift.id);
          
          console.log(`[HomeScreen] Hydrated wishlist ${w.id} with ${transformedGifts.length} gifts`);
          
          // Update the wishlist in state
          setWishlists(prev => prev.map(wishlist => 
            wishlist.id === w.id 
              ? { ...wishlist, gifts: transformedGifts }
              : wishlist
          ));
        } catch (error: any) {
          console.error(`[HomeScreen] Error hydrating wishlist ${w.id}:`, error.message);
        }
      }
    };

    hydrateItems();
  }, [wishlists, user?.id]);

  // Hydrate liked wishlists with gifts if missing
  useEffect(() => {
    if (!user?.id || likedWishlists.length === 0) return;

    const hydrateLikedItems = async () => {
      const wishlistsToHydrate = likedWishlists.filter(w => !w.gifts || w.gifts.length === 0);
      
      if (wishlistsToHydrate.length === 0) return;

      console.log(`[HomeScreen] Hydrating ${wishlistsToHydrate.length} liked wishlists with missing gifts`);
      
      for (const w of wishlistsToHydrate) {
        try {
          console.log(`[HomeScreen] Fetching detailed liked wishlist for ${w.id}`);
          const res = await wishlistApi.get(endpoints.wishlistById(w.id));
          const detailedWishlist = res.data;
          
          // Extract gifts from detailed response (check both gifts and items)
          const gifts = detailedWishlist.gifts || detailedWishlist.items || [];
          const transformedGifts = gifts.map((gift: any, idx: number) => ({
            id: gift.giftId || gift.id || `gift-${idx}`,
            name: gift.title || gift.name || 'Unnamed Gift',
            price: gift.price,
            imageUrl: gift.imageUrl || gift.image,
            description: gift.description,
            category: gift.category,
          })).filter((gift: any) => gift.name && gift.name !== 'Unnamed Gift' || gift.id);
          
          console.log(`[HomeScreen] Hydrated liked wishlist ${w.id} with ${transformedGifts.length} gifts`);
          
          // Update the liked wishlist in state
          setLikedWishlists(prev => prev.map(wishlist => 
            wishlist.id === w.id 
              ? { ...wishlist, gifts: transformedGifts }
              : wishlist
          ));
        } catch (error: any) {
          console.error(`[HomeScreen] Error hydrating liked wishlist ${w.id}:`, error.message);
        }
      }
    };

    hydrateLikedItems();
  }, [likedWishlists, user?.id]);

  useEffect(() => {
    // Only fetch feed if user is authenticated
    if (user?.id) {
      console.log('User authenticated, fetching feed...');
      fetchFeed();
    } else {
      console.log('User not authenticated, skipping feed fetch');
      setWishlists([]);
      setFilteredWishlists([]);
    }
  }, [user?.id]);

  // Search users when search query changes
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length >= 2) {
        setSearchingUsers(true);
        try {
          const response = await userApi.get(endpoints.searchUsers(searchQuery, 1, 10));
          setSuggestedUsers(response.data || []);
          setShowSearchDropdown(true);
        } catch (error: any) {
          console.log('Error searching users:', error.message);
          setSuggestedUsers([]);
        } finally {
          setSearchingUsers(false);
        }
      } else {
        setSuggestedUsers([]);
        setShowSearchDropdown(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(() => {
      searchUsers();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Load data based on active tab
  useEffect(() => {
    // Only load data if user is authenticated
    if (!user?.id) {
      console.log('User not authenticated, skipping tab data load');
      return;
    }
    
    const loadTabData = async () => {
      try {
        setLoading(true);
        console.log('Loading tab data for:', activeTab);
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
        }
      } catch (error) {
        console.error('Error loading tab data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadTabData();
  }, [activeTab, user?.id]);

  const fetchLikedWishlists = async () => {
    try {
      console.log('Fetching liked wishlists from:', wishlistApi.defaults.baseURL + endpoints.likedWishlists(1, 50));
      const res = await wishlistApi.get(endpoints.likedWishlists(1, 50));
      console.log('Liked wishlists response:', res.data);
      
      // Handle different response formats
      let data: any[] = [];
      if (Array.isArray(res.data)) {
        data = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        data = res.data.data;
      } else if (res.data && res.data.items && Array.isArray(res.data.items)) {
        data = res.data.items;
      }
      
      const transformedData = data
        .map((item: any): WishlistItem | null => {
          if (!item || !item.id) {
            console.warn('Invalid liked wishlist item:', item);
            return null;
          }
          // Transform gifts for liked wishlists (check both gifts and items)
          const giftSource = item.gifts || item.items || [];
          const transformedGifts = giftSource.map((gift: any, idx: number) => ({
            id: gift.giftId || gift.id || `gift-${idx}`,
            name: gift.title || gift.name || 'Unnamed Gift',
            price: gift.price,
            imageUrl: gift.imageUrl || gift.image,
            description: gift.description,
            category: gift.category,
          })).filter((gift: any) => gift.name || gift.id);
          
          const result: WishlistItem = {
            id: item.id,
            title: item.title || 'Untitled Wishlist',
            isPublic: item.isPublic !== undefined ? item.isPublic : true,
            gifts: transformedGifts,
            likes: item.likeCount || item.likes || 0,
            isLiked: item.isLiked || true,
            createdAt: item.createdAt || new Date().toISOString(),
            user: {
              id: item.userId || item.user?.id || '',
              name: item.username || item.user?.username || item.user?.name || 'Unknown',
              avatar: item.avatarUrl || item.user?.avatarUrl || item.user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.username || item.user?.username || 'User')}`,
              username: item.username || item.user?.username || 'unknown',
            },
          };
          if (item.description) {
            result.description = item.description;
          }
          if (item.category) {
            result.category = item.category;
          }
          return result;
        })
        .filter((item): item is WishlistItem => item !== null);
      
      console.log('Transformed liked wishlists length:', transformedData.length);
      setLikedWishlists(transformedData);
    } catch (error: any) {
      console.error('Error fetching liked wishlists:', error.message);
      console.error('Error details:', error.response?.data || error);
      setLikedWishlists([]);
    }
  };

  const fetchMyWishlists = async () => {
    if (!user?.id) {
      console.log('No user ID, skipping fetchMyWishlists');
      setMyWishlists([]);
      return;
    }
    
    try {
      console.log('Fetching my wishlists from:', wishlistApi.defaults.baseURL + endpoints.userWishlists(String(user.id), 1, 50));
      const res = await wishlistApi.get(endpoints.userWishlists(String(user.id), 1, 50));
      console.log('My wishlists response:', res.data);
      
      // Handle different response formats
      let data: any[] = [];
      if (Array.isArray(res.data)) {
        data = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        data = res.data.data;
      } else if (res.data && res.data.items && Array.isArray(res.data.items)) {
        data = res.data.items;
      }
      
      const transformedData = data
        .map((item: any): WishlistItem | null => {
          if (!item || !item.id) {
            console.warn('Invalid my wishlist item:', item);
            return null;
          }
          // Transform gifts for my wishlists (check both gifts and items)
          const giftSource = item.gifts || item.items || [];
          const transformedGifts = giftSource.map((gift: any, idx: number) => ({
            id: gift.giftId || gift.id || `gift-${idx}`,
            name: gift.title || gift.name || 'Unnamed Gift',
            price: gift.price,
            imageUrl: gift.imageUrl || gift.image,
            description: gift.description,
            category: gift.category,
          })).filter((gift: any) => gift.name || gift.id);
          
          const result: WishlistItem = {
            id: item.id,
            title: item.title || 'Untitled Wishlist',
            isPublic: item.isPublic !== undefined ? item.isPublic : true,
            gifts: transformedGifts,
            likes: item.likeCount || item.likes || 0,
            isLiked: item.isLiked || false,
            createdAt: item.createdAt || new Date().toISOString(),
            user: {
              id: item.userId || user.id,
              name: item.username || user.username || 'You',
              avatar: item.avatarUrl || item.user?.avatarUrl || item.user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.username || 'User')}`,
              username: item.username || user.username || 'you',
            },
          };
          if (item.description) {
            result.description = item.description;
          }
          if (item.category) {
            result.category = item.category;
          }
          return result;
        })
        .filter((item): item is WishlistItem => item !== null);
      
      console.log('Transformed my wishlists length:', transformedData.length);
      setMyWishlists(transformedData);
    } catch (error: any) {
      console.error('Error fetching my wishlists:', error.message);
      console.error('Error details:', error.response?.data || error);
      setMyWishlists([]);
    }
  };


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  }, []);

  const handleLike = async (wishlistId: string) => {
    try {
      // If already liked, do nothing (server only supports like, not unlike)
      const target = wishlists.find(w => w.id === wishlistId);
      if (target?.isLiked) return;

      await wishlistApi.post(endpoints.wishlistLike(wishlistId));
      setWishlists(prev => prev.map(w => 
        w.id === wishlistId 
          ? { ...w, isLiked: true, likes: (w.likes || 0) + 1 }
          : w
      ));
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
      console.log('Error liking wishlist:', err);
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
    let data: WishlistItem[] = [];
    switch (activeTab) {
      case 'home':
        data = filteredWishlists;
        break;
      case 'liked':
        data = likedWishlists;
        break;
      case 'my-wishlists':
        data = myWishlists;
        break;
      default:
        data = filteredWishlists;
    }
    console.log(`getCurrentData for tab "${activeTab}":`, data.length, 'items');
    return data;
  };

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'home':
        return searchQuery ? t('home.emptySearch', 'No wishlists found') : t('home.empty', 'No wishlists yet');
      case 'liked':
        return t('home.emptyLiked', 'No liked wishlists yet');
      case 'my-wishlists':
        return t('home.emptyMyWishlists', "You haven't created any wishlists yet");
      default:
        return t('common.empty', 'No data available');
    }
  };

  const handleEditWishlist = (wishlist: WishlistItem) => {
    // TODO: Implement edit wishlist modal
    console.log('Edit wishlist:', wishlist.id);
  };

  const handleDeleteWishlist = async (wishlist: WishlistItem) => {
    try {
      await wishlistApi.delete(`/api/Wishlists/${wishlist.id}`);
      
      // Remove from current data
      setWishlists(prev => prev.filter(w => w.id !== wishlist.id));
      setLikedWishlists(prev => prev.filter(w => w.id !== wishlist.id));
      setMyWishlists(prev => prev.filter(w => w.id !== wishlist.id));
      
      console.log('Wishlist deleted successfully');
    } catch (error) {
      console.log('Error deleting wishlist:', error);
    }
  };

  const handleCreateWishlist = async (data: any) => {
    try {
      setCreateLoading(true);
      await wishlistApi.post('/api/Wishlists', {
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

  const renderWishlistCard = React.useCallback(({ item }: { item: WishlistItem }) => (
    <Animated.View
      style={[
        styles.wishlistCard,
        {
          opacity: fadeIn,
          transform: [{ translateY: slideUp }],
        },
      ]}
    >
      <TouchableOpacity 
        onPress={() => navigation.navigate('WishlistDetail', { id: item.id })}
        style={styles.cardTouchable}
      >
        {/* Header with user info */}
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <SafeImage 
              source={{ uri: item.user.avatar }} 
              style={styles.userAvatar}
              fallbackUri={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.user.username || 'User')}`}
              placeholder={item.user.username?.charAt(0).toUpperCase() || 'U'}
            />
            <View>
              <Text style={styles.userName}>{item.user.name}</Text>
              <Text style={styles.userHandle}>@{item.user.username}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.moreButton}>
              <Text style={styles.moreText}>...</Text>
          </TouchableOpacity>
        </View>

        {/* Wishlist content */}
        <TouchableOpacity 
          style={styles.cardContent}
          onPress={() => navigation.navigate('WishlistDetail', { 
            wishlistId: item.id, 
            wishlistTitle: item.title 
          })}
        >
          <Text style={styles.wishlistTitle}>{item.title}</Text>
          {item.description && (
            <Text style={styles.wishlistDescription}>{item.description}</Text>
          )}
          
          {/* Gifts preview with photos, names, prices, and descriptions */}
          {(() => {
            console.log(`Rendering wishlist ${item.id} - Gifts:`, item.gifts);
            console.log(`  - Is array?:`, Array.isArray(item.gifts));
            console.log(`  - Length:`, item.gifts?.length || 0);
            console.log(`  - Has gifts?:`, item.gifts && item.gifts.length > 0);
            
            if (!item.gifts || !Array.isArray(item.gifts) || item.gifts.length === 0) {
              console.log(`  - Not rendering gifts for wishlist ${item.id}`);
              return null;
            }
            
            const visibleGifts = item.gifts.slice(0, 3).filter((gift: any) => gift && (gift.id || gift.name));
            console.log(`  - Visible gifts:`, visibleGifts.length);
            
            return (
              <View style={styles.giftsPreview}>
                {visibleGifts.map((gift: any, index: number) => {
                  const giftKey = gift.id || `gift-${index}`;
                  const giftName = gift.name || gift.title || 'Gift';
                  const firstLetter = giftName.charAt(0).toUpperCase();
                  
                  return (
                    <View key={giftKey} style={styles.giftItem}>
                      {/* Gift Image */}
                      {gift.imageUrl && gift.imageUrl.trim() ? (
                        <SafeImage 
                          source={{ uri: gift.imageUrl }} 
                          style={styles.giftImage}
                          resizeMode="cover"
                          placeholder={firstLetter}
                        />
                      ) : (
                        <View style={styles.giftImagePlaceholder}>
                          <Text style={styles.giftImagePlaceholderText}>
                            {firstLetter}
                          </Text>
                        </View>
                      )}
                      
                      {/* Gift Info */}
                      <View style={styles.giftInfo}>
                        <Text style={styles.giftName} numberOfLines={1}>
                          {giftName}
                        </Text>
                        {gift.price !== undefined && gift.price !== null && gift.price !== '' && (
                          <Text style={styles.giftPrice}>
                            ${typeof gift.price === 'number' ? gift.price.toFixed(2) : String(gift.price)}
                          </Text>
                        )}
                        {gift.description && gift.description.trim() && (
                          <Text style={styles.giftDescription} numberOfLines={2}>
                            {gift.description}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
                {item.gifts.length > 3 && (
                  <View style={styles.moreGifts}>
                    <Text style={styles.moreGiftsText}>+{item.gifts.length - 3} more</Text>
                  </View>
                )}
              </View>
            );
          })()}
        </TouchableOpacity>

        {/* Card footer with actions */}
        <View style={styles.cardFooter}>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleLike(item.id)}
            >
              <Text style={[styles.actionIcon, item.isLiked && styles.likedIcon]}>
                {item.isLiked ? 'Liked' : 'Like'}
              </Text>
              <Text style={styles.actionText}>{item.likes}</Text>
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
                  onPress={() => handleDeleteWishlist(item)}
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
      </TouchableOpacity>
    </Animated.View>
  ), [navigation, user, fadeIn, slideUp, handleLike, handleBookmark, handleEditWishlist, handleDeleteWishlist]);

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
            <SafeImage 
              source={{ uri: user?.avatar || user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.username || 'User')}` }} 
              style={styles.headerAvatar}
              placeholder={user?.username?.charAt(0).toUpperCase() || 'U'}
              fallbackUri={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.username || 'User')}`}
            />
            <View>
              <Text style={styles.greeting}>{t('home.welcomeBack', 'Welcome back!')}</Text>
              <Text style={styles.headerUserName}>{user?.username || 'User'}</Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => {
              setShowCalendar(true);
              Animated.spring(calendarSlideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
              }).start();
            }}
            style={styles.calendarButton}
          >
            <CalendarIcon size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <SearchIcon size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('home.searchPlaceholder', 'Search wishlists or users...')}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text.trim().length >= 2) {
                  setShowSearchDropdown(true);
                } else {
                  setShowSearchDropdown(false);
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => {
                if (suggestedUsers.length > 0 && searchQuery.trim().length >= 2) {
                  setShowSearchDropdown(true);
                }
              }}
              onBlur={() => {
                // Delay closing to allow tap on suggestion
                setTimeout(() => setShowSearchDropdown(false), 200);
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchQuery('');
                setSuggestedUsers([]);
                setShowSearchDropdown(false);
              }} style={styles.clearButton}>
                <CloseIcon size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          
          {/* User Search Suggestions Dropdown */}
          {showSearchDropdown && suggestedUsers.length > 0 && searchQuery.trim().length >= 2 && (
            <View style={styles.searchDropdown}>
              <ScrollView 
                style={styles.searchDropdownScroll}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {suggestedUsers.map((user: any) => (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.searchSuggestionItem}
                    onPress={() => {
                      setSearchQuery('');
                      setSuggestedUsers([]);
                      setShowSearchDropdown(false);
                      // Navigate to user profile
                      navigation.navigate('UserProfile', { userId: user.id });
                    }}
                  >
                    <SafeImage 
                      source={{ uri: user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.username || '')}` }} 
                      style={styles.searchSuggestionAvatar}
                      fallbackUri={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.username || '')}`}
                      placeholder={user.username?.charAt(0).toUpperCase() || 'U'}
                    />
                    <View style={styles.searchSuggestionInfo}>
                      <Text style={styles.searchSuggestionUsername}>@{user.username || 'Unknown'}</Text>
                      {user.name && user.name !== user.username && (
                        <Text style={styles.searchSuggestionName}>{user.name}</Text>
                      )}
                    </View>
                    {user.isFollowing && (
                      <Text style={styles.searchSuggestionFollowing}>Following</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
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
          </ScrollView>
        </View>

      </View>
    </Animated.View>
  ), [user, fadeIn, slideUp, floatY, activeTab, theme, searchQuery, t, showBirthdayNotification, navigation, calendarSlideAnim]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      <FlatList
        data={getCurrentData()}
        keyExtractor={(item) => item.id}
        renderItem={renderWishlistCard}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        initialNumToRender={10}
        contentContainerStyle={[
          styles.listContent,
          loading && getCurrentData().length === 0 && { justifyContent: 'center', flex: 1 }
        ]}
        refreshControl={
          <RefreshControl 
            tintColor={colors.primary} 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
          />
        }
        ListHeaderComponent={() => (
          <>
            {Header}
            {/* Birthday Countdown Banner - only show on Home tab */}
            {activeTab === 'home' && showBirthdayNotification && (
              <BirthdayCountdownBanner 
                onClose={() => setShowBirthdayNotification(false)}
                onUserPress={(userId) => navigation.navigate('UserProfile', { userId })}
              />
            )}
          </>
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading && getCurrentData().length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading wishlists...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {getEmptyMessage()}
              </Text>
              {!loading && (
                <Text style={styles.emptySubtext}>
                  Pull down to refresh or create a new wishlist
                </Text>
              )}
            </View>
          )
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

      {/* Birthday Calendar Slide-out Panel */}
      {showCalendar && (
        <>
          {/* Backdrop */}
          <TouchableOpacity
            style={styles.calendarBackdrop}
            activeOpacity={1}
            onPress={() => {
              Animated.spring(calendarSlideAnim, {
                toValue: width,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
              }).start(() => {
                setShowCalendar(false);
              });
            }}
          />
          {/* Slide-out Panel */}
          <Animated.View
            style={[
              styles.calendarPanel,
              {
                transform: [{ translateX: calendarSlideAnim }],
              },
            ]}
          >
            <View style={styles.calendarPanelHeader}>
              <Text style={styles.calendarPanelTitle}>{t('calendar.title', 'Birthday Calendar')}</Text>
              <TouchableOpacity
                onPress={() => {
                  Animated.spring(calendarSlideAnim, {
                    toValue: width,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 8,
                  }).start(() => {
                    setShowCalendar(false);
                  });
                }}
                style={styles.calendarCloseButton}
              >
                <CloseIcon size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.calendarPanelContent} showsVerticalScrollIndicator={false}>
              <BirthdayCalendar />
            </ScrollView>
          </Animated.View>
        </>
      )}
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
  calendarButton: {
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
  headerUserName: {
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
    position: 'relative',
    zIndex: 100,
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
    gap: 8,
  },
  searchInput: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  clearButton: {
    padding: 4,
  },
  searchDropdown: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    maxHeight: 300,
    backgroundColor: colors.surface,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: colors.muted,
    marginTop: 4,
  },
  searchDropdownScroll: {
    maxHeight: 300,
  },
  searchSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  searchSuggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: colors.muted,
  },
  searchSuggestionInfo: {
    flex: 1,
  },
  searchSuggestionUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  searchSuggestionName: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  searchSuggestionFollowing: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
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
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  userHandle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  moreButton: {
    padding: 8,
  },
  moreText: {
    fontSize: 20,
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
  giftsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  giftItem: {
    width: (width - 64) / 3 - 8, // 3 items per row with margins
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 4,
  },
  giftImage: {
    width: '100%',
    height: 100,
    backgroundColor: colors.muted,
  },
  giftImagePlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  giftImagePlaceholderText: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  giftInfo: {
    padding: 8,
  },
  giftName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  giftPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  giftDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  moreGifts: {
    width: (width - 64) / 3 - 8,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  moreGiftsText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
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
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Calendar Slide-out Panel
  calendarBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  calendarPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: width * 0.85,
    maxWidth: 400,
    backgroundColor: colors.background,
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  calendarPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
    backgroundColor: colors.surface,
  },
  calendarPanelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  calendarCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarPanelContent: {
    flex: 1,
    paddingTop: 16,
  },
});