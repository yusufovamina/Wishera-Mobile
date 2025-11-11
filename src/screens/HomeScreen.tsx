import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, Text, FlatList, Image, RefreshControl, TouchableOpacity, ScrollView, Animated, Easing, Dimensions, StatusBar, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { CreateWishlistModal } from '../components/CreateWishlistModal';
import { useAuthStore } from '../state/auth';
import { api, wishlistApi, userApi, endpoints } from '../api/client';

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
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
      console.log('Feed response:', res.data);
      const data = res.data || [];
      
      // Transform data to match our UI structure
      const transformedData: WishlistItem[] = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        isPublic: item.isPublic,
        gifts: (item.gifts || []).map((gift: any) => ({
          id: gift.giftId || gift.id || '',
          name: gift.title || gift.name || '',
          price: gift.price,
          imageUrl: gift.imageUrl,
          description: gift.description,
          category: gift.category,
        })),
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
      
      setWishlists(transformedData);
      setFilteredWishlists(transformedData);
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
        onPress={() => navigation.navigate('WishlistDetail', { id: item.id })}
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
          {item.gifts && Array.isArray(item.gifts) && item.gifts.length > 0 && (
            <View style={styles.giftsPreview}>
              {item.gifts.slice(0, 3).map((gift: any, index: number) => {
                if (!gift || (!gift.id && !gift.name)) return null;
                const giftKey = gift.id || `gift-${index}`;
                return (
                  <View key={giftKey} style={styles.giftItem}>
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
                      {gift.description && gift.description.trim() ? (
                        <Text style={styles.giftDescription} numberOfLines={2}>
                          {gift.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              }).filter(Boolean)}
              {item.gifts.length > 3 && (
                <View style={styles.moreGifts}>
                  <Text style={styles.moreGiftsText}>+{item.gifts.length - 3} more</Text>
                </View>
              )}
            </View>
          )}
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
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});