import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, RefreshControl } from 'react-native';
import { colors, lightColors, darkColors } from '../theme/colors';
import { endpoints, wishlistApi, getApiClient } from '../api/client';
import { usePreferences } from '../state/preferences';
import { useI18n } from '../i18n';
import { SafeImage } from '../components/SafeImage';
import { CloseIcon } from '../components/Icon';

type GiftItem = { 
  id: string; 
  name: string; 
  price?: number; 
  category?: string; 
  wishlistId?: string;
  wishlistTitle?: string;
  imageUrl?: string;
  image?: string;
};

export const ReservedGiftsScreen: React.FC = () => {
  const { theme } = usePreferences();
  const { t } = useI18n();
  const themeColors = useMemo(() => theme === 'dark' ? darkColors : lightColors, [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<GiftItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await wishlistApi.get(endpoints.reservedGifts);
      console.log('Reserved gifts response:', res.data);
      // Handle different response formats
      const data = res.data?.items || res.data?.gifts || res.data || [];
      const transformedItems: GiftItem[] = Array.isArray(data) ? data.map((item: any) => ({
        id: item.id || item.giftId || '',
        name: item.name || item.title || '',
        price: item.price,
        category: item.category,
        wishlistId: item.wishlistId || item.wishlist?.id,
        wishlistTitle: item.wishlistTitle || item.wishlist?.title || item.wishlistName,
        imageUrl: item.imageUrl || item.image || item.photoUrl,
      })) : [];
      setItems(transformedItems);
    } catch (e) {
      console.log('Failed to load reserved gifts:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnreserve = async (giftId: string, giftName: string) => {
    Alert.alert(
      t('reservedGifts.cancelTitle', 'Cancel Reservation'),
      t('reservedGifts.cancelMessage', 'Are you sure you want to cancel your reservation for "{{giftName}}"?', { giftName }),
      [
        { text: t('common.no', 'No'), style: 'cancel' },
        {
          text: t('reservedGifts.confirmCancel', 'Yes, Cancel'),
          style: 'destructive',
          onPress: async () => {
            try {
              const unreserveEndpoint = endpoints.unreserveGift(giftId);
              const apiClient = getApiClient(unreserveEndpoint);
              await apiClient.delete(unreserveEndpoint);
              Alert.alert(t('common.success', 'Success'), t('reservedGifts.cancelled', 'Reservation cancelled'));
              await load();
            } catch (e: any) {
              console.log('Failed to cancel reservation:', e);
              Alert.alert(
                t('common.error', 'Error'), 
                e?.response?.data?.message || t('reservedGifts.cancelFailed', 'Failed to cancel reservation')
              );
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const renderGift = ({ item }: { item: GiftItem }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        {/* Gift Image */}
        {item.imageUrl ? (
          <SafeImage
            source={{ uri: item.imageUrl }}
            style={styles.giftImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.giftImagePlaceholder}>
            <Text style={styles.giftImagePlaceholderText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Gift Info */}
        <View style={styles.giftInfo}>
          <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.category || t('gift.categoryGeneral', 'General')}
              {typeof item.price === 'number' ? ` · $${item.price}` : ''}
            </Text>
          {item.wishlistTitle && (
            <Text style={styles.wishlistInfo}>
              {t('reservedGifts.fromWishlist', 'From: {{wishlistTitle}}', { wishlistTitle: item.wishlistTitle })}
            </Text>
          )}
        </View>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => handleUnreserve(item.id, item.name)}
        >
          <CloseIcon size={18} color={themeColors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderGift}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            tintColor={themeColors.primary}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('reservedGifts.empty', 'No reserved gifts')}</Text>
            <Text style={styles.emptySubtext}>{t('reservedGifts.emptyHint', "Gifts you've reserved will appear here")}</Text>
          </View>
        }
      />
    </View>
  );
};

const createStyles = (theme: string) => {
  const themeColors = theme === 'dark' ? darkColors : lightColors;
  return StyleSheet.create({
    container: { 
      flex: 1, 
      backgroundColor: themeColors.background 
    },
    card: { 
      backgroundColor: themeColors.surface, 
      borderRadius: 16, 
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    giftImage: {
      width: 80,
      height: 80,
      borderRadius: 12,
      backgroundColor: themeColors.muted,
    },
    giftImagePlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 12,
      backgroundColor: themeColors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    giftImagePlaceholderText: {
      fontSize: 32,
      fontWeight: '700',
      color: 'white',
    },
    giftInfo: {
      flex: 1,
    },
    title: { 
      color: themeColors.text, 
      fontSize: 18, 
      fontWeight: '700', 
      marginBottom: 4 
    },
    meta: { 
      color: themeColors.textSecondary, 
      fontSize: 14,
      marginBottom: 4,
    },
    wishlistInfo: {
      color: themeColors.textMuted,
      fontSize: 12,
      fontStyle: 'italic',
      marginTop: 4,
    },
    cancelButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: themeColors.danger + '20',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: themeColors.textSecondary,
      textAlign: 'center',
    },
  });
};


