import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Modal, ScrollView, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { colors, lightColors, darkColors } from '../theme/colors';
import { usePreferences } from '../state/preferences';
import { userApi, endpoints } from '../api/client';

interface ProfileEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ProfileData>) => Promise<void>;
  loading?: boolean;
  profile?: ProfileData | null;
  onAvatarUpdate?: (avatarUrl: string) => void;
}

interface ProfileData {
  username: string;
  bio: string;
  interests: string[];
  isPrivate: boolean;
  birthday: string;
  avatarUrl?: string;
}

const INTEREST_OPTIONS = [
  'Technology', 'Music', 'Sports', 'Travel', 'Food', 'Art', 'Books', 'Movies',
  'Gaming', 'Fashion', 'Photography', 'Fitness', 'Cooking', 'Gardening',
  'Reading', 'Writing', 'Dancing', 'Singing', 'Drawing', 'Painting'
];

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  visible,
  onClose,
  onSubmit,
  loading = false,
  profile = null,
  onAvatarUpdate,
}) => {
  const { theme } = usePreferences();
  const themeColors = useMemo(() => theme === 'dark' ? darkColors : lightColors, [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [formData, setFormData] = useState<ProfileData>({
    username: profile?.username || '',
    bio: profile?.bio || '',
    interests: profile?.interests || [],
    isPrivate: profile?.isPrivate || false,
    birthday: profile?.birthday || '',
    avatarUrl: profile?.avatarUrl || '',
  });
  const [errors, setErrors] = useState<Partial<ProfileData>>({});
  const [interestInput, setInterestInput] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  const validateForm = () => {
    const newErrors: Partial<ProfileData> = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      // Compute partial update: include only fields that changed
      const update: Partial<ProfileData> = {};
      if (formData.username !== (profile?.username || '')) update.username = formData.username;
      if (formData.bio !== (profile?.bio || '')) update.bio = formData.bio;
      // Interests: compare shallow
      const prevInterests = profile?.interests || [];
      const interestsChanged = prevInterests.length !== formData.interests.length || prevInterests.some((i, idx) => i !== formData.interests[idx]);
      if (interestsChanged) update.interests = formData.interests;
      if (formData.isPrivate !== (profile?.isPrivate || false)) update.isPrivate = formData.isPrivate;
      if (formData.birthday !== (profile?.birthday || '')) update.birthday = formData.birthday;
      if (formData.avatarUrl !== (profile?.avatarUrl || '')) update.avatarUrl = formData.avatarUrl;

      await onSubmit(update);
      setErrors({});
    } catch (error) {
      console.log('Error updating profile:', error);
    }
  };

  const handleClose = () => {
    setFormData({ username: '', bio: '', interests: [], isPrivate: false, birthday: '', avatarUrl: '' });
    setErrors({});
    onClose();
  };

  // Sync modal form with incoming profile when opened or profile changes
  useEffect(() => {
    if (!visible) return;
    setFormData({
      username: profile?.username || '',
      bio: profile?.bio || '',
      interests: profile?.interests || [],
      isPrivate: profile?.isPrivate || false,
      birthday: profile?.birthday || '',
      avatarUrl: profile?.avatarUrl || '',
    });
  }, [visible, profile?.username, profile?.bio, profile?.isPrivate, profile?.birthday, profile?.avatarUrl, (profile?.interests || []).join('|')]);

  const addInterest = () => {
    if (interestInput.trim() && !formData.interests.includes(interestInput.trim())) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, interestInput.trim()]
      }));
      setInterestInput('');
    }
  };

  const removeInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest)
    }));
  };

  const addSuggestedInterest = (interest: string) => {
    if (!formData.interests.includes(interest)) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, interest]
      }));
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

      setAvatarUploading(true);
      const form = new FormData();
      
      // For web platform, we need to fetch the file and create a Blob
      if (Platform.OS === 'web') {
        try {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          form.append('file', blob, 'avatar.jpg');
        } catch (error) {
          console.log('Error creating blob from URI:', error);
          // Fallback: try to use the URI directly if it's already a blob URL
          const file = asset as any;
          if (file.file) {
            form.append('file', file.file, 'avatar.jpg');
          } else {
            throw new Error('Unable to create file for upload');
          }
        }
      } else {
        // For mobile platforms
        form.append('file', {
          uri: asset.uri,
          name: 'avatar.jpg',
          type: 'image/jpeg',
        } as any);
      }
      
      const res = await userApi.post(endpoints.uploadAvatar, form, {
        headers: Platform.OS === 'web' 
          ? {} // Let browser set Content-Type with boundary for web
          : { 'Content-Type': 'multipart/form-data' },
      });
      console.log('Avatar upload response:', res.data);
      const newUrl = res.data?.avatarUrl || res.data?.url || res.data?.data?.avatarUrl || res.data?.data?.url || asset.uri;
      console.log('Setting avatar URL to:', newUrl);
      
      // Update form data
      setFormData(prev => {
        const updated = { ...prev, avatarUrl: newUrl };
        console.log('Updated formData:', updated);
        return updated;
      });
      
      // Immediately update profile if callback provided
      if (onAvatarUpdate) {
        onAvatarUpdate(newUrl);
      }
      
      // Also save immediately to update profile
      try {
        await onSubmit({ avatarUrl: newUrl });
      } catch (e) {
        console.log('Error saving avatar URL:', e);
      }
    } catch (e) {
      console.log('Avatar upload failed:', e);
      Alert.alert('Upload failed', 'Could not upload avatar. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSubmit} style={styles.saveButton} disabled={loading}>
            <Text style={[styles.saveButtonText, loading && styles.saveButtonDisabled]}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {formData.avatarUrl ? (
                <Image 
                  source={{ uri: formData.avatarUrl }} 
                  style={styles.avatar}
                  key={formData.avatarUrl}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>
                    {formData.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity 
              style={styles.editAvatarButton} 
              onPress={pickAndUploadAvatar}
              disabled={avatarUploading}
            >
              {avatarUploading ? (
                <View>
                  <ActivityIndicator size="small" color={themeColors.primary} />
                </View>
              ) : (
                <Text style={styles.editAvatarText}>Edit Avatar</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username *</Text>
            <TextInput
              style={[styles.input, errors.username && styles.inputError]}
              placeholder="Enter username"
              placeholderTextColor={themeColors.textMuted}
              value={formData.username}
              onChangeText={(text) => setFormData(prev => ({ ...prev, username: text }))}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
          </View>

          {/* Bio Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us about yourself..."
              placeholderTextColor={themeColors.textMuted}
              value={formData.bio}
              onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Interests */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Interests</Text>
            
            {/* Current interests */}
            {formData.interests.length > 0 && (
              <View style={styles.interestsContainer}>
                {formData.interests.map((interest, index) => (
                  <View key={index} style={styles.interestChip}>
                    <Text style={styles.interestChipText}>{interest}</Text>
                    <TouchableOpacity onPress={() => removeInterest(interest)}>
                      <Text style={styles.interestRemove}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Add interest input */}
            <View style={styles.addInterestContainer}>
              <TextInput
                style={styles.interestInput}
                placeholder="Add interest..."
                placeholderTextColor={themeColors.textMuted}
                value={interestInput}
                onChangeText={setInterestInput}
                onSubmitEditing={addInterest}
                autoCapitalize="words"
              />
              <TouchableOpacity onPress={addInterest} style={styles.addInterestButton}>
                <Text style={styles.addInterestButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* Suggested interests */}
            <Text style={styles.suggestedLabel}>Suggested:</Text>
            <View style={styles.suggestedInterests}>
              {INTEREST_OPTIONS.filter(interest => !formData.interests.includes(interest)).slice(0, 10).map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={styles.suggestedInterest}
                  onPress={() => addSuggestedInterest(interest)}
                >
                  <Text style={styles.suggestedInterestText}>{interest}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Birthday */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Birthday</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={themeColors.textMuted}
              value={formData.birthday}
              onChangeText={(text) => setFormData(prev => ({ ...prev, birthday: text }))}
            />
          </View>

          {/* Privacy Setting */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Privacy</Text>
            <View style={styles.privacyContainer}>
              <TouchableOpacity
                style={styles.privacyOption}
                onPress={() => setFormData(prev => ({ ...prev, isPrivate: false }))}
              >
                <View style={[styles.radioButton, !formData.isPrivate && styles.radioButtonSelected]}>
                  {!formData.isPrivate && <View style={styles.radioButtonInner} />}
                </View>
                <Text style={styles.privacyText}>Public - Anyone can see your profile</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.privacyOption}
                onPress={() => setFormData(prev => ({ ...prev, isPrivate: true }))}
              >
                <View style={[styles.radioButton, formData.isPrivate && styles.radioButtonSelected]}>
                  {formData.isPrivate && <View style={styles.radioButtonInner} />}
                </View>
                <Text style={styles.privacyText}>Private - Only followers can see your profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const createStyles = (theme: string) => {
  const themeColors = theme === 'dark' ? darkColors : lightColors;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 16,
      color: themeColors.textSecondary,
      fontWeight: '500',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: themeColors.text,
    },
    saveButton: {
      padding: 8,
    },
    saveButtonText: {
      fontSize: 16,
      color: themeColors.primary,
      fontWeight: '600',
    },
    saveButtonDisabled: {
      color: themeColors.textMuted,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    avatarSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    avatarContainer: {
      marginBottom: 12,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: themeColors.muted,
    },
    avatarPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: themeColors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarPlaceholderText: {
      fontSize: 32,
      fontWeight: '700',
      color: 'white',
    },
    editAvatarButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: themeColors.muted,
    },
    editAvatarText: {
      fontSize: 14,
      fontWeight: '600',
      color: themeColors.primary,
    },
    inputGroup: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: themeColors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: themeColors.text,
      borderWidth: 2,
      borderColor: themeColors.border,
    },
    inputError: {
      borderColor: themeColors.danger,
    },
    textArea: {
      height: 100,
    },
    errorText: {
      fontSize: 14,
      color: themeColors.danger,
      marginTop: 4,
    },
    interestsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    interestChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 6,
    },
    interestChipText: {
      fontSize: 14,
      fontWeight: '500',
      color: 'white',
    },
    interestRemove: {
      fontSize: 16,
      fontWeight: '700',
      color: 'white',
    },
    addInterestContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    interestInput: {
      flex: 1,
      backgroundColor: themeColors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: themeColors.text,
      borderWidth: 2,
      borderColor: themeColors.border,
    },
    addInterestButton: {
      backgroundColor: themeColors.primary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      justifyContent: 'center',
    },
    addInterestButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: 'white',
    },
    suggestedLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: themeColors.textSecondary,
      marginBottom: 8,
    },
    suggestedInterests: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    suggestedInterest: {
      backgroundColor: themeColors.muted,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    suggestedInterestText: {
      fontSize: 14,
      fontWeight: '500',
      color: themeColors.textSecondary,
    },
    privacyContainer: {
      marginTop: 8,
    },
    privacyOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    radioButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: themeColors.border,
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioButtonSelected: {
      borderColor: themeColors.primary,
    },
    radioButtonInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: themeColors.primary,
    },
    privacyText: {
      fontSize: 16,
      color: themeColors.text,
      flex: 1,
    },
  });
};
