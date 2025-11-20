import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, lightColors, darkColors } from '../theme/colors';
import { endpoints, userApi } from '../api/client';
import { usePreferences } from '../state/preferences';

type UserItem = { id: string; username: string; avatarUrl?: string | null };

export const FollowersScreen: React.FC<any> = ({ route, navigation }) => {
  const { userId, title } = route.params as { userId: string; title?: string };
  const { theme } = usePreferences();
  const themeColors = useMemo(() => theme === 'dark' ? darkColors : lightColors, [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await userApi.get(endpoints.followers(userId, 1, 50));
      setUsers(res.data || []);
    } catch (e) {
      console.log('Failed to load followers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={themeColors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row}>
              <Image source={{ uri: item.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=U' }} style={styles.avatar} />
              <Text style={styles.username}>@{item.username}</Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
};

const createStyles = (theme: string) => {
  const themeColors = theme === 'dark' ? darkColors : lightColors;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.surface, padding: 12, borderRadius: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: themeColors.muted },
    username: { color: themeColors.text, fontSize: 16, fontWeight: '600' },
    sep: { height: 12 },
  });
};


