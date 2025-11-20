import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { colors, lightColors, darkColors } from '../theme/colors';
import { endpoints, wishlistApi } from '../api/client';
import { usePreferences } from '../state/preferences';

type WishlistFeedItem = { id: string; title: string; description?: string | null };

export const UserWishlistsScreen: React.FC<any> = ({ route, navigation }) => {
  const { userId } = route.params as { userId: string };
  const { theme } = usePreferences();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WishlistFeedItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await wishlistApi.get(endpoints.userWishlists(userId, 1, 50));
      setItems(res.data || []);
    } catch (e) {
      console.log('Failed to load user wishlists:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WishlistDetail', { id: item.id })}>
            <Text style={styles.title}>{item.title}</Text>
            {!!item.description && <Text style={styles.desc}>{item.description}</Text>}
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{ padding: 16 }}
        refreshing={loading}
        onRefresh={load}
      />
    </View>
  );
};

const createStyles = (theme: string) => {
  const themeColors = theme === 'dark' ? darkColors : lightColors;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    card: { backgroundColor: themeColors.surface, borderRadius: 12, padding: 12 },
    title: { color: themeColors.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
    desc: { color: themeColors.textSecondary, fontSize: 14 },
  });
};


