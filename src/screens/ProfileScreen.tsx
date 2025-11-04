import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Image, Animated, Easing, Dimensions, StatusBar, Alert, Linking, Modal, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { Button } from '../components/Button';
import { ProfileEditModal } from '../components/ProfileEditModal';
import { useAuthStore } from '../state/auth';
import { api, userApi, endpoints } from '../api/client';
import { usePreferences } from '../state/preferences';
import { getColors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

// Match backend UserProfileDTO structure
type ProfileData = {
  id: string;
  username: string;
  email: string;
  bio?: string | null;
  interests?: string[] | null;
  avatarUrl?: string | null;
  birthday?: string | null;
  createdAt: string;
  followingCount: number;
  followersCount: number;
  wishlistCount: number;
  isPrivate: boolean;
  isFollowing: boolean;
};

export const ProfileScreen: React.FC<any> = ({ navigation, route }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const colors = React.useMemo(() => getColors(), [theme]);
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteUsernameInput, setDeleteUsernameInput] = useState('');
  const [deleteStep, setDeleteStep] = useState<'warning' | 'username' | 'final'>('warning');
  const { user, logout } = useAuthStore();
  
  // Support viewing other users' profiles via route params
  const viewUserId = route?.params?.userId;
  const isOwnProfile = !viewUserId || viewUserId === user?.id;
  
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
  }, [user?.id, viewUserId]);

  const handleUpdateProfile = async (data: Partial<ProfileData>) => {
    try {
      setEditLoading(true);
      // Match backend UpdateUserProfileDTO structure
      const payload: any = {};
      if (typeof data.username !== 'undefined') payload.username = data.username;
      if (typeof data.bio !== 'undefined') payload.bio = data.bio;
      if (typeof data.interests !== 'undefined') payload.interests = data.interests;
      if (typeof data.isPrivate !== 'undefined') payload.isPrivate = data.isPrivate;
      if (typeof data.birthday !== 'undefined') payload.birthday = data.birthday;

      // Backend accepts birthday in the same updateProfile call
      if (Object.keys(payload).length > 0) {
        const updatedProfile = await userApi.put(endpoints.updateProfile, payload);
        // Backend returns updated UserProfileDTO
        if (updatedProfile.data) {
          const profileData: ProfileData = {
            id: updatedProfile.data.id || profile?.id || '',
            username: updatedProfile.data.username || profile?.username || '',
            email: updatedProfile.data.email || profile?.email || '',
            bio: updatedProfile.data.bio ?? null,
            interests: updatedProfile.data.interests || [],
            avatarUrl: updatedProfile.data.avatarUrl ?? null,
            birthday: updatedProfile.data.birthday ?? null,
            createdAt: updatedProfile.data.createdAt || profile?.createdAt || new Date().toISOString(),
            followingCount: updatedProfile.data.followingCount ?? profile?.followingCount ?? 0,
            followersCount: updatedProfile.data.followersCount ?? profile?.followersCount ?? 0,
            wishlistCount: updatedProfile.data.wishlistCount ?? profile?.wishlistCount ?? 0,
            isPrivate: updatedProfile.data.isPrivate ?? false,
            isFollowing: updatedProfile.data.isFollowing ?? profile?.isFollowing ?? false,
          };
          setProfile(profileData);
        }
      }
      
      setShowEditModal(false);
    } catch (error) {
      console.log('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
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
      // Backend returns { avatarUrl: string }
      // Refresh profile to get updated data with counts
      await fetchProfile();
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
      let res;
      
      // If viewing another user's profile, use GET /api/users/{id}
      // Otherwise use GET /api/users/profile for current user
      if (viewUserId && viewUserId !== user?.id) {
        res = await userApi.get(endpoints.getUserProfile(viewUserId));
      } else {
        res = await userApi.get(endpoints.identification);
      }
      
      // Backend returns UserProfileDTO structure
      const profileData: ProfileData = {
        id: res.data.id || res.data.userId || user?.id || '',
        username: res.data.username || user?.username || '',
        email: res.data.email || '',
        bio: res.data.bio ?? null,
        interests: res.data.interests || [],
        avatarUrl: (res.data.avatarUrl || res.data.avatar) ?? null,
        birthday: res.data.birthday ?? null,
        createdAt: res.data.createdAt || new Date().toISOString(),
        followingCount: res.data.followingCount ?? 0,
        followersCount: res.data.followersCount ?? 0,
        wishlistCount: res.data.wishlistCount ?? 0,
        isPrivate: res.data.isPrivate ?? false,
        isFollowing: res.data.isFollowing ?? false,
      };
      setProfile(profileData);
    } catch (error) {
      console.log('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleFollow = async () => {
    if (!profile?.id) return;
    try {
      await userApi.post(endpoints.followUser(profile.id));
      // Refresh profile to get updated isFollowing and counts
      await fetchProfile();
    } catch (error) {
      console.log('Error following user:', error);
      Alert.alert(t('common.error', 'Error'), t('profile.followError', 'Failed to follow user'));
    }
  };

  const handleUnfollow = async () => {
    if (!profile?.id) return;
    try {
      await userApi.delete(endpoints.unfollowUser(profile.id));
      // Refresh profile to get updated isFollowing and counts
      await fetchProfile();
    } catch (error) {
      console.log('Error unfollowing user:', error);
      Alert.alert(t('common.error', 'Error'), t('profile.unfollowError', 'Failed to unfollow user'));
    }
  };

  const handleDeleteAccount = () => {
    // Step 1: Show initial warning
    setDeleteStep('warning');
    setShowDeleteConfirm(true);
  };

  const handleDeleteWarningConfirm = () => {
    // Step 2: Ask for username confirmation
    setDeleteStep('username');
    setDeleteUsernameInput('');
  };

  const handleDeleteUsernameConfirm = () => {
    // Verify username matches
    if (deleteUsernameInput.trim() !== profile?.username?.trim()) {
      Alert.alert(t('common.error', 'Error'), t('profile.deleteAccountUsernameMismatch', 'Username does not match. Please try again.'));
      setDeleteUsernameInput('');
      return;
    }
    // Step 3: Final confirmation
    setDeleteStep('final');
  };

  const handleDeleteFinalConfirm = async () => {
    try {
      setEditLoading(true);
      await api.delete(endpoints.deleteAccount);
      Alert.alert(t('common.success', 'Success'), t('profile.deleteAccountSuccess', 'Your account has been deleted.'));
      await logout();
    } catch (error: any) {
      console.log('Error deleting account:', error);
      Alert.alert(
        t('common.error', 'Error'), 
        error.response?.data?.message || t('profile.deleteAccountError', 'Failed to delete account. Please try again later.')
      );
    } finally {
      setEditLoading(false);
      setShowDeleteConfirm(false);
      setDeleteStep('warning');
      setDeleteUsernameInput('');
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setDeleteStep('warning');
    setDeleteUsernameInput('');
  };

  const MenuItem = ({ icon, title, subtitle, onPress, danger = false }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    danger?: boolean;
  }) => {
    return (
      <TouchableOpacity style={styles.menuItem} onPress={onPress}>
        <View style={styles.menuItemContent}>
          <View style={styles.menuItemLeft}>
            <Text style={styles.menuIcon}>{icon}</Text>
            <View>
              <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>{title}</Text>
              {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
            </View>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

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
              {isOwnProfile && (
                <TouchableOpacity style={styles.editAvatarButton} onPress={pickAndUploadAvatar}>
                      <Text style={styles.editAvatarIcon}>{t('profile.edit', 'Edit')}</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <Text style={styles.username}>@{profile?.username || 'user'}</Text>
            {profile?.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : null}
            
            {/* Follow/Unfollow button for other users' profiles */}
            {!isOwnProfile && profile && (
              <View style={styles.followButtonContainer}>
                {profile.isFollowing ? (
                  <TouchableOpacity style={styles.unfollowButton} onPress={handleUnfollow}>
                    <Text style={styles.unfollowButtonText}>{t('profile.unfollow', 'Unfollow')}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.followButton} onPress={handleFollow}>
                    <Text style={styles.followButtonText}>{t('profile.follow', 'Follow')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            
            {/* Stats */}
            <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('UserWishlists', { userId: profile?.id })}>
              <Text style={styles.statNumber}>{profile?.wishlistCount ?? 0}</Text>
              <Text style={styles.statLabel}>{t('profile.wishlists', 'Wishlists')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('Followers', { userId: profile?.id })}>
              <Text style={styles.statNumber}>{profile?.followersCount ?? 0}</Text>
              <Text style={styles.statLabel}>{t('profile.followers', 'Followers')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('Following', { userId: profile?.id })}>
              <Text style={styles.statNumber}>{profile?.followingCount ?? 0}</Text>
              <Text style={styles.statLabel}>{t('profile.following', 'Following')}</Text>
            </TouchableOpacity>
            </View>
          </View>

          {/* Interests */}
          {profile?.interests && profile.interests.length > 0 ? (
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
          ) : null}

          {/* Menu Items - Only show for own profile */}
          {isOwnProfile && (
            <>
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
              </View>
            </>
          )}
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

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={handleDeleteCancel}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            {deleteStep === 'warning' && (
              <>
                <Text style={styles.deleteModalTitle}>⚠️ {t('profile.deleteAccountWarning', 'Delete Account')}</Text>
                <Text style={styles.deleteModalText}>
                  {t('profile.deleteAccountWarningText', 'Are you sure you want to delete your account? This action cannot be undone. All your data, wishlists, and information will be permanently deleted.')}
                </Text>
                <View style={styles.deleteModalButtons}>
                  <TouchableOpacity style={styles.deleteModalCancelButton} onPress={handleDeleteCancel}>
                    <Text style={styles.deleteModalCancelText}>{t('common.cancel', 'Cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteModalContinueButton} onPress={handleDeleteWarningConfirm}>
                    <Text style={styles.deleteModalContinueText}>{t('common.continue', 'Continue')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {deleteStep === 'username' && (
              <>
                <Text style={styles.deleteModalTitle}>{t('profile.deleteAccountConfirmUsername', 'Confirm Username')}</Text>
                <Text style={styles.deleteModalText}>
                  {t('profile.deleteAccountConfirmUsernameText', 'To confirm deletion, please enter your username:')} <Text style={styles.deleteModalUsername}>{profile?.username}</Text>
                </Text>
                <TextInput
                  style={styles.deleteModalInput}
                  placeholder={t('profile.deleteAccountUsernamePlaceholder', 'Enter username')}
                  placeholderTextColor={colors.textMuted}
                  value={deleteUsernameInput}
                  onChangeText={setDeleteUsernameInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.deleteModalButtons}>
                  <TouchableOpacity style={styles.deleteModalCancelButton} onPress={handleDeleteCancel}>
                    <Text style={styles.deleteModalCancelText}>{t('common.cancel', 'Cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.deleteModalContinueButton, !deleteUsernameInput.trim() && styles.deleteModalContinueButtonDisabled]} 
                    onPress={handleDeleteUsernameConfirm}
                    disabled={!deleteUsernameInput.trim()}
                  >
                    <Text style={styles.deleteModalContinueText}>{t('common.continue', 'Continue')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {deleteStep === 'final' && (
              <>
                <Text style={styles.deleteModalTitle}>⚠️ {t('profile.deleteAccountFinalConfirmation', 'Final Confirmation')}</Text>
                <Text style={styles.deleteModalText}>
                  {t('profile.deleteAccountFinalText', 'This is your last chance to cancel. Once you confirm, your account will be permanently deleted and cannot be recovered.')}
                </Text>
                <Text style={[styles.deleteModalText, styles.deleteModalWarning]}>
                  {t('profile.deleteAccountFinalQuestion', 'Are you absolutely sure you want to delete your account?')}
                </Text>
                <View style={styles.deleteModalButtons}>
                  <TouchableOpacity style={styles.deleteModalCancelButton} onPress={handleDeleteCancel}>
                    <Text style={styles.deleteModalCancelText}>{t('common.cancel', 'Cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.deleteModalContinueButton, styles.deleteModalDangerButton]} 
                    onPress={handleDeleteFinalConfirm}
                    disabled={editLoading}
                  >
                    <Text style={styles.deleteModalContinueText}>
                      {editLoading ? t('profile.deleteAccountDeleting', 'Deleting...') : t('profile.deleteAccountConfirm', 'Yes, Delete My Account')}
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

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
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

  // Follow/Unfollow buttons
  followButtonContainer: {
    marginTop: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  followButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  unfollowButton: {
    backgroundColor: colors.muted,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  unfollowButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },

  // Logout section
  logoutSection: {
    marginTop: 20,
    marginBottom: 40,
  },
  logoutButton: {
    backgroundColor: colors.danger,
  },

  // Delete confirmation modal
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
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  deleteModalText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  deleteModalUsername: {
    fontWeight: '700',
    color: colors.text,
  },
  deleteModalWarning: {
    color: colors.danger,
    fontWeight: '600',
    marginTop: 8,
  },
  deleteModalInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  deleteModalCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.muted,
  },
  deleteModalCancelText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteModalContinueButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  deleteModalContinueButtonDisabled: {
    opacity: 0.5,
  },
  deleteModalContinueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteModalDangerButton: {
    backgroundColor: colors.danger,
  },
});


