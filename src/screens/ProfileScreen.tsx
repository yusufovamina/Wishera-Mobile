import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Image, Animated, Easing, Dimensions, StatusBar, Alert, Linking, Modal, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { Button } from '../components/Button';
import { ProfileEditModal } from '../components/ProfileEditModal';
import { useAuthStore } from '../state/auth';
import { api, userApi, wishlistApi, endpoints } from '../api/client';
import { usePreferences } from '../state/preferences';

const { width, height } = Dimensions.get('window');

type ProfileData = {
  id: string;
  username: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  interests?: string[];
  isPrivate?: boolean;
  birthday?: string;
  followers: any[];
  following: any[];
  myWishlists: any[];
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
};

type WishlistItem = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  likeCount?: number;
  gifts?: any[];
};

export const ProfileScreen: React.FC<any> = ({ navigation, route }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(), [theme]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'wishlists' | 'gifts' | 'events'>('wishlists');
  const [wishlists, setWishlists] = useState<WishlistItem[]>([]);
  const [gifts, setGifts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loadingWishlists, setLoadingWishlists] = useState(false);
  const [loadingGifts, setLoadingGifts] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const { user, logout } = useAuthStore();
  
  // Get userId from route params (for viewing other users) or use current user
  const targetUserId = route?.params?.userId || user?.id;
  const isViewingOtherUser = route?.params?.userId && route?.params?.userId !== user?.id;

  useEffect(() => {
    fetchProfile();
  }, [targetUserId, user?.id]);

  useEffect(() => {
    if (!profile) return;
    
    if (activeTab === 'wishlists') {
      fetchWishlists();
    } else if (activeTab === 'gifts') {
      fetchGifts();
    } else if (activeTab === 'events') {
      fetchEvents();
    }
  }, [activeTab, profile?.id]);

  const fetchProfile = async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      if (isViewingOtherUser) {
        const res = await userApi.get(`/api/users/${targetUserId}`);
        setProfile(res.data);
      } else {
        const res = await userApi.get(endpoints.identification);
        setProfile(res.data);
      }
    } catch (error: any) {
      console.log('Error fetching profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchWishlists = async () => {
    if (!targetUserId) return;
    
    try {
      setLoadingWishlists(true);
      const res = await wishlistApi.get(endpoints.userWishlists(targetUserId, 1, 50));
      const data = res.data || [];
      setWishlists(data.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl || (item.gifts && item.gifts.length > 0 && item.gifts[0]?.imageUrl),
        category: item.category,
        likeCount: item.likeCount || 0,
        gifts: item.gifts || [],
      })));
    } catch (error: any) {
      console.log('Error fetching wishlists:', error);
      setWishlists([]);
    } finally {
      setLoadingWishlists(false);
    }
  };

  const fetchGifts = async () => {
    if (!targetUserId) return;
    
    try {
      setLoadingGifts(true);
      // Get all gifts from user's wishlists
      // First fetch wishlists, then extract all gifts from them
      const res = await wishlistApi.get(endpoints.userWishlists(targetUserId, 1, 50));
      const wishlistsData = res.data || [];
      const allGifts: any[] = [];
      
      wishlistsData.forEach((wishlist: any) => {
        if (wishlist.gifts && Array.isArray(wishlist.gifts)) {
          wishlist.gifts.forEach((gift: any) => {
            allGifts.push({
              id: gift.id || gift.giftId,
              name: gift.name || gift.title,
              price: gift.price,
              imageUrl: gift.imageUrl,
              category: gift.category,
              wishlistId: wishlist.id,
              wishlistTitle: wishlist.title,
            });
          });
        }
      });
      
      setGifts(allGifts);
    } catch (error: any) {
      console.log('Error fetching gifts:', error);
      setGifts([]);
    } finally {
      setLoadingGifts(false);
    }
  };

  const fetchEvents = async () => {
    // Events are only available for the current user (myEvents endpoint)
    // Only fetch if viewing own profile
    if (!targetUserId || isViewingOtherUser) {
      setEvents([]);
      setLoadingEvents(false);
      return;
    }
    
    try {
      setLoadingEvents(true);
      const res = await api.get(endpoints.myEvents(1, 50));
      const data = res.data?.events || res.data?.items || res.data || [];
      setEvents(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.log('Error fetching events:', error);
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleFollow = async () => {
    if (!profile || !isViewingOtherUser) return;
    
    try {
      if (profile.isFollowing) {
        await userApi.delete(`/api/users/unfollow/${profile.id}`);
        setProfile({ ...profile, isFollowing: false, followersCount: (profile.followersCount || 0) - 1 });
      } else {
        await userApi.post(`/api/users/follow/${profile.id}`);
        setProfile({ ...profile, isFollowing: true, followersCount: (profile.followersCount || 0) + 1 });
      }
    } catch (error: any) {
      console.log('Error following/unfollowing:', error);
      Alert.alert('Error', error?.response?.data?.message || 'Failed to follow/unfollow user');
    }
  };

  const handleUpdateProfile = async (data: Partial<ProfileData>) => {
    try {
      setEditLoading(true);
      const payload: any = {};
      if (typeof data.username !== 'undefined') payload.username = data.username;
      if (typeof data.bio !== 'undefined') payload.bio = data.bio;
      if (typeof data.interests !== 'undefined') payload.interests = data.interests;
      if (typeof data.isPrivate !== 'undefined') payload.isPrivate = data.isPrivate;
      if (typeof data.avatarUrl !== 'undefined') payload.avatarUrl = data.avatarUrl;

      if (Object.keys(payload).length > 0) {
        await userApi.put(endpoints.updateProfile, payload);
      }

      if (typeof data.birthday !== 'undefined' && data.birthday) {
        try {
          await userApi.put(endpoints.updateBirthday, { birthday: data.birthday });
        } catch (e) {
          console.log('Birthday update failed (non-fatal):', e);
        }
      }
      
      setProfile(prev => prev ? { ...prev, ...payload, birthday: data.birthday } : null);
      setShowEditModal(false);
    } catch (error) {
      console.log('Error updating profile:', error);
    } finally {
      setEditLoading(false);
    }
  };

  const pickAndUploadAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photos to update avatar.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true, 
        quality: 0.8, 
        aspect: [1, 1] 
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) return;

      setEditLoading(true);
      const form = new FormData();
      form.append('file', {
        uri: asset.uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      } as any);
      const res = await userApi.post(endpoints.uploadAvatar, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newUrl = res.data?.avatarUrl || res.data?.url || asset.uri;
      setProfile(prev => prev ? { ...prev, avatarUrl: newUrl } : prev);
    } catch (e) {
      console.log('Avatar upload failed:', e);
      Alert.alert('Upload failed', 'Could not upload avatar. Please try again.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
    try {
      setEditLoading(true);
      await api.delete(endpoints.deleteAccount);
      await logout();
    } catch (error) {
      console.log('Error deleting account:', error);
              Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setEditLoading(false);
    }
          },
        },
      ]
    );
  };

  const renderWishlistGrid = () => {
    if (loadingWishlists) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading wishlists...</Text>
        </View>
      );
    }

    if (wishlists.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No wishlists yet</Text>
        </View>
      );
    }

    return (
      <View style={styles.gridContainer}>
        {wishlists.map((wishlist) => (
          <TouchableOpacity
            key={wishlist.id}
            style={styles.gridItem}
            onPress={() => navigation.navigate('WishlistDetail', { id: wishlist.id })}
          >
            {wishlist.imageUrl ? (
              <Image source={{ uri: wishlist.imageUrl }} style={styles.gridImage} />
            ) : (
              <View style={styles.gridImagePlaceholder}>
                <Text style={styles.gridPlaceholderText}>🎁</Text>
              </View>
            )}
            <View style={styles.gridOverlay}>
              <Text style={styles.gridTitle} numberOfLines={2}>{wishlist.title}</Text>
              {wishlist.likeCount !== undefined && wishlist.likeCount > 0 && (
                <Text style={styles.gridLikes}>❤️ {wishlist.likeCount}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderGiftsGrid = () => {
    if (loadingGifts) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading gifts...</Text>
        </View>
      );
    }

    if (gifts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No gifts yet</Text>
        </View>
      );
    }

    return (
      <View style={styles.gridContainer}>
        {gifts.map((gift: any, index: number) => (
          <TouchableOpacity
            key={gift.id || `gift-${index}`}
            style={styles.gridItem}
            onPress={() => {
              // Navigate to wishlist detail if we have wishlistId
              if (gift.wishlistId) {
                navigation.navigate('WishlistDetail', { id: gift.wishlistId });
              }
            }}
          >
            {gift.imageUrl ? (
              <Image source={{ uri: gift.imageUrl }} style={styles.gridImage} />
            ) : (
              <View style={styles.gridImagePlaceholder}>
                <Text style={styles.gridPlaceholderText}>🎁</Text>
              </View>
            )}
            <View style={styles.gridOverlay}>
              <Text style={styles.gridTitle} numberOfLines={2}>{gift.name || gift.title || 'Gift'}</Text>
              {gift.price !== undefined && gift.price !== null && (
                <Text style={styles.gridPrice}>${typeof gift.price === 'number' ? gift.price.toFixed(2) : String(gift.price)}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderEventsGrid = () => {
    if (isViewingOtherUser) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Events are private</Text>
        </View>
      );
    }

    if (loadingEvents) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading events...</Text>
          </View>
      );
    }

    if (events.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No events yet</Text>
        </View>
      );
    }

    return (
      <View style={styles.gridContainer}>
        {events.map((event: any) => (
          <TouchableOpacity
            key={event.id}
            style={styles.gridItem}
            onPress={() => navigation.navigate('MyEvents')}
          >
            <View style={styles.gridImagePlaceholder}>
              <Text style={styles.gridPlaceholderText}>📅</Text>
            </View>
            <View style={styles.gridOverlay}>
              <Text style={styles.gridTitle} numberOfLines={2}>{event.title || 'Event'}</Text>
              {event.eventDate && (
                <Text style={styles.gridDate}>{new Date(event.eventDate).toLocaleDateString()}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderSettingsMenu = () => {
    if (!isViewingOtherUser) {
      return (
        <Modal
          visible={showSettingsMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSettingsMenu(false)}
        >
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setShowSettingsMenu(false)}
          >
            <View style={styles.menuContainer}>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowSettingsMenu(false);
                  setShowEditModal(true);
                }}
              >
                <Text style={styles.menuOptionText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowSettingsMenu(false);
                  navigation.navigate('Settings');
                }}
              >
                <Text style={styles.menuOptionText}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowSettingsMenu(false);
                  navigation.navigate('LikedWishlists');
                }}
              >
                <Text style={styles.menuOptionText}>Liked Wishlists</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowSettingsMenu(false);
                  navigation.navigate('ReservedGifts');
                }}
              >
                <Text style={styles.menuOptionText}>Reserved Gifts</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowSettingsMenu(false);
                  navigation.navigate('MyEvents');
                }}
              >
                <Text style={styles.menuOptionText}>My Events</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowSettingsMenu(false);
                  Linking.openURL('https://wishera.app/support');
                }}
              >
                <Text style={styles.menuOptionText}>Help & Support</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuOption, styles.menuOptionDanger]}
                onPress={handleDeleteAccount}
              >
                <Text style={[styles.menuOptionText, styles.menuOptionTextDanger]}>Delete Account</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowSettingsMenu(false);
                  handleLogout();
                }}
              >
                <Text style={styles.menuOptionText}>Logout</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuCancel}
                onPress={() => setShowSettingsMenu(false)}
              >
                <Text style={styles.menuCancelText}>Cancel</Text>
              </TouchableOpacity>
      </View>
    </TouchableOpacity>
        </Modal>
      );
    }
    return null;
  };

  if (loading || !profile) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  const displayName = profile.name || profile.username;
  const followersCount = profile.followersCount ?? profile.followers?.length ?? 0;
  const followingCount = profile.followingCount ?? profile.following?.length ?? 0;
  const likesCount = wishlists.reduce((sum, w) => sum + (w.likeCount || 0), 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      {/* Header with back button and settings menu */}
      <View style={styles.header}>
        {isViewingOtherUser ? (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.headerIcon}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerLeft} />
        )}
        <View style={styles.headerRight}>
          {!isViewingOtherUser && (
            <TouchableOpacity onPress={() => setShowSettingsMenu(true)}>
              <Text style={styles.headerIcon}>⋯</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture */}
        <View style={styles.profilePictureContainer}>
          <View style={styles.profilePictureBorder}>
              <Image 
              source={{ uri: profile.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.username)}` }}
              style={styles.profilePicture}
              />
          </View>
          {!isViewingOtherUser && (
              <TouchableOpacity style={styles.editAvatarButton} onPress={pickAndUploadAvatar}>
              <Text style={styles.editAvatarIcon}>✏️</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName}</Text>
          <View style={styles.usernameContainer}>
            <Text style={styles.username}>@{profile.username}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {isViewingOtherUser ? (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, profile.isFollowing && styles.actionButtonFollowing]}
                  onPress={handleFollow}
                >
                  <Text style={styles.actionButtonIcon}>{profile.isFollowing ? '✓' : '+'}</Text>
                  <Text style={[styles.actionButtonText, profile.isFollowing && styles.actionButtonTextFollowing]}>
                    {profile.isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.actionButtonMessage]}>
                  <Text style={styles.actionButtonIcon}>💬</Text>
                  <Text style={styles.actionButtonText}>Message</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonEdit]}
                onPress={() => setShowEditModal(true)}
              >
                <Text style={styles.actionButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
          </View>
            
            {/* Stats */}
            <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('Following', { userId: profile.id })}>
              <Text style={styles.statNumber}>{followingCount.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('Followers', { userId: profile.id })}>
              <Text style={styles.statNumber}>{followersCount.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{likesCount.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
          </View>

          {/* Bio */}
          {profile.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'wishlists' && styles.tabActive]}
              onPress={() => setActiveTab('wishlists')}
            >
              <Text style={styles.tabIcon}>☰</Text>
              <Text style={[styles.tabText, activeTab === 'wishlists' && styles.tabTextActive]}>Wishlists</Text>
              {activeTab === 'wishlists' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'gifts' && styles.tabActive]}
              onPress={() => setActiveTab('gifts')}
            >
              <Text style={styles.tabIcon}>🎁</Text>
              <Text style={[styles.tabText, activeTab === 'gifts' && styles.tabTextActive]}>Gifts</Text>
              {activeTab === 'gifts' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'events' && styles.tabActive]}
              onPress={() => setActiveTab('events')}
            >
              <Text style={styles.tabIcon}>📅</Text>
              <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>Events</Text>
              {activeTab === 'events' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          </View>

          {/* Content based on active tab */}
          <View style={styles.tabContent}>
            {activeTab === 'wishlists' && renderWishlistGrid()}
            {activeTab === 'gifts' && renderGiftsGrid()}
            {activeTab === 'events' && renderEventsGrid()}
          </View>
        </View>
      </ScrollView>

      {/* Settings Menu Modal */}
      {renderSettingsMenu()}

      {/* Profile Edit Modal */}
      <ProfileEditModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleUpdateProfile}
        loading={editLoading}
        profile={profile}
      />
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: 12,
    backgroundColor: colors.background,
    zIndex: 10,
  },
  headerLeft: {
    width: 40,
  },
  headerIcon: {
    fontSize: 24,
    color: colors.text,
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
    position: 'relative',
  },
  profilePictureBorder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 3,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  profilePicture: {
    width: '100%',
    height: '100%',
    borderRadius: 47,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: '38%',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  editAvatarIcon: {
    fontSize: 14,
  },
  profileInfo: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  usernameContainer: {
    backgroundColor: colors.muted,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  username: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    width: '100%',
    paddingHorizontal: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.muted,
  },
  actionButtonFollowing: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionButtonMessage: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionButtonEdit: {
    backgroundColor: colors.surface,
    borderColor: colors.muted,
  },
  actionButtonIcon: {
    fontSize: 14,
    marginRight: 6,
    color: colors.text,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  actionButtonTextFollowing: {
    color: 'white',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  bio: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
    marginBottom: 12,
    width: '100%',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabIcon: {
    fontSize: 14,
    marginRight: 6,
    color: colors.textSecondary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
  },
  tabContent: {
    width: '100%',
    paddingHorizontal: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  gridItem: {
    width: (width - 60) / 2,
    aspectRatio: 1,
    marginBottom: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridPlaceholderText: {
    fontSize: 48,
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  gridLikes: {
    fontSize: 10,
    color: 'white',
  },
  gridPrice: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  gridDate: {
    fontSize: 10,
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  menuOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  menuOptionDanger: {
    borderBottomWidth: 0,
  },
  menuOptionText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  menuOptionTextDanger: {
    color: colors.danger,
  },
  menuCancel: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  menuCancelText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
});
