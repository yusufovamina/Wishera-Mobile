import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, FlatList, Image, TouchableOpacity, ScrollView, RefreshControl, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { GiftModal } from '../components/GiftModal';
import { wishlistApi } from '../api/client';
import { useAuthStore } from '../state/auth';

interface WishlistDetailScreenProps {
  route: {
    params: {
      wishlistId?: string;
      id?: string;
      wishlistTitle?: string;
    };
  };
  navigation: any;
}

interface Gift {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  imageUrl?: string;
  isReserved: boolean;
  reservedBy?: string;
}

export const WishlistDetailScreen: React.FC<WishlistDetailScreenProps> = ({ route, navigation }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(), [theme]);
  const { user } = useAuthStore();
  const wishlistId = route.params?.wishlistId || route.params?.id || '';
  const [wishlistTitle, setWishlistTitle] = useState(route.params?.wishlistTitle || 'Wishlist');
  const [wishlistDescription, setWishlistDescription] = useState<string>('');
  const [wishlistCategory, setWishlistCategory] = useState<string>('');
  const [wishlistOwnerId, setWishlistOwnerId] = useState<string | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [editingGift, setEditingGift] = useState<Gift | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [giftLoading, setGiftLoading] = useState(false);
  const isOwner = wishlistOwnerId === user?.id;

  useEffect(() => {
    if (wishlistId) {
      fetchGifts();
    }
  }, [wishlistId]);

  // Refresh when screen comes into focus (e.g., after editing from another screen)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (wishlistId) {
        fetchGifts();
      }
    });
    return unsubscribe;
  }, [navigation, wishlistId]);

  const fetchGifts = async () => {
    if (!wishlistId) return;
    
    // Check if user is logged in
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to view wishlists.', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Login'),
        },
      ]);
      return;
    }
    
    try {
      setLoading(true);
      console.log('Fetching wishlist:', wishlistId);
      console.log('Current user:', user?.id, user?.username);
      
      // Fetch wishlist details which includes Items (gifts) array
      const res = await wishlistApi.get(`/api/wishlists/${wishlistId}`);
      console.log('Wishlist fetched successfully:', res.data);
      const wishlist = res.data;
      
      // Update wishlist title, description, category, and owner ID
      if (wishlist) {
        if (wishlist.title && !route.params?.wishlistTitle) {
          setWishlistTitle(wishlist.title);
        }
        if (wishlist.description) {
          setWishlistDescription(wishlist.description);
        }
        if (wishlist.category) {
          setWishlistCategory(wishlist.category);
        }
        if (wishlist.userId) {
          setWishlistOwnerId(wishlist.userId);
        }
      }
      
      // Extract gifts from Items array
      // Backend hides reservedBy info from owners, so we only show it if it exists and user is not owner
      const currentUserId = user?.id;
      const isCurrentUserOwner = wishlist?.userId === currentUserId;
      
      if (wishlist && wishlist.items && Array.isArray(wishlist.items)) {
        const giftsData = wishlist.items.map((item: any) => ({
          id: item.giftId || item.id || '',
          name: item.title || item.name || '',
          price: item.price || 0,
          category: item.category || '',
          description: item.description || '',
          imageUrl: item.imageUrl || '',
          isReserved: item.isReserved || false,
          // Only show reservedBy if user is not the owner (backend already handles this, but double-check)
          reservedBy: isCurrentUserOwner ? undefined : (item.reservedByUsername || item.reservedBy || undefined),
        }));
        setGifts(giftsData);
      } else {
        setGifts([]);
      }
    } catch (error: any) {
      console.error('Error fetching gifts:', error);
      console.error('Error status:', error?.response?.status);
      console.error('Error response:', error?.response?.data);
      
      // Handle 401 Unauthorized - token might be expired
      if (error?.response?.status === 401) {
        Alert.alert(
          'Authentication Error',
          'Your session has expired. Please log in again.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to login screen
                navigation.navigate('Login');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to load wishlist. Please try again.');
      }
      
      setGifts([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGifts();
    setRefreshing(false);
  };

  const handleCreateGift = async (data: any) => {
    try {
      setGiftLoading(true);
      // Create gift aligned with web: POST /api/gift (multipart), include wishlistId
      const form = new FormData();
      form.append('name', data.name);
      form.append('price', String(parseFloat(data.price)));
      form.append('category', data.category);
      form.append('wishlistId', wishlistId);
      if (data.description) form.append('description', data.description);
      if (data.fileUri) {
        form.append('imageFile', {
          uri: data.fileUri,
          name: 'gift.jpg',
          type: 'image/jpeg',
        } as any);
      }
      const response = await wishlistApi.post(`/api/gift`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      console.log('Gift created successfully:', response.data);
      
      // Refresh gifts from backend to get the new gift
      await fetchGifts();
      setShowGiftModal(false);
      Alert.alert('Success', 'Gift added successfully!');
    } catch (error: any) {
      console.error('Error creating gift:', error);
      console.error('Error response:', error?.response?.data);
      Alert.alert('Error', error?.response?.data?.message || error?.message || 'Failed to create gift');
    } finally {
      setGiftLoading(false);
    }
  };

  const handleEditGift = async (data: any) => {
    if (!editingGift) return;
    
    try {
      setGiftLoading(true);
      console.log('Updating gift:', editingGift.id, 'with data:', data);
      
      // Update gift details
      await wishlistApi.put(`/api/gift/${editingGift.id}`, {
        name: data.name,
        price: parseFloat(data.price),
        category: data.category,
        description: data.description || null,
      });
      console.log('Gift updated successfully');

      // Update image if provided
      if (data.fileUri) {
        const form = new FormData();
        form.append('imageFile', {
          uri: data.fileUri,
          name: 'gift.jpg',
          type: 'image/jpeg',
        } as any);
        try {
          await wishlistApi.post(`/api/gift/${editingGift.id}/upload-image`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          console.log('Gift image updated successfully');
        } catch (e) {
          console.log('Gift image upload failed:', e);
        }
      }
      
      // Refresh gifts from backend to get updated data
      await fetchGifts();
      setShowGiftModal(false);
      setEditingGift(null);
      Alert.alert('Success', 'Gift updated successfully!');
    } catch (error: any) {
      console.error('Error editing gift:', error);
      console.error('Error response:', error?.response?.data);
      Alert.alert('Error', error?.response?.data?.message || error?.message || 'Failed to update gift');
    } finally {
      setGiftLoading(false);
    }
  };

  const handleDeleteGift = (gift: Gift) => {
    Alert.alert(
      'Delete Gift',
      `Are you sure you want to delete "${gift.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting gift:', gift.id);
              await wishlistApi.delete(`/api/gift/${gift.id}`);
              console.log('Gift deleted successfully');
              // Refresh gifts from backend
              await fetchGifts();
              Alert.alert('Success', 'Gift deleted successfully!');
            } catch (error: any) {
              console.error('Error deleting gift:', error);
              Alert.alert('Error', error?.response?.data?.message || error?.message || 'Failed to delete gift');
            }
          },
        },
      ]
    );
  };

  const handleReserveGift = async (gift: Gift) => {
    // Prevent reserving own gifts (backend also checks, but frontend validation too)
    if (isOwner) {
      Alert.alert('Error', 'You cannot reserve your own gifts');
      return;
    }
    
    try {
      if (gift.isReserved) {
        await wishlistApi.post(`/api/gift/${gift.id}/cancel-reserve`);
      } else {
        await wishlistApi.post(`/api/gift/${gift.id}/reserve`);
      }
      await fetchGifts();
    } catch (error: any) {
      console.log('Error reserving gift:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to reserve gift';
      Alert.alert('Error', errorMessage);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingGift(null);
    setShowGiftModal(true);
  };

  const openEditModal = (gift: Gift) => {
    setModalMode('edit');
    setEditingGift(gift);
    setShowGiftModal(true);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{wishlistTitle}</Text>
        {isOwner && (
          <TouchableOpacity onPress={openCreateModal} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ {t('gift.addGift', 'Add Gift')}</Text>
          </TouchableOpacity>
        )}
        {!isOwner && <View style={styles.addButton} />}
      </View>

      {/* Wishlist Info Section */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            tintColor={colors.primary} 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Wishlist Details */}
        <View style={styles.wishlistInfoSection}>
          <Text style={styles.wishlistTitle}>{wishlistTitle}</Text>
          {wishlistDescription && (
            <Text style={styles.wishlistDescription}>{wishlistDescription}</Text>
          )}
          {wishlistCategory && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{wishlistCategory}</Text>
            </View>
          )}
        </View>

        {/* Gifts Section */}
        <View style={styles.giftsSection}>
          <Text style={styles.giftsSectionTitle}>
            Gifts ({gifts.length})
          </Text>
          
          {gifts.length > 0 ? (
            gifts.map((gift) => (
              <View key={gift.id} style={styles.giftCard}>
                {/* Gift Image */}
                {gift.imageUrl ? (
                  <Image source={{ uri: gift.imageUrl }} style={styles.giftImageLarge} />
                ) : (
                  <View style={styles.giftImagePlaceholder}>
                    <Text style={styles.giftImagePlaceholderText}>📦</Text>
                  </View>
                )}
                
                {/* Gift Info */}
                <View style={styles.giftInfoContainer}>
                  <Text style={styles.giftName}>{gift.name}</Text>
                  
                  <View style={styles.giftDetailsRow}>
                    <Text style={styles.giftPrice}>${gift.price.toFixed(2)}</Text>
                    {gift.category && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{gift.category}</Text>
                      </View>
                    )}
                  </View>

                  {gift.description && (
                    <Text style={styles.giftDescription} numberOfLines={2}>{gift.description}</Text>
                  )}
                </View>

                {/* Reservation Status */}
                {!isOwner && gift.isReserved && gift.reservedBy && (
                  <View style={styles.reservedBadge}>
                    <Text style={styles.reservedText}>
                      Reserved by {gift.reservedBy}
                    </Text>
                  </View>
                )}
                {isOwner && gift.isReserved && (
                  <View style={styles.reservedBadge}>
                    <Text style={styles.reservedText}>
                      Reserved
                    </Text>
                  </View>
                )}

                {/* Gift Actions */}
                <View style={styles.giftActions}>
                  {!isOwner && (
                    <TouchableOpacity
                      style={[styles.actionButton, gift.isReserved ? styles.unreserveButton : styles.reserveButton]}
                      onPress={() => handleReserveGift(gift)}
                    >
                      <Text style={[styles.actionButtonText, gift.isReserved ? styles.unreserveButtonText : styles.reserveButtonText]}>
                        {gift.isReserved ? 'Unreserve' : 'Reserve'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {isOwner && (
                    <>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => openEditModal(gift)}
                      >
                        <Text style={styles.actionButtonText}>Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteGift(gift)}
                      >
                        <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('wishlist.empty', 'No gifts in this wishlist yet')}</Text>
              {isOwner && (
                <TouchableOpacity onPress={openCreateModal} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>{t('wishlist.addFirstGift', 'Add First Gift')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Gift Modal */}
      <GiftModal
        visible={showGiftModal}
        onClose={() => {
          setShowGiftModal(false);
          setEditingGift(null);
        }}
        onSubmit={modalMode === 'create' ? handleCreateGift : handleEditGift}
        loading={giftLoading}
        gift={editingGift}
        mode={modalMode}
      />
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  wishlistInfoSection: {
    padding: 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  wishlistTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  wishlistDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  giftsSection: {
    padding: 20,
  },
  giftsSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    padding: 8,
  },
  addButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
  },
  giftCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  giftImageLarge: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.muted,
    marginBottom: 12,
    resizeMode: 'cover',
  },
  giftImagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.muted,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftImagePlaceholderText: {
    fontSize: 64,
  },
  giftInfoContainer: {
    marginBottom: 12,
  },
  giftName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  giftDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  giftPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  categoryBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  giftDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  reservedBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  reservedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
  giftActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.muted,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  reserveButton: {
    backgroundColor: colors.successLight,
  },
  reserveButtonText: {
    color: colors.success,
  },
  unreserveButton: {
    backgroundColor: colors.warningLight,
  },
  unreserveButtonText: {
    color: colors.warning,
  },
  deleteButton: {
    backgroundColor: colors.dangerLight,
  },
  deleteButtonText: {
    color: colors.danger,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});