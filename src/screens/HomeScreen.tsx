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
import { CreateChoiceModal } from '../components/CreateChoiceModal';
import { GiftModal } from '../components/GiftModal';
import { EventModal } from '../components/EventModal';
import { useAuthStore } from '../state/auth';
import { api, wishlistApi, userApi, endpoints, getApiClient } from '../api/client';

const { width, height } = Dimensions.get('window');

const CATEGORIES = ['All', 'Electronics', 'Books', 'Clothing', 'Home & Garden', 'Sports', 'Beauty', 'Toys', 'Food', 'Health', 'Other'];

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
  const [gifts, setGifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredWishlists, setFilteredWishlists] = useState<WishlistItem[]>([]);
  const [activeTab, setActiveTab] = useState('home');
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showCreateChoiceModal, setShowCreateChoiceModal] = useState(false);
  const [showCreateWishlistModal, setShowCreateWishlistModal] = useState(false);
  const [showEditWishlistModal, setShowEditWishlistModal] = useState(false);
  const [editingWishlist, setEditingWishlist] = useState<WishlistItem | null>(null);
  const [editWishlistLoading, setEditWishlistLoading] = useState(false);
  const [showCreateGiftModal, setShowCreateGiftModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [giftLoading, setGiftLoading] = useState(false);
  const [eventLoading, setEventLoading] = useState(false);
  const [myWishlistsForGift, setMyWishlistsForGift] = useState<any[]>([]);
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

  const fetchFeed = async () => {
    setLoading(true);
    try {
      console.log('Fetching feed from:', wishlistApi.defaults.baseURL + endpoints.wishlistsFeed);
      const res = await wishlistApi.get(endpoints.wishlistsFeed, { 
        params: { page: 1, pageSize: 20 } 
      });
      console.log('Feed response:', JSON.stringify(res.data, null, 2));
      const data = res.data?.items || res.data || [];
      console.log('Feed data items count:', data.length);
      
      // Transform data to match our UI structure
      const transformedData: WishlistItem[] = data.map((item: any) => {
        // Log the full item structure to see what fields exist
        console.log(`\n=== Wishlist ${item.id} (${item.title}) ===`);
        console.log('Item keys:', Object.keys(item));
        console.log('Full item structure:', JSON.stringify(item, null, 2));
        
        // Extract gifts from multiple possible locations
        let gifts: any[] = [];
        
        // Check all possible gift field names
        if (Array.isArray(item.gifts)) {
          gifts = item.gifts;
          console.log('Found gifts in item.gifts');
        } else if (Array.isArray(item.items)) {
          gifts = item.items;
          console.log('Found gifts in item.items');
        } else if (Array.isArray(item.giftItems)) {
          gifts = item.giftItems;
          console.log('Found gifts in item.giftItems');
        } else if (Array.isArray(item.Gifts)) {
          gifts = item.Gifts;
          console.log('Found gifts in item.Gifts');
        } else if (Array.isArray(item.Items)) {
          gifts = item.Items;
          console.log('Found gifts in item.Items');
        } else if (item.gifts && typeof item.gifts === 'object' && !Array.isArray(item.gifts)) {
          // If gifts is an object, try to extract array from it
          gifts = item.gifts.items || item.gifts.data || Object.values(item.gifts).filter(Array.isArray)[0] || [];
          console.log('Found gifts as object, extracted array');
        }
        
        console.log(`Total gifts found: ${gifts.length}`);
        if (gifts.length > 0) {
          console.log('Sample gift data:', JSON.stringify(gifts[0], null, 2));
        } else {
          console.log('No gifts in feed response - will fetch separately if needed');
        }
        
        // Store the wishlist item with gifts (even if empty for now)
        const wishlistItem = {
          id: item.id,
          title: item.title,
          description: item.description,
          category: item.category,
          isPublic: item.isPublic,
          gifts: gifts.map((gift: any) => {
            // Extract gift data from various possible field names
            const giftData = {
              id: gift.giftId || gift.id || gift.itemId || gift.GiftId || '',
              name: gift.title || gift.name || gift.Name || gift.Title || '',
              price: gift.price || gift.Price || 0,
              imageUrl: gift.imageUrl || gift.image || gift.photoUrl || gift.ImageUrl || gift.Image || '',
              description: gift.description || gift.Description || '',
              category: gift.category || gift.Category || '',
            };
            
            console.log('Transformed gift:', giftData);
            return giftData;
          }),
          likes: item.likeCount || 0,
          isLiked: item.isLiked || false,
          createdAt: item.createdAt,
          user: {
            id: item.userId,
            name: item.username,
            avatar: item.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.username)}`,
            username: item.username,
          },
        };
        
        return wishlistItem;
      });
      
      // If gifts are missing, fetch them separately for each wishlist
      const wishlistsWithGifts = await Promise.all(transformedData.map(async (wishlist) => {
        // If gifts are already present, return as is
        if (wishlist.gifts && wishlist.gifts.length > 0) {
          return wishlist;
        }
        
        // Otherwise, fetch wishlist details to get gifts
        try {
          console.log(`Fetching gifts for wishlist ${wishlist.id} separately...`);
          const detailRes = await wishlistApi.get(`/api/wishlists/${wishlist.id}`);
          const wishlistDetail = detailRes.data;
          
          let fetchedGifts: any[] = [];
          if (Array.isArray(wishlistDetail.items)) {
            fetchedGifts = wishlistDetail.items;
          } else if (Array.isArray(wishlistDetail.gifts)) {
            fetchedGifts = wishlistDetail.gifts;
          }
          
          console.log(`Fetched ${fetchedGifts.length} gifts for wishlist ${wishlist.id}`);
          
          return {
            ...wishlist,
            gifts: fetchedGifts.map((gift: any) => ({
              id: gift.giftId || gift.id || gift.itemId || '',
              name: gift.title || gift.name || '',
              price: gift.price || 0,
              imageUrl: gift.imageUrl || gift.image || '',
              description: gift.description || '',
              category: gift.category || '',
            })),
          };
        } catch (error: any) {
          console.error(`Error fetching gifts for wishlist ${wishlist.id}:`, error);
          // Return wishlist without gifts if fetch fails
          return wishlist;
        }
      }));
      
      console.log('Final wishlists with gifts:', wishlistsWithGifts.map(w => ({ id: w.id, title: w.title, giftCount: w.gifts.length })));
      
      setWishlists(wishlistsWithGifts);
      setFilteredWishlists(wishlistsWithGifts);
    } catch (error: any) {
      console.log('Error fetching feed:', error.message);
      console.log('Error details:', error.response?.data || error);
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
      const res = await wishlistApi.get(endpoints.likedWishlists());
      const data = res.data || [];
      const transformedData: WishlistItem[] = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        isPublic: item.isPublic,
        gifts: item.gifts || [],
        likes: item.likeCount || 0,
        isLiked: item.isLiked || false,
        createdAt: item.createdAt,
        user: {
          id: item.userId,
          name: item.username,
          avatar: item.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.username)}`,
          username: item.username,
        },
      }));
      setLikedWishlists(transformedData);
    } catch (error) {
      console.log('Error fetching liked wishlists:', error);
      setLikedWishlists([]);
    }
  };

  const fetchMyWishlists = async () => {
    try {
      const res = await wishlistApi.get(endpoints.userWishlists(String(user?.id)));
      const data = res.data || [];
      const transformedData: WishlistItem[] = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        isPublic: item.isPublic,
        gifts: item.gifts || [],
        likes: item.likeCount || 0,
        isLiked: item.isLiked || false,
        createdAt: item.createdAt,
        user: {
          id: item.userId,
          name: item.username,
          avatar: item.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.username)}`,
          username: item.username,
        },
      }));
      setMyWishlists(transformedData);
    } catch (error) {
      console.log('Error fetching my wishlists:', error);
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
            avatar: user?.avatar || '',
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
    setShowEditWishlistModal(true);
  };

  const handleUpdateWishlist = async (data: any) => {
    if (!editingWishlist) return;
    
    try {
      setEditWishlistLoading(true);
      console.log('Updating wishlist:', editingWishlist.id, 'with data:', data);
      
      await wishlistApi.put(endpoints.updateWishlist(editingWishlist.id), {
        title: data.title,
        description: data.description || null,
        category: data.category,
        isPublic: data.isPublic,
      });
      
      console.log('Wishlist updated successfully');
      
      // Refresh all relevant data
      if (activeTab === 'home') {
        await fetchFeed();
      } else if (activeTab === 'my-wishlists') {
        await fetchMyWishlists();
      } else if (activeTab === 'liked') {
        await fetchLikedWishlists();
      }
      
      // Also update local state immediately
      setWishlists(prev => prev.map(w => 
        w.id === editingWishlist.id 
          ? { ...w, title: data.title, description: data.description, category: data.category, isPublic: data.isPublic }
          : w
      ));
      setMyWishlists(prev => prev.map(w => 
        w.id === editingWishlist.id 
          ? { ...w, title: data.title, description: data.description, category: data.category, isPublic: data.isPublic }
          : w
      ));
      setLikedWishlists(prev => prev.map(w => 
        w.id === editingWishlist.id 
          ? { ...w, title: data.title, description: data.description, category: data.category, isPublic: data.isPublic }
          : w
      ));
      
      setShowEditWishlistModal(false);
      setEditingWishlist(null);
    } catch (error: any) {
      console.error('Error updating wishlist:', error);
      console.error('Error response:', error?.response?.data);
      Alert.alert('Error', error?.response?.data?.message || error?.message || 'Failed to update wishlist');
    } finally {
      setEditWishlistLoading(false);
    }
  };

  const handleDeleteWishlist = async (wishlist: WishlistItem) => {
    Alert.alert(
      'Delete Wishlist',
      `Are you sure you want to delete "${wishlist.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting wishlist:', wishlist.id);
              await wishlistApi.delete(`/api/wishlists/${wishlist.id}`);
              console.log('Wishlist deleted successfully');
              
              // Refresh data from backend
              if (activeTab === 'home') {
                await fetchFeed();
              } else if (activeTab === 'my-wishlists') {
                await fetchMyWishlists();
              } else if (activeTab === 'liked') {
                await fetchLikedWishlists();
              }
              
              // Also update local state immediately
              setWishlists(prev => prev.filter(w => w.id !== wishlist.id));
              setLikedWishlists(prev => prev.filter(w => w.id !== wishlist.id));
              setMyWishlists(prev => prev.filter(w => w.id !== wishlist.id));
              
              Alert.alert('Success', 'Wishlist deleted successfully!');
            } catch (error: any) {
              console.error('Error deleting wishlist:', error);
              Alert.alert('Error', error?.response?.data?.message || error?.message || 'Failed to delete wishlist');
            }
          },
        },
      ]
    );
  };

  const handleCreateWishlist = async (data: any) => {
    try {
      setCreateLoading(true);
      const response = await wishlistApi.post('/api/wishlists', {
        title: data.title,
        description: data.description || null,
        category: data.category,
        isPublic: data.isPublic,
      });
      console.log('Wishlist created successfully:', response.data);
      
      // Refresh the current tab data to get the new wishlist from backend
      switch (activeTab) {
        case 'home':
          await fetchFeed();
          break;
        case 'my-wishlists':
          await fetchMyWishlists();
          break;
      }
      
      setShowCreateWishlistModal(false);
      Alert.alert('Success', 'Wishlist created successfully!');
    } catch (error: any) {
      console.error('Error creating wishlist:', error);
      console.error('Error response:', error?.response?.data);
      Alert.alert('Error', error?.response?.data?.message || error?.message || 'Failed to create wishlist');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateGift = async (data: any) => {
    try {
      setGiftLoading(true);
      // Fetch user's wishlists if not already loaded
      if (myWishlistsForGift.length === 0 && user?.id) {
        const res = await wishlistApi.get(endpoints.userWishlists(user.id, 1, 50));
        setMyWishlistsForGift(res.data || []);
      }
      
      // For now, create gift without wishlist (user can add to wishlist later)
      // Or we could show a wishlist picker - for simplicity, create without wishlist
      const form = new FormData();
      form.append('name', data.name);
      form.append('price', String(parseFloat(data.price)));
      form.append('category', data.category);
      if (data.description) form.append('description', data.description);
      if (data.fileUri) {
        form.append('imageFile', {
          uri: data.fileUri,
          name: 'gift.jpg',
          type: 'image/jpeg',
        } as any);
      }
      // Note: wishlistId is optional - can be set later
      
      await wishlistApi.post('/api/gift', form, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });
      
      // Refresh gifts if on my-gifts tab
      if (activeTab === 'my-gifts') {
        await fetchMyGifts();
      }
      
      setShowCreateGiftModal(false);
    } catch (error) {
      console.log('Error creating gift:', error);
    } finally {
      setGiftLoading(false);
    }
  };

  const handleCreateEvent = async (data: any) => {
    try {
      setEventLoading(true);
      // Convert event data to API format
      const eventDate = new Date(data.eventDate);
      eventDate.setHours(0, 0, 0, 0); // Reset time to midnight
      
      let eventTime: string | null = null;
      if (data.eventTime) {
        const timeDate = new Date(data.eventTime);
        const hours = timeDate.getHours();
        const minutes = timeDate.getMinutes();
        // Convert to TimeSpan format (HH:mm:ss) for backend
        eventTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      }
      
      // Ensure inviteeIds is an array and not empty
      const inviteeIds = Array.isArray(data.inviteeIds) ? data.inviteeIds : [];
      
      const eventData: any = {
        title: data.title,
        description: data.description || '',
        eventDate: eventDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
        eventTime: eventTime,
        location: data.location || '',
        additionalNotes: data.additionalNotes || '',
        eventType: data.eventType || 'General',
      };
      
      // Add inviteeIds in multiple possible formats for backend compatibility
      if (inviteeIds.length > 0) {
        eventData.inviteeIds = inviteeIds;
        eventData.inviteeUserIds = inviteeIds; // Alternative field name
        eventData.invitees = inviteeIds; // Another alternative
      }
      
      // Use getApiClient to get the correct API client for events
      const eventApi = getApiClient(endpoints.createEvent);
      console.log('Creating event with data:', JSON.stringify(eventData, null, 2));
      console.log('Invitee IDs count:', eventData.inviteeIds.length);
      console.log('Invitee IDs:', eventData.inviteeIds);
      console.log('Using endpoint:', endpoints.createEvent);
      console.log('Using API client base URL:', eventApi.defaults.baseURL);
      
      const response = await eventApi.post(endpoints.createEvent, eventData);
      console.log('Event created successfully:', response.data);
      console.log('Created event ID:', response.data?.id);
      console.log('Created event invitations:', response.data?.invitations || response.data?.invitees);
      
      setShowCreateEventModal(false);
      Alert.alert('Success', 'Event created successfully!');
    } catch (error: any) {
      console.error('Error creating event:', error);
      console.error('Error response:', error?.response?.data);
      console.error('Error status:', error?.response?.status);
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Failed to create event';
      Alert.alert('Error', errorMessage);
    } finally {
      setEventLoading(false);
    }
  };

  const fetchMyWishlistsForGift = async () => {
    if (!user?.id) return;
    try {
      const res = await wishlistApi.get(endpoints.userWishlists(user.id, 1, 50));
      setMyWishlistsForGift(res.data || []);
    } catch (error) {
      console.log('Error fetching wishlists for gift:', error);
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
      <TouchableOpacity 
        onPress={() => navigation.navigate('WishlistDetail', { 
          wishlistId: item.id, 
          wishlistTitle: item.title 
        })}
        style={styles.cardTouchable}
      >
        {/* Header with user info */}
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <Image source={{ uri: item.user.avatar }} style={styles.userAvatar} />
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
        <View style={styles.cardContent}>
          <Text style={styles.wishlistTitle}>{item.title}</Text>
          {item.description && (
            <Text style={styles.wishlistDescription}>{item.description}</Text>
          )}
          
          {/* Gifts Section - Display all gifts with photos, names, prices, and categories */}
          {item.gifts && Array.isArray(item.gifts) && item.gifts.length > 0 ? (
            <View style={styles.giftsSection}>
              <Text style={styles.giftsSectionTitle}>Gifts ({item.gifts.length})</Text>
              <View style={styles.giftsGrid}>
                {item.gifts
                  .filter((gift: any) => gift && (gift.id || gift.name))
                  .map((gift: any, index: number) => {
                    const giftKey = gift.id || `gift-${index}`;
                    return (
                      <View key={giftKey} style={styles.giftCard}>
                        {/* Gift Image */}
                        {gift.imageUrl && gift.imageUrl.trim() ? (
                          <Image 
                            source={{ uri: gift.imageUrl }} 
                            style={styles.giftImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.giftImagePlaceholder}>
                            <Text style={styles.giftImagePlaceholderText}>
                              {gift.name && gift.name.length > 0 ? gift.name.charAt(0).toUpperCase() : 'G'}
                            </Text>
                          </View>
                        )}
                        
                        {/* Gift Info */}
                        <View style={styles.giftInfo}>
                          {gift.name && gift.name.trim() ? (
                            <Text style={styles.giftName} numberOfLines={1}>
                              {gift.name}
                            </Text>
                          ) : null}
                          {gift.price !== undefined && gift.price !== null && gift.price !== '' ? (
                            <Text style={styles.giftPrice}>
                              ${typeof gift.price === 'number' ? gift.price.toFixed(2) : String(gift.price)}
                            </Text>
                          ) : null}
                          {gift.category && gift.category.trim() ? (
                            <View style={styles.categoryBadge}>
                              <Text style={styles.categoryText}>{gift.category}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
              </View>
            </View>
          ) : (
            <View style={styles.noGiftsContainer}>
              <Text style={styles.noGiftsText}>No gifts in this wishlist</Text>
            </View>
          )}
        </View>

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
              source={{ uri: user?.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=User' }} 
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
                <Text style={styles.clearButtonText}>✕</Text>
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
                    <Image 
                      source={{ uri: user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.username || '')}` }} 
                      style={styles.searchSuggestionAvatar}
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
  ), [user, fadeIn, slideUp, floatY, activeTab, selectedCategory, sortBy, theme, searchQuery, t]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
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
        onPress={() => setShowCreateChoiceModal(true)}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
          style={styles.fabGradient}
        >
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Create Choice Modal */}
      <CreateChoiceModal
        visible={showCreateChoiceModal}
        onClose={() => setShowCreateChoiceModal(false)}
        onSelectGift={() => {
          fetchMyWishlistsForGift();
          setShowCreateGiftModal(true);
        }}
        onSelectWishlist={() => setShowCreateWishlistModal(true)}
        onSelectEvent={() => setShowCreateEventModal(true)}
      />

      {/* Create Wishlist Modal */}
      <CreateWishlistModal
        visible={showCreateWishlistModal}
        onClose={() => setShowCreateWishlistModal(false)}
        onSubmit={handleCreateWishlist}
        loading={createLoading}
      />

      {/* Edit Wishlist Modal */}
      <EditWishlistModal
        visible={showEditWishlistModal}
        onClose={() => {
          setShowEditWishlistModal(false);
          setEditingWishlist(null);
        }}
        onSubmit={handleUpdateWishlist}
        wishlist={editingWishlist ? {
          id: editingWishlist.id,
          title: editingWishlist.title,
          description: editingWishlist.description,
          category: editingWishlist.category,
          isPublic: editingWishlist.isPublic !== undefined ? editingWishlist.isPublic : true,
        } : null}
        loading={editWishlistLoading}
      />

      {/* Create Gift Modal */}
      <GiftModal
        visible={showCreateGiftModal}
        onClose={() => setShowCreateGiftModal(false)}
        onSubmit={handleCreateGift}
        loading={giftLoading}
        gift={null}
        mode="create"
      />

      {/* Create Event Modal */}
      <EventModal
        visible={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        onSubmit={handleCreateEvent}
        loading={eventLoading}
        event={null}
        mode="create"
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
  giftsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  giftsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  giftsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  giftCard: {
    width: (width - 64) / 2 - 6, // 2 items per row with margins
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  giftImage: {
    width: '100%',
    height: 120,
    backgroundColor: colors.muted,
  },
  giftImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  giftImagePlaceholderText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  giftInfo: {
    padding: 10,
  },
  giftName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  giftPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 6,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  noGiftsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noGiftsText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  moreGifts: {
    width: (width - 64) / 2 - 6,
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
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});