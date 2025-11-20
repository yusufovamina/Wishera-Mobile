import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { colors, lightColors, darkColors } from '../theme/colors';
import { usePreferences } from '../state/preferences';

interface EditWishlistModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: EditWishlistData) => Promise<void>;
  wishlist: {
    id: string;
    title: string;
    description?: string;
    category?: string;
    isPublic?: boolean;
  } | null;
  loading?: boolean;
}

interface EditWishlistData {
  title: string;
  description: string;
  category: string;
  isPublic: boolean;
}

const WISHLIST_CATEGORIES = [
  'Electronics',
  'Books',
  'Clothing',
  'Home & Garden',
  'Sports & Outdoors',
  'Beauty & Personal Care',
  'Toys & Games',
  'Food & Beverages',
  'Health & Wellness',
  'Automotive',
  'Travel',
  'Music',
  'Movies & TV',
  'Art & Crafts',
  'Jewelry & Accessories',
  'Pet Supplies',
  'Office & School',
  'Baby & Kids',
  'Other'
];

export const EditWishlistModal: React.FC<EditWishlistModalProps> = ({
  visible,
  onClose,
  onSubmit,
  wishlist,
  loading = false,
}) => {
  const { theme } = usePreferences();
  const themeColors = useMemo(() => theme === 'dark' ? darkColors : lightColors, [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [formData, setFormData] = useState<EditWishlistData>({
    title: '',
    description: '',
    category: '',
    isPublic: true,
  });
  const [errors, setErrors] = useState<Partial<EditWishlistData>>({});

  useEffect(() => {
    if (visible && wishlist) {
      // Update form data when modal opens with wishlist data
      setFormData({
        title: wishlist.title || '',
        description: wishlist.description || '',
        category: wishlist.category || '',
        isPublic: wishlist.isPublic !== undefined ? wishlist.isPublic : true,
      });
    } else if (visible && !wishlist) {
      // Reset form if modal opens without wishlist
      setFormData({
        title: '',
        description: '',
        category: '',
        isPublic: true,
      });
    }
  }, [wishlist, visible]);

  const validateForm = () => {
    const newErrors: Partial<EditWishlistData> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      await onSubmit(formData);
      setErrors({});
    } catch (error) {
      console.log('Error updating wishlist:', error);
    }
  };

  const handleClose = () => {
    if (wishlist) {
      setFormData({
        title: wishlist.title || '',
        description: wishlist.description || '',
        category: wishlist.category || '',
        isPublic: wishlist.isPublic !== undefined ? wishlist.isPublic : true,
      });
    }
    setErrors({});
    onClose();
  };

  if (!wishlist) return null;

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
          <Text style={styles.title}>Edit Wishlist</Text>
          <TouchableOpacity onPress={handleSubmit} style={styles.saveButton} disabled={loading}>
            <Text style={[styles.saveButtonText, loading && styles.saveButtonDisabled]}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Title Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="Enter wishlist title"
              placeholderTextColor={themeColors.textMuted}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              autoCapitalize="words"
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
          </View>

          {/* Description Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter description (optional)"
              placeholderTextColor={themeColors.textMuted}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Category Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {WISHLIST_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    formData.category === category && styles.categoryChipSelected,
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, category }))}
                >
                  <Text style={[
                    styles.categoryChipText,
                    formData.category === category && styles.categoryChipTextSelected,
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
          </View>

          {/* Privacy Setting */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Privacy</Text>
            <View style={styles.privacyContainer}>
              <TouchableOpacity
                style={styles.privacyOption}
                onPress={() => setFormData(prev => ({ ...prev, isPublic: true }))}
              >
                <View style={[styles.radioButton, formData.isPublic && styles.radioButtonSelected]}>
                  {formData.isPublic && <View style={styles.radioButtonInner} />}
                </View>
                <Text style={styles.privacyText}>Public - Anyone can see this wishlist</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.privacyOption}
                onPress={() => setFormData(prev => ({ ...prev, isPublic: false }))}
              >
                <View style={[styles.radioButton, !formData.isPublic && styles.radioButtonSelected]}>
                  {!formData.isPublic && <View style={styles.radioButtonInner} />}
                </View>
                <Text style={styles.privacyText}>Private - Only you can see this wishlist</Text>
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
    categoryScroll: {
      marginTop: 8,
    },
    categoryChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: themeColors.muted,
      marginRight: 8,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    categoryChipSelected: {
      backgroundColor: themeColors.primary,
      borderColor: themeColors.primary,
    },
    categoryChipText: {
      fontSize: 14,
      fontWeight: '500',
      color: themeColors.textSecondary,
    },
    categoryChipTextSelected: {
      color: 'white',
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

