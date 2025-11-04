import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Modal, ScrollView, Image, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getColors } from '../theme/colors';
import { usePreferences } from '../state/preferences';
import { useI18n } from '../i18n';

interface ProfileEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ProfileData>) => Promise<void>;
  loading?: boolean;
  profile?: ProfileData | null;
}

// Match backend UpdateUserProfileDTO structure
interface ProfileData {
  username?: string;
  bio?: string | null;
  interests?: string[] | null;
  isPrivate: boolean;
  birthday?: string | null;
  avatarUrl?: string | null;
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
}) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const colors = useMemo(() => getColors(), [theme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [formData, setFormData] = useState<ProfileData>({
    username: profile?.username || '',
    bio: profile?.bio ?? null,
    interests: profile?.interests || [],
    isPrivate: profile?.isPrivate ?? false,
    birthday: profile?.birthday ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
  });
  const [errors, setErrors] = useState<Partial<ProfileData>>({});
  const [interestInput, setInterestInput] = useState('');

  const validateForm = () => {
    const newErrors: Partial<ProfileData> = {};
    
    if (!formData.username.trim()) {
      newErrors.username = t('profile.editProfileUsernameRequired', 'Username is required');
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
    setFormData({ username: '', bio: null, interests: [], isPrivate: false, birthday: null, avatarUrl: null });
    setErrors({});
    onClose();
  };

  // Sync modal form with incoming profile when opened or profile changes
  useEffect(() => {
    if (!visible) return;
    setFormData({
      username: profile?.username || '',
      bio: profile?.bio ?? null,
      interests: profile?.interests || [],
      isPrivate: profile?.isPrivate ?? false,
      birthday: profile?.birthday ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
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
            <Text style={styles.closeButtonText}>{t('common.cancel', 'Cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('profile.editProfileTitle', 'Edit Profile')}</Text>
          <TouchableOpacity onPress={handleSubmit} style={styles.saveButton} disabled={loading}>
            <Text style={[styles.saveButtonText, loading && styles.saveButtonDisabled]}>
              {loading ? t('profile.editProfileSaving', 'Saving...') : t('profile.editProfileSave', 'Save')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {formData.avatarUrl ? (
                <Image source={{ uri: formData.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>
                    {formData.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.editAvatarButton}>
              <Text style={styles.editAvatarText}>{t('profile.editProfileEditAvatar', 'Edit Avatar')}</Text>
            </TouchableOpacity>
          </View>

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.editProfileUsername', 'Username *')}</Text>
            <TextInput
              style={[styles.input, errors.username && styles.inputError]}
              placeholder={t('profile.editProfileUsernamePlaceholder', 'Enter username')}
              placeholderTextColor={colors.textMuted}
              value={formData.username}
              onChangeText={(text) => setFormData(prev => ({ ...prev, username: text }))}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
          </View>

          {/* Bio Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.editProfileBio', 'Bio')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('profile.editProfileBioPlaceholder', 'Tell us about yourself...')}
              placeholderTextColor={colors.textMuted}
              value={formData.bio || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text || null }))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Interests */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.editProfileInterests', 'Interests')}</Text>
            
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
                placeholder={t('profile.editProfileInterestsAdd', 'Add interest...')}
                placeholderTextColor={colors.textMuted}
                value={interestInput}
                onChangeText={setInterestInput}
                onSubmitEditing={addInterest}
                autoCapitalize="words"
              />
              <TouchableOpacity onPress={addInterest} style={styles.addInterestButton}>
                <Text style={styles.addInterestButtonText}>{t('common.add', 'Add')}</Text>
              </TouchableOpacity>
            </View>

            {/* Suggested interests */}
            <Text style={styles.suggestedLabel}>{t('profile.editProfileInterestsSuggested', 'Suggested:')}</Text>
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
            <Text style={styles.label}>{t('profile.editProfileBirthday', 'Birthday')}</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={formData.birthday || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, birthday: text || null }))}
            />
          </View>

          {/* Privacy Setting */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.editProfilePrivacy', 'Privacy')}</Text>
            <View style={styles.privacyContainer}>
              <TouchableOpacity
                style={styles.privacyOption}
                onPress={() => setFormData(prev => ({ ...prev, isPrivate: false }))}
              >
                <View style={[styles.radioButton, !formData.isPrivate && styles.radioButtonSelected]}>
                  {!formData.isPrivate && <View style={styles.radioButtonInner} />}
                </View>
                <Text style={styles.privacyText}>{t('profile.editProfilePrivacyPublic', 'Public - Anyone can see your profile')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.privacyOption}
                onPress={() => setFormData(prev => ({ ...prev, isPrivate: true }))}
              >
                <View style={[styles.radioButton, formData.isPrivate && styles.radioButtonSelected]}>
                  {formData.isPrivate && <View style={styles.radioButtonInner} />}
                </View>
                <Text style={styles.privacyText}>{t('profile.editProfilePrivacyPrivate', 'Private - Only followers can see your profile')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
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
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    color: colors.textMuted,
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
    backgroundColor: colors.muted,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
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
    backgroundColor: colors.muted,
  },
  editAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.border,
  },
  inputError: {
    borderColor: colors.danger,
  },
  textArea: {
    height: 100,
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
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
    backgroundColor: colors.primary,
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
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.border,
  },
  addInterestButton: {
    backgroundColor: colors.primary,
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
    color: colors.textSecondary,
    marginBottom: 8,
  },
  suggestedInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestedInterest: {
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  suggestedInterestText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
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
    borderColor: colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: colors.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  privacyText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
});
