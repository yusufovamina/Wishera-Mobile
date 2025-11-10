import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, FlatList, Image, TouchableOpacity, ScrollView, RefreshControl, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { GiftModal } from '../components/GiftModal';
import { wishlistApi } from '../api/client';

interface WishlistDetailScreenProps {
  route: {
    params: {
      wishlistId: string;
      wishlistTitle: string;
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
  const { wishlistId, wishlistTitle } = route.params;
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [editingGift, setEditingGift] = useState<Gift | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [giftLoading, setGiftLoading] = useState(false);

  useEffect(() => {
    fetchGifts();
  }, [wishlistId]);

  const fetchGifts = async () => {
    try {
      setLoading(true);
      const res = await wishlistApi.get(`/api/wishlists/${wishlistId}/gifts`);
      setGifts(res.data || []);
    } catch (error) {
      console.log('Error fetching gifts:', error);
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
      await wishlistApi.post(`/api/gift`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      
      await fetchGifts();
      setShowGiftModal(false);
    } catch (error) {
      console.log('Error creating gift:', error);
    } finally {
      setGiftLoading(false);
    }
  };

  const handleEditGift = async (data: any) => {
    if (!editingGift) return;
    
    try {
      setGiftLoading(true);
      await wishlistApi.put(`/api/gift/${editingGift.id}`, {
        name: data.name,
        price: parseFloat(data.price),
        category: data.category,
        description: data.description || null,
      });

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
        } catch (e) {
          console.log('Gift image upload failed:', e);
        }
      }
      
      await fetchGifts();
      setShowGiftModal(false);
      setEditingGift(null);
    } catch (error) {
      console.log('Error editing gift:', error);
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
              await wishlistApi.delete(`/api/Gift/${gift.id}`);
              await fetchGifts();
            } catch (error) {
              console.log('Error deleting gift:', error);
            }
          },
        },
      ]
    );
  };

  const handleReserveGift = async (gift: Gift) => {
    try {
      if (gift.isReserved) {
        await wishlistApi.post(`/api/gift/${gift.id}/cancel-reserve`);
      } else {
        await wishlistApi.post(`/api/gift/${gift.id}/reserve`);
      }
      await fetchGifts();
    } catch (error) {
      console.log('Error reserving gift:', error);
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

  const renderGiftCard = ({ item }: { item: Gift }) => (
    <View style={styles.giftCard}>
      <View style={styles.giftHeader}>
        <View style={styles.giftInfo}>
          <Text style={styles.giftName}>{item.name}</Text>
          <Text style={styles.giftPrice}>${item.price.toFixed(2)}</Text>
          {item.category && (
            <Text style={styles.giftCategory}>{item.category}</Text>
          )}
        </View>
        
        {item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={styles.giftImage} />
        )}
      </View>

      {item.description && (
        <Text style={styles.giftDescription}>{item.description}</Text>
      )}

      {item.isReserved && (
        <View style={styles.reservedBadge}>
          <Text style={styles.reservedText}>
            Reserved by {item.reservedBy}
          </Text>
        </View>
      )}

      <View style={styles.giftActions}>
        <TouchableOpacity
          style={[styles.actionButton, item.isReserved ? styles.unreserveButton : styles.reserveButton]}
          onPress={() => handleReserveGift(item)}
        >
          <Text style={[styles.actionButtonText, item.isReserved ? styles.unreserveButtonText : styles.reserveButtonText]}>
            {item.isReserved ? 'Unreserve' : 'Reserve'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEditModal(item)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteGift(item)}
        >
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{wishlistTitle}</Text>
        <TouchableOpacity onPress={openCreateModal} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ {t('gift.addGift', 'Add Gift')}</Text>
        </TouchableOpacity>
      </View>

      {/* Gifts List */}
      <FlatList
        data={gifts}
        keyExtractor={(item) => item.id}
        renderItem={renderGiftCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            tintColor={colors.primary} 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('wishlist.empty', 'No gifts in this wishlist yet')}</Text>
            <TouchableOpacity onPress={openCreateModal} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>{t('wishlist.addFirstGift', 'Add First Gift')}</Text>
            </TouchableOpacity>
          </View>
        }
      />

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
  },
  giftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  giftInfo: {
    flex: 1,
  },
  giftName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  giftPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  giftCategory: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  giftImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.muted,
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