import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Image, Animated, Easing, Dimensions, StatusBar, Alert, Linking, Modal, FlatList, TextInput, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { Button } from '../components/Button';
import { ProfileEditModal } from '../components/ProfileEditModal';
import { GiftModal } from '../components/GiftModal';
import { useAuthStore } from '../state/auth';
import { api, userApi, wishlistApi, endpoints } from '../api/client';
import { usePreferences } from '../state/preferences';
import { 
  GiftIcon, HeartIcon, CalendarIcon, EditIcon, 
  ChatIcon, CheckIcon, AddIcon, ListIcon 
} from '../components/Icon';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'wishlists' | 'gifts' | 'events'>('wishlists');
  const [wishlists, setWishlists] = useState<WishlistItem[]>([]);
  const [gifts, setGifts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loadingWishlists, setLoadingWishlists] = useState(false);
  const [loadingGifts, setLoadingGifts] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [editingGift, setEditingGift] = useState<any | null>(null);
  const [giftModalMode, setGiftModalMode] = useState<'create' | 'edit'>('create');
  const [giftLoading, setGiftLoading] = useState(false);
  const { user, logout } = useAuthStore();
  
  // Get userId from route params (for viewing other users) or use current user
  const targetUserId = route?.params?.userId || user?.id;
  const isViewingOtherUser = Boolean(route?.params?.userId && route?.params?.userId !== user?.id);

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
    if (!targetUserId) {
      console.log('No targetUserId, skipping fetchWishlists');
      setWishlists([]);
      return;
    }
    
    try {
      setLoadingWishlists(true);
      console.log('Fetching wishlists for user:', targetUserId);
      console.log('Fetching from:', wishlistApi.defaults.baseURL + endpoints.userWishlists(targetUserId, 1, 50));
      
      const res = await wishlistApi.get(endpoints.userWishlists(targetUserId, 1, 50));
      console.log('Wishlists response:', res.data);
      console.log('Wishlists response type:', typeof res.data);
      console.log('Wishlists response is array:', Array.isArray(res.data));
      
      // Handle different response formats
      let data: any[] = [];
      if (Array.isArray(res.data)) {
        data = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        data = res.data.data;
      } else if (res.data && res.data.items && Array.isArray(res.data.items)) {
        data = res.data.items;
      } else if (res.data && typeof res.data === 'object') {
        // Try to extract array from object
        const keys = Object.keys(res.data);
        const arrayKey = keys.find(key => Array.isArray(res.data[key]));
        if (arrayKey) {
          data = res.data[arrayKey];
        }
      }
      
      console.log('Extracted wishlists data:', data);
      console.log('Wishlists count:', data.length);
      
      const transformedData = data.map((item: any) => {
        if (!item || !item.id) {
          console.warn('Invalid wishlist item:', item);
          return null;
        }
        return {
          id: item.id,
          title: item.title || 'Untitled Wishlist',
          description: item.description || null,
          imageUrl: item.imageUrl || (item.gifts && Array.isArray(item.gifts) && item.gifts.length > 0 && item.gifts[0]?.imageUrl),
          category: item.category || 'Other',
          likeCount: item.likeCount || item.likes || 0,
          gifts: item.gifts || [],
        };
      }).filter((item): item is WishlistItem => item !== null);
      
      console.log('Transformed wishlists count:', transformedData.length);
      setWishlists(transformedData);
    } catch (error: any) {
      console.error('Error fetching wishlists:', error.message);
      console.error('Error details:', error.response?.data || error);
      console.error('Error status:', error.response?.status);
      setWishlists([]);
    } finally {
      setLoadingWishlists(false);
    }
  };

  const fetchGifts = async () => {
    if (!targetUserId) {
      console.log('No targetUserId, skipping fetchGifts');
      setGifts([]);
      return;
    }
    
    try {
      setLoadingGifts(true);
      console.log('Fetching gifts for user:', targetUserId);
      console.log('Is viewing other user:', isViewingOtherUser);
      
      let allGifts: any[] = [];
      
      // If viewing current user's profile, use the giftsForUser endpoint (same as HomeScreen)
      if (!isViewingOtherUser && targetUserId === user?.id) {
        console.log('Fetching own gifts from:', wishlistApi.defaults.baseURL + endpoints.giftsForUser);
        const res = await wishlistApi.get(endpoints.giftsForUser);
        console.log('Gifts response:', res.data);
        console.log('Gifts response type:', typeof res.data);
        console.log('Gifts response is array:', Array.isArray(res.data));
        
        // Handle different response formats
        if (Array.isArray(res.data)) {
          allGifts = res.data;
        } else if (res.data && Array.isArray(res.data.data)) {
          allGifts = res.data.data;
        } else if (res.data && res.data.items && Array.isArray(res.data.items)) {
          allGifts = res.data.items;
        } else if (res.data && typeof res.data === 'object') {
          // Try to extract array from object
          const keys = Object.keys(res.data);
          const arrayKey = keys.find(key => Array.isArray(res.data[key]));
          if (arrayKey) {
            allGifts = res.data[arrayKey];
          }
        }
        
        // Transform gifts to match expected format
        allGifts = allGifts.map((gift: any) => ({
          id: gift.id || gift.giftId || `gift-${allGifts.indexOf(gift)}`,
          name: gift.name || gift.title || 'Untitled Gift',
          price: gift.price,
          imageUrl: gift.imageUrl,
          description: gift.description,
          category: gift.category,
          wishlistId: gift.wishlistId,
          wishlistTitle: gift.wishlistTitle,
        }));
      } else {
        // For other users, extract gifts from wishlists
        console.log('Fetching from:', wishlistApi.defaults.baseURL + endpoints.userWishlists(targetUserId, 1, 50));
        const res = await wishlistApi.get(endpoints.userWishlists(targetUserId, 1, 50));
        console.log('Wishlists response:', res.data);
        console.log('Wishlists response type:', typeof res.data);
        console.log('Wishlists response is array:', Array.isArray(res.data));
        
        // Handle different response formats
        let wishlistsData: any[] = [];
        if (Array.isArray(res.data)) {
          wishlistsData = res.data;
        } else if (res.data && Array.isArray(res.data.data)) {
          wishlistsData = res.data.data;
        } else if (res.data && res.data.items && Array.isArray(res.data.items)) {
          wishlistsData = res.data.items;
        } else if (res.data && typeof res.data === 'object') {
          // Try to extract array from object
          const keys = Object.keys(res.data);
          const arrayKey = keys.find(key => Array.isArray(res.data[key]));
          if (arrayKey) {
            wishlistsData = res.data[arrayKey];
          }
        }
        
        console.log('Extracted wishlists data:', wishlistsData);
        console.log('Wishlists count:', wishlistsData.length);
        
        wishlistsData.forEach((wishlist: any) => {
          if (!wishlist || !wishlist.id) {
            console.warn('Invalid wishlist item:', wishlist);
            return;
          }
          
          console.log('Processing wishlist:', wishlist.id, wishlist.title);
          console.log('Wishlist gifts:', wishlist.gifts);
          
          if (wishlist.gifts && Array.isArray(wishlist.gifts)) {
            wishlist.gifts.forEach((gift: any) => {
              if (!gift) {
                console.warn('Invalid gift item:', gift);
                return;
              }
              
              const giftData = {
                id: gift.id || gift.giftId || `gift-${wishlist.id}-${allGifts.length}`,
                name: gift.name || gift.title || 'Untitled Gift',
                price: gift.price,
                imageUrl: gift.imageUrl,
                description: gift.description,
                category: gift.category,
                wishlistId: wishlist.id,
                wishlistTitle: wishlist.title,
              };
              
              console.log('Adding gift:', giftData);
              allGifts.push(giftData);
            });
          } else {
            console.log('Wishlist has no gifts or gifts is not an array:', wishlist.id, 'gifts:', wishlist.gifts);
          }
        });
      }
      
      console.log('Total gifts extracted:', allGifts.length);
      setGifts(allGifts);
    } catch (error: any) {
      console.error('Error fetching gifts:', error.message);
      console.error('Error details:', error.response?.data || error);
      console.error('Error status:', error.response?.status);
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
      // Events are handled by user service, not auth service
      const res = await userApi.get(endpoints.myEvents(1, 50));
      const data = res.data?.events || res.data?.items || res.data || [];
      setEvents(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.log('Error fetching events:', error);
      console.log('Error status:', error?.response?.status);
      console.log('Error response:', error?.response?.data);
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
        mediaTypes: ['images'], 
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
      Alert.alert(
        t('profile.uploadFailed', 'Upload failed'), 
        t('profile.uploadFailedMessage', 'Could not upload avatar. Please try again.')
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const deleteReasons = [
    t('profile.deleteReasons.privacy', 'Privacy concerns'),
    t('profile.deleteReasons.notifications', 'Too many notifications'),
    t('profile.deleteReasons.notFinding', 'Not finding what I need'),
    t('profile.deleteReasons.betterAlternative', 'Found a better alternative'),
    t('profile.deleteReasons.temporary', 'Temporary account'),
    t('profile.deleteReasons.other', 'Other reason'),
  ];

  const whatYouLose = [
    t('profile.whatYouLose.wishlists', 'All your wishlists and gifts'),
    t('profile.whatYouLose.savedWishlists', 'All your saved wishlists from others'),
    t('profile.whatYouLose.messages', 'All your messages and conversations'),
    t('profile.whatYouLose.events', 'All your events and invitations'),
    t('profile.whatYouLose.followers', 'All your followers and following relationships'),
    t('profile.whatYouLose.profile', 'Your profile and account settings'),
    t('profile.whatYouLose.likes', 'All your likes and bookmarks'),
  ];

  const handleDeleteAccount = () => {
    setDeleteConfirmStep(1);
    setDeleteConfirmText('');
    setDeleteReason('');
    setShowDeleteConfirm(true);
  };

  const handleDeleteStep1 = () => {
    if (!deleteReason) {
      Alert.alert(
        t('common.required', 'Required'), 
        t('profile.deleteReasonRequired', 'Please select a reason for deleting your account.')
      );
      return;
    }
    setDeleteConfirmStep(2);
    setDeleteConfirmText('');
  };

  const handleDeleteStep2 = () => {
    if (deleteConfirmText.toUpperCase() !== 'DELETE') {
      Alert.alert(
        t('profile.incorrectConfirmation', 'Incorrect Confirmation'),
        t('profile.mustTypeDelete', 'You must type "DELETE" exactly to confirm account deletion.'),
        [{ text: t('common.ok', 'OK') }]
      );
      return;
    }
    setDeleteConfirmStep(3);
  };

  const handleDeleteFinal = async () => {
    try {
      setEditLoading(true);
      setShowDeleteConfirm(false);
      // Send deletion reason if backend supports it
      await api.delete(endpoints.deleteAccount, {
        data: { reason: deleteReason }
      });
      await logout();
    } catch (error) {
      console.log('Error deleting account:', error);
      Alert.alert(
        t('common.error', 'Error'), 
        t('profile.deleteFailed', 'Failed to delete account. Please try again.')
      );
    } finally {
      setEditLoading(false);
      setDeleteConfirmStep(1);
      setDeleteConfirmText('');
      setDeleteReason('');
    }
  };

  const renderWishlistGrid = () => {
    if (loadingWishlists) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('profile.loadingWishlists', 'Loading wishlists...')}</Text>
        </View>
      );
    }

    if (wishlists.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('profile.noWishlists', 'No wishlists yet')}</Text>
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
                <GiftIcon size={32} color={colors.textSecondary} />
              </View>
            )}
            <View style={styles.gridOverlay}>
              <Text style={styles.gridTitle} numberOfLines={2}>{wishlist.title}</Text>
              {wishlist.likeCount !== undefined && wishlist.likeCount > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <HeartIcon size={14} color={colors.danger || '#FF3B30'} />
                  <Text style={styles.gridLikes}>{wishlist.likeCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const handleEditGift = async (data: any) => {
    if (!editingGift) return;
    
    console.log('handleEditGift called with data:', {
      name: data.name,
      price: data.price,
      category: data.category,
      description: data.description,
      fileUri: data.fileUri,
      imageUrl: data.imageUrl,
    });
    
    try {
      setGiftLoading(true);
      
      // Update gift details (matching web version: updateGift API)
      await wishlistApi.put(`/api/gift/${editingGift.id}`, {
        name: data.name,
        price: parseFloat(data.price),
        category: data.category,
        description: data.description || null,
      });
      console.log('Gift details updated successfully');

      // Update image if provided (separate upload like web version)
      let updatedImageUrl: string | null = null;
      if (data.fileUri) {
        console.log('Uploading image for gift:', editingGift.id, 'fileUri:', data.fileUri);
        try {
          const form = new FormData();
          
          // Handle FormData differently for web vs mobile
          if (Platform.OS === 'web') {
            // For web, convert URI to File/Blob
            try {
              const response = await fetch(data.fileUri);
              const blob = await response.blob();
              form.append('imageFile', blob, 'gift.jpg');
              console.log('Created blob for web upload');
            } catch (fetchError) {
              console.error('Error converting image to blob:', fetchError);
              form.append('imageFile', data.fileUri);
            }
          } else {
            // Mobile platforms - use React Native FormData format
            const fileUri = data.fileUri;
            const fileName = fileUri.split('/').pop() || 'gift.jpg';
            const fileType = 'image/jpeg';
            
            form.append('imageFile', {
              uri: fileUri,
              name: fileName,
              type: fileType,
            } as any);
            console.log('Created FormData for mobile upload, fileName:', fileName);
          }
          
          // Upload image (matching web version: uploadGiftImage API)
          const headers = Platform.OS === 'web'
            ? {}
            : { 'Content-Type': 'multipart/form-data' };
          
          console.log('Calling upload-image API...');
          const uploadResponse = await wishlistApi.post(`/api/gift/${editingGift.id}/upload-image`, form, { headers });
          console.log('Image upload successful:', uploadResponse.data);
          
          // Get the updated image URL from the response
          updatedImageUrl = uploadResponse.data?.imageUrl || uploadResponse.data?.ImageUrl || null;
          console.log('Updated image URL from response:', updatedImageUrl);
        } catch (uploadError: any) {
          console.error('Error uploading image:', uploadError);
          console.error('Upload error response:', uploadError?.response?.data);
          console.error('Upload error status:', uploadError?.response?.status);
          // Show error to user since image upload failed
          Alert.alert('Error', uploadError?.response?.data?.message || uploadError?.message || 'Failed to upload image');
        }
      }
      
      // Refresh to get the latest data from backend
      await fetchGifts();
      
      // After refresh, ensure the image URL is set if we just uploaded one
      // This is needed because fetchGifts might not immediately return the updated image
      if (updatedImageUrl) {
        console.log('Updating state with image URL after refresh:', updatedImageUrl);
        // Use setTimeout to ensure state update happens after fetchGifts completes
        setTimeout(() => {
          setGifts(prev => {
            const updated = prev.map(g => 
              g.id === editingGift.id 
                ? { 
                    ...g, 
                    imageUrl: updatedImageUrl,
                  } 
                : g
            );
            console.log('State updated with image URL, gift found:', updated.find(g => g.id === editingGift.id));
            return updated;
          });
        }, 100);
      }
      setShowGiftModal(false);
      setEditingGift(null);
    } catch (error: any) {
      console.error('Error editing gift:', error);
      // Silent error handling like web version
    } finally {
      setGiftLoading(false);
    }
  };

  const handleDeleteGift = async (gift: any) => {
    console.log('handleDeleteGift called with gift:', gift.id, gift.name);
    try {
      console.log('Calling delete API for gift:', gift.id);
      // Delete gift (matching web version: deleteGift API)
      await wishlistApi.delete(`/api/gift/${gift.id}`);
      console.log('Delete API call successful');
      
      // Update state directly by filtering (like web version)
      setGifts(prev => {
        const filtered = prev.filter(g => g.id !== gift.id);
        console.log('Updated gifts list, new count:', filtered.length);
        return filtered;
      });
    } catch (error: any) {
      console.error('Error deleting gift:', error);
      console.error('Error response:', error?.response?.data);
      // Show error to user since delete failed
      Alert.alert('Error', error?.response?.data?.message || error?.message || 'Failed to delete gift');
    }
  };

  const openGiftEditModal = (gift: any) => {
    setEditingGift(gift);
    setGiftModalMode('edit');
    setShowGiftModal(true);
  };

  const renderGiftsGrid = () => {
    if (loadingGifts) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('profile.loadingGifts', 'Loading gifts...')}</Text>
        </View>
      );
    }

    if (gifts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('profile.noGifts', 'No gifts yet')}</Text>
        </View>
      );
    }

    return (
      <View style={styles.giftsListContainer}>
        {gifts.map((gift: any, index: number) => {
          const hasWishlistId = gift.wishlistId && typeof gift.wishlistId === 'string' && gift.wishlistId.trim() !== '';
          const shouldShowButtons = !isViewingOtherUser && !hasWishlistId;
          
          if (shouldShowButtons) {
            console.log('Should show buttons for gift:', gift.id, gift.name, 'isViewingOtherUser:', isViewingOtherUser, 'hasWishlistId:', hasWishlistId);
          }
          
          return (
            <View key={gift.id || `gift-${index}`} style={styles.giftCardContainer}>
              <TouchableOpacity
                style={styles.giftCard}
                activeOpacity={0.7}
                onPress={() => {
                  // If gift is attached to a wishlist, navigate to wishlist detail
                  if (hasWishlistId) {
                    navigation.navigate('WishlistDetail', { 
                      id: gift.wishlistId,
                      wishlistId: gift.wishlistId 
                    });
                  }
                }}
              >
                {gift.imageUrl ? (
                  <Image 
                    key={gift.imageUrl}
                    source={{ uri: gift.imageUrl }} 
                    style={styles.giftCardImage}
                  />
                ) : (
                  <View style={styles.giftCardImagePlaceholder}>
                    <GiftIcon size={32} color={colors.textSecondary} />
                  </View>
                )}
                <View style={styles.giftCardInfo}>
                  <Text style={styles.giftCardName} numberOfLines={2}>
                    {gift.name || gift.title || t('gift.defaultName', 'Gift')}
                  </Text>
                  {gift.price !== undefined && gift.price !== null && (
                    <Text style={styles.giftCardPrice}>
                      ${typeof gift.price === 'number' ? gift.price.toFixed(2) : String(gift.price)}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
              
              {/* Edit and Delete buttons for own profile standalone gifts */}
              {!isViewingOtherUser && !hasWishlistId && (
                <View style={styles.giftCardActions}>
                  <TouchableOpacity
                    style={styles.giftActionButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      console.log('Edit button pressed for gift:', gift.id);
                      openGiftEditModal(gift);
                    }}
                  >
                    <Text style={styles.giftActionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.giftActionButton, styles.giftActionButtonDelete]}
                    activeOpacity={0.7}
                    onPress={() => {
                      console.log('Delete button pressed for gift:', gift.id, gift.name);
                      
                      // Use window.confirm on web, Alert.alert on native
                      if (Platform.OS === 'web') {
                        const confirmed = window.confirm('Delete this gift?');
                        if (confirmed) {
                          console.log('Delete confirmed via window.confirm, calling handleDeleteGift');
                          handleDeleteGift(gift);
                        } else {
                          console.log('Delete cancelled via window.confirm');
                        }
                      } else {
                        // Native platforms
                        Alert.alert(
                          'Delete Gift',
                          'Delete this gift?',
                          [
                            { text: 'Cancel', style: 'cancel', onPress: () => console.log('Delete cancelled') },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => {
                                console.log('Delete confirmed, calling handleDeleteGift');
                                handleDeleteGift(gift);
                              },
                            },
                          ],
                          { cancelable: true }
                        );
                      }
                    }}
                  >
                    <Text style={[styles.giftActionButtonText, styles.giftActionButtonTextDelete]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderEventsGrid = () => {
    if (isViewingOtherUser) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('profile.eventsPrivate', 'Events are private')}</Text>
        </View>
      );
    }

    if (loadingEvents) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('profile.loadingEvents', 'Loading events...')}</Text>
          </View>
      );
    }

    if (events.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('profile.noEvents', 'No events yet')}</Text>
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
              <CalendarIcon size={32} color={colors.textSecondary} />
            </View>
            <View style={styles.gridOverlay}>
              <Text style={styles.gridTitle} numberOfLines={2}>{event.title || t('events.defaultName', 'Event')}</Text>
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
                <Text style={styles.menuOptionText}>{t('profile.menu.editProfile', 'Edit Profile')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowSettingsMenu(false);
                  navigation.navigate('Settings');
                }}
              >
                <Text style={styles.menuOptionText}>{t('profile.menu.settings', 'Settings')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowSettingsMenu(false);
                  navigation.navigate('ReservedGifts');
                }}
              >
                <Text style={styles.menuOptionText}>{t('profile.menu.reservedGifts', 'Reserved Gifts')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowSettingsMenu(false);
                  navigation.navigate('MyEvents');
                }}
              >
                <Text style={styles.menuOptionText}>{t('profile.menu.myEvents', 'My Events')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowSettingsMenu(false);
                  navigation.navigate('HelpSupport');
                }}
              >
                <Text style={styles.menuOptionText}>{t('profile.menu.helpSupport', 'Help & Support')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuOption, styles.menuOptionDanger]}
                onPress={handleDeleteAccount}
              >
                <Text style={[styles.menuOptionText, styles.menuOptionTextDanger]}>{t('profile.menu.deleteAccount', 'Delete Account')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowSettingsMenu(false);
                  handleLogout();
                }}
              >
                <Text style={styles.menuOptionText}>{t('profile.menu.logout', 'Logout')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuCancel}
                onPress={() => setShowSettingsMenu(false)}
              >
                <Text style={styles.menuCancelText}>{t('common.cancel', 'Cancel')}</Text>
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
          <Text style={styles.loadingText}>{t('profile.loading', 'Loading profile...')}</Text>
        </View>
      </View>
    );
  }

  const displayName = profile.name || profile.username || '';
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
              <EditIcon size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName}</Text>
          <View style={styles.usernameContainer}>
            <Text style={styles.username}>@{profile.username || ''}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {isViewingOtherUser ? (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, profile.isFollowing && styles.actionButtonFollowing]}
                  onPress={handleFollow}
                >
                  {profile.isFollowing ? (
                    <CheckIcon size={18} color={colors.text} />
                  ) : (
                    <AddIcon size={18} color={colors.text} />
                  )}
                  <Text style={[styles.actionButtonText, profile.isFollowing && styles.actionButtonTextFollowing]}>
                    {profile.isFollowing ? t('profile.following', 'Following') : t('profile.follow', 'Follow')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.actionButtonMessage]}
                  onPress={() => {
                    if (profile?.id) {
                      // Navigate to Tabs first, then to Chats tab with userId param
                      navigation.navigate('Tabs', {
                        screen: 'Chats',
                        params: { userId: profile.id }
                      });
                    }
                  }}
                >
                  <ChatIcon size={18} color={colors.text} />
                  <Text style={styles.actionButtonText}>{t('profile.message', 'Message')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonEdit]}
                onPress={() => setShowEditModal(true)}
              >
                <Text style={styles.actionButtonText}>{t('profile.menu.editProfile', 'Edit Profile')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('Following', { userId: profile.id })}>
              <Text style={styles.statNumber}>{Number(followingCount).toLocaleString()}</Text>
              <Text style={styles.statLabel}>{t('profile.stats.following', 'Following')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('Followers', { userId: profile.id })}>
              <Text style={styles.statNumber}>{Number(followersCount).toLocaleString()}</Text>
              <Text style={styles.statLabel}>{t('profile.stats.followers', 'Followers')}</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{Number(likesCount).toLocaleString()}</Text>
              <Text style={styles.statLabel}>{t('profile.stats.likes', 'Likes')}</Text>
            </View>
          </View>

          {/* Bio */}
          {profile.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}

          {/* Interests */}
          {profile.interests && profile.interests.length > 0 && (
            <View style={styles.interestsContainer}>
              {profile.interests.map((interest, index) => (
                <View key={index} style={styles.interestChip}>
                  <Text style={styles.interestChipText}>{interest}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'wishlists' && styles.tabActive]}
              onPress={() => setActiveTab('wishlists')}
            >
              <ListIcon size={20} color={activeTab === 'wishlists' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'wishlists' && styles.tabTextActive]}>{t('profile.tabs.wishlists', 'Wishlists')}</Text>
              {activeTab === 'wishlists' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'gifts' && styles.tabActive]}
              onPress={() => setActiveTab('gifts')}
            >
              <GiftIcon size={20} color={activeTab === 'gifts' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'gifts' && styles.tabTextActive]}>{t('profile.tabs.gifts', 'Gifts')}</Text>
              {activeTab === 'gifts' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'events' && styles.tabActive]}
              onPress={() => setActiveTab('events')}
            >
              <CalendarIcon size={20} color={activeTab === 'events' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>{t('profile.tabs.events', 'Events')}</Text>
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
        onAvatarUpdate={(avatarUrl) => {
          setProfile(prev => prev ? { ...prev, avatarUrl } : null);
        }}
      />

      {/* Gift Edit Modal */}
      {!isViewingOtherUser && (
        <GiftModal
          visible={showGiftModal}
          onClose={() => {
            setShowGiftModal(false);
            setEditingGift(null);
          }}
          onSubmit={handleEditGift}
          loading={giftLoading}
          gift={editingGift ? {
            name: editingGift.name || editingGift.title || '',
            price: String(editingGift.price || ''),
            category: editingGift.category || '',
            description: editingGift.description || '',
            imageUrl: editingGift.imageUrl || '',
          } : null}
          mode={giftModalMode}
        />
      )}

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            {deleteConfirmStep === 1 && (
              <>
                <Text style={styles.deleteModalTitle}>{t('profile.deleteAccount', 'Delete Account')}</Text>
                <Text style={styles.deleteModalText}>
                  {t('profile.deleteBeforeProceed', "Before you proceed, please understand what you'll lose:")}
                </Text>
                
                <ScrollView style={styles.deleteModalScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.deleteModalList}>
                    {whatYouLose.map((item, index) => (
                      <View key={index} style={styles.deleteModalListItem}>
                        <Text style={styles.deleteModalListBullet}>•</Text>
                        <Text style={styles.deleteModalListText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                <Text style={[styles.deleteModalText, { marginTop: 16, marginBottom: 12 }]}>
                  {t('profile.deleteReason', 'Why are you deleting your account?')}
                </Text>
                <ScrollView style={styles.deleteModalReasonsScroll} showsVerticalScrollIndicator={false}>
                  {deleteReasons.map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.deleteModalReasonOption,
                        deleteReason === reason && styles.deleteModalReasonOptionSelected
                      ]}
                      onPress={() => setDeleteReason(reason)}
                    >
                      <View style={[
                        styles.deleteModalRadio,
                        deleteReason === reason && styles.deleteModalRadioSelected
                      ]}>
                        {deleteReason === reason && <View style={styles.deleteModalRadioInner} />}
                      </View>
                      <Text style={[
                        styles.deleteModalReasonText,
                        deleteReason === reason && styles.deleteModalReasonTextSelected
                      ]}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.deleteModalButtons}>
                  <TouchableOpacity
                    style={[styles.deleteModalButton, styles.deleteModalButtonCancel]}
                    onPress={() => setShowDeleteConfirm(false)}
                  >
                    <Text style={styles.deleteModalButtonTextCancel}>{t('common.cancel', 'Cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteModalButton, styles.deleteModalButtonDanger, !deleteReason && styles.deleteModalButtonDisabled]}
                    onPress={handleDeleteStep1}
                    disabled={!deleteReason}
                  >
                    <Text style={styles.deleteModalButtonTextDanger}>{t('common.continue', 'Continue')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {deleteConfirmStep === 2 && (
              <>
                <Text style={styles.deleteModalTitle}>{t('profile.confirmDeletion', 'Confirm Deletion')}</Text>
                <Text style={styles.deleteModalText}>
                  {t('profile.typeDeleteToConfirm', 'To confirm, please type "DELETE" in the box below:')}
                </Text>
                <TextInput
                  style={styles.deleteModalInput}
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  placeholder={t('profile.typeDeletePlaceholder', 'Type DELETE')}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <View style={styles.deleteModalButtons}>
                  <TouchableOpacity
                    style={[styles.deleteModalButton, styles.deleteModalButtonCancel]}
                    onPress={() => setShowDeleteConfirm(false)}
                  >
                    <Text style={styles.deleteModalButtonTextCancel}>{t('common.cancel', 'Cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteModalButton, styles.deleteModalButtonDanger]}
                    onPress={handleDeleteStep2}
                  >
                    <Text style={styles.deleteModalButtonTextDanger}>{t('common.continue', 'Continue')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {deleteConfirmStep === 3 && (
              <>
                <Text style={styles.deleteModalTitle}>Final Warning</Text>
                <Text style={styles.deleteModalText}>
                  This is your last chance to cancel. Your account and all data will be permanently deleted. Are you absolutely sure?
                </Text>
                <View style={styles.deleteModalButtons}>
                  <TouchableOpacity
                    style={[styles.deleteModalButton, styles.deleteModalButtonCancel]}
                    onPress={() => setShowDeleteConfirm(false)}
                  >
                    <Text style={styles.deleteModalButtonTextCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteModalButton, styles.deleteModalButtonDanger]}
                    onPress={handleDeleteFinal}
                    disabled={editLoading}
                  >
                    <Text style={styles.deleteModalButtonTextDanger}>
                      {editLoading ? 'Deleting...' : 'Yes, Delete Forever'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    gap: 8,
  },
  interestChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  interestChipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
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
    zIndex: 1,
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
    pointerEvents: 'none', // Allow touches to pass through to parent
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
  // Gift card styles (for gifts tab)
  giftsListContainer: {
    marginTop: 8,
  },
  giftCardContainer: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    zIndex: 1,
  },
  giftCard: {
    flexDirection: 'row',
    padding: 12,
  },
  giftCardImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.muted,
  },
  giftCardImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  giftCardInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  giftCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  giftCardPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  giftCardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  giftActionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  giftActionButtonDelete: {
    backgroundColor: colors.dangerLight,
  },
  giftActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  giftActionButtonTextDelete: {
    color: colors.danger,
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

  // Delete Account Modal styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  deleteModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: 16,
    textAlign: 'center',
  },
  deleteModalText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  deleteModalInput: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteModalButtonCancel: {
    backgroundColor: colors.muted,
  },
  deleteModalButtonDanger: {
    backgroundColor: colors.danger,
  },
  deleteModalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  deleteModalButtonTextDanger: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  deleteModalButtonDisabled: {
    opacity: 0.5,
  },
  deleteModalScroll: {
    maxHeight: 120,
    marginBottom: 16,
  },
  deleteModalList: {
    marginBottom: 8,
  },
  deleteModalListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  deleteModalListBullet: {
    fontSize: 16,
    color: colors.danger,
    marginRight: 8,
    fontWeight: '700',
  },
  deleteModalListText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  deleteModalReasonsScroll: {
    maxHeight: 180,
    marginBottom: 16,
  },
  deleteModalReasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  deleteModalReasonOptionSelected: {
    borderColor: colors.danger,
    backgroundColor: colors.danger + '10',
  },
  deleteModalRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalRadioSelected: {
    borderColor: colors.danger,
  },
  deleteModalRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  deleteModalReasonText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  deleteModalReasonTextSelected: {
    color: colors.danger,
    fontWeight: '600',
  },
});
