import React, { useState } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Modal, ScrollView, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';

interface GiftModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: GiftData) => Promise<void>;
  loading?: boolean;
  gift?: GiftData | null;
  mode: 'create' | 'edit';
}

interface GiftData {
  name: string;
  price: string;
  category: string;
  description: string;
  imageUrl?: string;
  fileUri?: string; // local image uri to upload
}

const GIFT_CATEGORIES = [
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

export const GiftModal: React.FC<GiftModalProps> = ({
  visible,
  onClose,
  onSubmit,
  loading = false,
  gift = null,
  mode,
}) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState<GiftData>({
    name: gift?.name || '',
    price: gift?.price || '',
    category: gift?.category || '',
    description: gift?.description || '',
    imageUrl: gift?.imageUrl || '',
    fileUri: undefined,
  });
  const [errors, setErrors] = useState<Partial<GiftData>>({});

  const validateForm = () => {
    const newErrors: Partial<GiftData> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.price.trim()) {
      newErrors.price = 'Price is required';
    } else if (isNaN(Number(formData.price))) {
      newErrors.price = 'Price must be a valid number';
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
      setFormData({ name: '', price: '', category: '', description: '', imageUrl: '' });
      setErrors({});
    } catch (error) {
      console.log('Error submitting gift:', error);
    }
  };

  const handleClose = () => {
    setFormData({ name: '', price: '', category: '', description: '', imageUrl: '', fileUri: undefined });
    setErrors({});
    onClose();
  };

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo access to attach an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
        aspect: [1, 1],
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setFormData(prev => ({ ...prev, fileUri: asset.uri, imageUrl: asset.uri }));
    } catch (e) {
      console.log('Image pick failed:', e);
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
          <Text style={styles.title}>
            {mode === 'create' ? t('gift.addGift', 'Add Gift') : t('gift.editGift', 'Edit Gift')}
          </Text>
          <TouchableOpacity onPress={handleSubmit} style={styles.createButton} disabled={loading}>
            <Text style={[styles.createButtonText, loading && styles.createButtonDisabled]}>
              {loading ? t('common.saving', 'Saving...') : mode === 'create' ? t('common.add', 'Add') : t('common.save', 'Save')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Gift Image */}
          {formData.imageUrl && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: formData.imageUrl }} style={styles.giftImage} />
            </View>
          )}

          {/* Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('gift.nameLabel', 'Gift Name *')}</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder={t('gift.namePlaceholder', 'Enter gift name')}
              placeholderTextColor={colors.textMuted}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              autoCapitalize="words"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Price Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('gift.priceLabel', 'Price *')}</Text>
            <TextInput
              style={[styles.input, errors.price && styles.inputError]}
              placeholder={t('gift.pricePlaceholder', 'Enter price (e.g., 25.99)')}
              placeholderTextColor={colors.textMuted}
              value={formData.price}
              onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
              keyboardType="numeric"
            />
            {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
          </View>

          {/* Category Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('gift.categoryLabel', 'Category *')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {GIFT_CATEGORIES.map((category) => (
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

          {/* Description Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('gift.descriptionLabel', 'Description')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('gift.descriptionPlaceholder', 'Enter description (optional)')}
              placeholderTextColor={colors.textMuted}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Image Picker */}
          <View style={styles.inputGroup}>
            <TouchableOpacity style={styles.imagePickButton} onPress={pickImage}>
              <Text style={styles.imagePickText}>{formData.fileUri ? t('gift.changeImage', 'Change Image') : t('gift.pickImage', 'Pick Image from Gallery')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  createButton: {
    padding: 8,
  },
  createButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  createButtonDisabled: {
    color: colors.textMuted,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  giftImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: colors.muted,
  },
  imagePickButton: {
    backgroundColor: colors.muted,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  imagePickText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
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
  categoryScroll: {
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.muted,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: 'white',
  },
});
