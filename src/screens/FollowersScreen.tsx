import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { getColors } from '../theme/colors';
import { usePreferences } from '../state/preferences';
import { endpoints, userApi } from '../api/client';
import { useAuthStore } from '../state/auth';
import { useI18n } from '../i18n';

// Match backend UserSearchDTO structure
type UserItem = { 
  id: string; 
  username: string; 
  avatarUrl?: string | null;
  isFollowing?: boolean;
};

export const FollowersScreen: React.FC<any> = ({ route, navigation }) => {
  const { t } = useI18n();
  const { userId, title } = route.params as { userId: string; title?: string };
  const { theme } = usePreferences();
  const colors = useMemo(() => getColors(), [theme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserItem[]>([]);
  const { user: currentUser } = useAuthStore();
  const isOwnProfile = !userId || userId === currentUser?.id;

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

  const handleFollow = async (targetUserId: string) => {
    try {
      await userApi.post(endpoints.followUser(targetUserId));
      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, isFollowing: true } : u
      ));
    } catch (error) {
      console.log('Error following user:', error);
      Alert.alert(t('common.error', 'Error'), t('profile.followError', 'Failed to follow user'));
    }
  };

  const handleUnfollow = async (targetUserId: string) => {
    try {
      await userApi.delete(endpoints.unfollowUser(targetUserId));
      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, isFollowing: false } : u
      ));
    } catch (error) {
      console.log('Error unfollowing user:', error);
      Alert.alert(t('common.error', 'Error'), t('profile.unfollowError', 'Failed to unfollow user'));
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
            <TouchableOpacity 
              style={styles.row}
              onPress={() => navigation.navigate('Profile', { userId: item.id })}
            >
              <Image 
                source={{ uri: item.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${item.username}` }} 
                style={styles.avatar} 
              />
              <View style={styles.userInfo}>
                <Text style={styles.username}>@{item.username}</Text>
              </View>
              {!isOwnProfile && currentUser?.id !== item.id && (
                <TouchableOpacity
                  style={item.isFollowing ? styles.unfollowButton : styles.followButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    if (item.isFollowing) {
                      handleUnfollow(item.id);
                    } else {
                      handleFollow(item.id);
                    }
                  }}
                >
                  <Text style={item.isFollowing ? styles.unfollowButtonText : styles.followButtonText}>
                    {item.isFollowing ? t('profile.unfollow', 'Unfollow') : t('profile.follow', 'Follow')}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('profile.noFollowers', 'No followers yet')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.surface, 
    padding: 12, 
    borderRadius: 12 
  },
  avatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    marginRight: 12, 
    backgroundColor: colors.muted 
  },
  userInfo: {
    flex: 1,
  },
  username: { 
    color: colors.text, 
    fontSize: 16, 
    fontWeight: '600' 
  },
  followButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  unfollowButton: {
    backgroundColor: colors.muted,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unfollowButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  sep: { height: 12 },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
  },
});


