import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { endpoints, userApi } from '../api/client';

type UserItem = { id: string; username: string; avatarUrl?: string | null };

export const FollowingScreen: React.FC<any> = ({ route }) => {
  const { userId } = route.params as { userId: string };
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await userApi.get(endpoints.following(userId, 1, 50));
      setUsers(res.data || []);
    } catch (e) {
      console.log('Failed to load following:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 12, borderRadius: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: colors.muted },
  username: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sep: { height: 12 },
});


