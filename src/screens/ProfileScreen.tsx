import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Image, Animated, Easing, Dimensions, StatusBar, Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { Button } from '../components/Button';
import { ProfileEditModal } from '../components/ProfileEditModal';
import { useAuthStore } from '../state/auth';
import { api, userApi, endpoints } from '../api/client';
import { usePreferences } from '../state/preferences';

const { width, height } = Dimensions.get('window');

type ProfileData = {
  id: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  interests?: string[];
  isPrivate?: boolean;
  birthday?: string;
  followers: any[];
  following: any[];
  myWishlists: any[];
};

export const ProfileScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(), [theme]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
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

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  const handleUpdateProfile = async (data: Partial<ProfileData>) => {
    try {
      setEditLoading(true);
      // Send only provided fields (partial update)
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
      
      // Update local profile state
      setProfile(prev => prev ? {
        ...prev,
        ...(typeof data.username !== 'undefined' ? { username: data.username } : {}),
        ...(typeof data.bio !== 'undefined' ? { bio: data.bio } : {}),
        ...(typeof data.interests !== 'undefined' ? { interests: data.interests } : {}),
        ...(typeof data.isPrivate !== 'undefined' ? { isPrivate: data.isPrivate } : {}),
        ...(typeof data.birthday !== 'undefined' ? { birthday: data.birthday } : {}),
        ...(typeof data.avatarUrl !== 'undefined' ? { avatarUrl: data.avatarUrl } : {}),
      } : null);
      
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
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8, aspect: [1, 1] });
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

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await userApi.get(endpoints.identification);
      setProfile(res.data);
    } catch (error) {
      console.log('Error fetching profile:', error);
      // Use mock data for now
      setProfile({
        id: user?.id || '1',
        username: user?.username || 'user',
        avatarUrl: user?.avatar,
        bio: 'Love creating wishlists and sharing gifts with friends!',
        interests: ['Technology', 'Gaming', 'Music', 'Travel'],
        isPrivate: false,
        birthday: '1990-01-01',
        followers: [],
        following: [],
        myWishlists: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleDeleteAccount = async () => {
    try {
      setEditLoading(true);
      await api.delete(endpoints.deleteAccount);
      await logout();
    } catch (error) {
      console.log('Error deleting account:', error);
    } finally {
      setEditLoading(false);
    }
  };

  const MenuItem = ({ icon, title, subtitle, onPress, danger = false }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuItemContent}>
        <View style={styles.menuItemLeft}>
          <Text style={styles.menuIcon}>{icon}</Text>
          <View>
            <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>{title}</Text>
            {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
          </View>
        </View>
        <Text style={styles.menuArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
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

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeIn,
              transform: [{ translateY: slideUp }],
            },
          ]}
        >
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Image 
                source={{ uri: profile?.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User' }} 
                style={styles.avatar} 
              />
              <TouchableOpacity style={styles.editAvatarButton} onPress={pickAndUploadAvatar}>
                <Text style={styles.editAvatarIcon}>Edit</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.username}>@{profile?.username || 'user'}</Text>
            {profile?.bio && (
              <Text style={styles.bio}>{profile.bio}</Text>
            )}
            
            {/* Stats */}
            <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('UserWishlists', { userId: profile?.id })}>
                <Text style={styles.statNumber}>{profile?.myWishlists?.length || 0}</Text>
                <Text style={styles.statLabel}>Wishlists</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('Followers', { userId: profile?.id })}>
              <Text style={styles.statNumber}>{(profile as any)?.followersCount ?? profile?.followers?.length ?? 0}</Text>
                <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('Following', { userId: profile?.id })}>
              <Text style={styles.statNumber}>{(profile as any)?.followingCount ?? profile?.following?.length ?? 0}</Text>
                <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            </View>
          </View>

          {/* Interests */}
          {profile?.interests && profile.interests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <View style={styles.interestsContainer}>
                {profile.interests.map((interest, index) => (
                  <View key={index} style={styles.interestTag}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Menu Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.account', 'Account')}</Text>
            
            <MenuItem
              icon="Edit"
              title={t('profile.editProfile', 'Edit Profile')}
              subtitle={t('profile.updateInfo', 'Update your information')}
              onPress={() => setShowEditModal(true)}
            />
            
            <MenuItem
              icon="Privacy"
              title={t('profile.privacySettings', 'Privacy Settings')}
              subtitle={t('profile.privacySubtitle', 'Control your privacy')}
              onPress={() => setShowEditModal(true)}
            />
            
            <MenuItem
              icon="Gifts"
              title={t('profile.myWishlists', 'My Wishlists')}
              subtitle={t('profile.manageWishlists', 'Manage your wishlists')}
              onPress={() => navigation.navigate('UserWishlists', { userId: profile?.id })}
            />
            
            <MenuItem
              icon="Bday"
              title={t('profile.birthdaySettings', 'Birthday Settings')}
              subtitle={t('profile.birthdaySubtitle', 'Set your birthday')}
              onPress={() => setShowEditModal(true)}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.support', 'Support')}</Text>
            
            <MenuItem
              icon="Help"
              title={t('profile.help', 'Help & Support')}
              subtitle={t('profile.helpSubtitle', 'Get help and support')}
              onPress={() => Linking.openURL('https://wishera.app/support')}
            />
            
            <MenuItem
              icon="Contact"
              title={t('profile.contact', 'Contact Us')}
              subtitle={t('profile.contactSubtitle', 'Send us feedback')}
              onPress={() => Linking.openURL('mailto:support@wishera.app?subject=Mobile%20Feedback')}
            />
            
            <MenuItem
              icon="About"
              title={t('profile.about', 'About')}
              subtitle={t('profile.aboutSubtitle', 'Learn more about Wishera')}
              onPress={() => Linking.openURL('https://wishera.app/about')}
            />
            <MenuItem
              icon="Settings"
              title={t('profile.settings', 'Settings')}
              subtitle={t('profile.settingsSubtitle', 'Theme and Language')}
              onPress={() => navigation.navigate('Settings')}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.danger', 'Danger Zone')}</Text>
            <MenuItem
              icon="⚠️"
              title={t('profile.deleteAccount', 'Delete Account')}
              subtitle={t('profile.deleteAccountSubtitle', 'This action is irreversible')}
              onPress={handleDeleteAccount}
              danger
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.activity', 'Activity')}</Text>
            <MenuItem
              icon="⭐"
              title={t('profile.likedWishlists', 'Liked Wishlists')}
              subtitle={t('profile.likedWishlistsSubtitle', 'Your liked wishlists')}
              onPress={() => navigation.navigate('LikedWishlists')}
            />
            <MenuItem
              icon="🎁"
              title={t('profile.reservedGifts', 'Reserved Gifts')}
              subtitle={t('profile.reservedGiftsSubtitle', 'Gifts you reserved')}
              onPress={() => navigation.navigate('ReservedGifts')}
            />
            <MenuItem
              icon="📅"
              title={t('profile.myEvents', 'My Events')}
              subtitle={t('profile.myEventsSubtitle', 'Your events')}
              onPress={() => navigation.navigate('MyEvents')}
            />
            <MenuItem
              icon="✉️"
              title={t('profile.invitations', 'Invitations')}
              subtitle={t('profile.invitationsSubtitle', 'Event invitations')}
              onPress={() => navigation.navigate('Invitations')}
            />
          </View>

          {/* Logout Button */}
          <View style={styles.logoutSection}>
            <Button
              title={t('auth.signOut', 'Sign Out')}
              onPress={handleLogout}
              style={styles.logoutButton}
            />
            <View style={{ height: 12 }} />
            <Button
              title="Liked Wishlists"
              onPress={() => navigation.navigate('LikedWishlists')}
            />
            <View style={{ height: 8 }} />
            <Button
              title="Reserved Gifts"
              onPress={() => navigation.navigate('ReservedGifts')}
            />
          </View>
        </Animated.View>
      </ScrollView>

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
  
  // Background blobs
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

  // Scroll view
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 20,
    zIndex: 10,
  },

  // Profile header
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: colors.primary,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },
  editAvatarIcon: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Sections
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    paddingHorizontal: 4,
  },

  // Interests
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: colors.muted,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  interestText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },

  // Menu items
  menuItem: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.muted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  menuTitleDanger: {
    color: colors.danger,
  },
  menuSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '300',
  },

  // Logout section
  logoutSection: {
    marginTop: 20,
    marginBottom: 40,
  },
  logoutButton: {
    backgroundColor: colors.danger,
  },
});


