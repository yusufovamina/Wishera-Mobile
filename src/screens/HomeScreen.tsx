import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, Text, FlatList, Image, RefreshControl, TouchableOpacity, ScrollView, Animated, Easing, Dimensions, StatusBar, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { api, wishlistApi, userApi, endpoints } from '../api/client';
import { useAuthStore } from '../state/auth';

const { width, height } = Dimensions.get('window');

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
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatar: string;
    username: string;
  };
};

export const HomeScreen: React.FC<any> = ({ navigation }) => {
  const [wishlists, setWishlists] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredWishlists, setFilteredWishlists] = useState<WishlistItem[]>([]);
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
      
      setWishlists(transformedData);
      setFilteredWishlists(transformedData);
    } catch (error: any) {
      console.log('Error fetching feed:', error.message);
      console.log('Error details:', error.response?.data || error);
      
      // Check if error is due to no auth token
      if (error.response?.status === 401) {
        console.log('Not authenticated, showing mock data');
      }
      
      // Use mock data for now
      setWishlists(mockWishlists);
      setFilteredWishlists(mockWishlists);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredWishlists(wishlists);
    } else {
      const filtered = wishlists.filter(w => 
        w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredWishlists(filtered);
    }
  }, [searchQuery, wishlists]);

  useEffect(() => {
    fetchFeed();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  }, []);

  const handleLike = async (wishlistId: string) => {
    try {
      const res = await wishlistApi.post(endpoints.wishlistLike(wishlistId));
      setWishlists(prev => prev.map(w => 
        w.id === wishlistId 
          ? { ...w, isLiked: !w.isLiked, likes: w.isLiked ? w.likes - 1 : w.likes + 1 }
          : w
      ));
    } catch (error) {
      console.log('Error liking wishlist:', error);
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
        <View style={styles.cardContent}>
          <Text style={styles.wishlistTitle}>{item.title}</Text>
          {item.description && (
            <Text style={styles.wishlistDescription}>{item.description}</Text>
          )}
          
          {/* Gifts preview */}
          {item.gifts.length > 0 && (
            <View style={styles.giftsPreview}>
              {item.gifts.slice(0, 3).map((gift, index) => (
                <View key={gift.id} style={styles.giftItem}>
                  <View style={styles.giftIcon}>
                    <Text style={styles.giftIconText}>G</Text>
                  </View>
                  <Text style={styles.giftName} numberOfLines={1}>
                    {gift.name}
                  </Text>
                  {gift.price && (
                    <Text style={styles.giftPrice}>${gift.price}</Text>
                  )}
                </View>
              ))}
              {item.gifts.length > 3 && (
                <View style={styles.moreGifts}>
                  <Text style={styles.moreGiftsText}>+{item.gifts.length - 3} more</Text>
                </View>
              )}
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
            
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionIcon}>Comments</Text>
              <Text style={styles.actionText}>0</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionIcon}>Share</Text>
            </TouchableOpacity>
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
              <Text style={styles.greeting}>Welcome back!</Text>
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
            <Text style={styles.searchIcon}>Icon</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search wishlists..."
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
      </View>
    </Animated.View>
  ), [user, fadeIn, slideUp, floatY]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <FlatList
        data={filteredWishlists}
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
              {searchQuery ? 'No wishlists found' : 'No wishlists yet'}
            </Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('CreateWishlist')}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
          style={styles.fabGradient}
        >
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
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
  },
  giftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 8,
    flex: 1,
    minWidth: 100,
  },
  giftIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  giftIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  giftName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  giftPrice: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  moreGifts: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 8,
    minWidth: 60,
  },
  moreGiftsText: {
    fontSize: 12,
    color: colors.textSecondary,
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


