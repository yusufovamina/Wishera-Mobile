import React, { useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';

interface CreateChoiceModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectGift: () => void;
  onSelectWishlist: () => void;
  onSelectEvent: () => void;
}

export const CreateChoiceModal: React.FC<CreateChoiceModalProps> = ({
  visible,
  onClose,
  onSelectGift,
  onSelectWishlist,
  onSelectEvent,
}) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = useMemo(() => createStyles(), [theme]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Create New</Text>
          <Text style={styles.subtitle}>What would you like to create?</Text>
          
          <View style={styles.optionsContainer}>
            {/* Gift Option */}
            <TouchableOpacity
              style={styles.option}
              onPress={() => {
                onClose();
                onSelectGift();
              }}
            >
              <LinearGradient
                colors={[colors.primary + '20', colors.primary + '10']}
                style={styles.optionGradient}
              >
                <Text style={styles.optionIcon}>🎁</Text>
                <Text style={styles.optionTitle}>Gift</Text>
                <Text style={styles.optionDescription}>Add a gift to a wishlist</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Wishlist Option */}
            <TouchableOpacity
              style={styles.option}
              onPress={() => {
                onClose();
                onSelectWishlist();
              }}
            >
              <LinearGradient
                colors={[colors.primary + '20', colors.primary + '10']}
                style={styles.optionGradient}
              >
                <Text style={styles.optionIcon}>📋</Text>
                <Text style={styles.optionTitle}>Wishlist</Text>
                <Text style={styles.optionDescription}>Create a new wishlist</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Event Option */}
            <TouchableOpacity
              style={styles.option}
              onPress={() => {
                onClose();
                onSelectEvent();
              }}
            >
              <LinearGradient
                colors={[colors.primary + '20', colors.primary + '10']}
                style={styles.optionGradient}
              >
                <Text style={styles.optionIcon}>📅</Text>
                <Text style={styles.optionTitle}>Event</Text>
                <Text style={styles.optionDescription}>Create a new event</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = () => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  optionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  option: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionGradient: {
    padding: 20,
    alignItems: 'center',
  },
  optionIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.muted,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

