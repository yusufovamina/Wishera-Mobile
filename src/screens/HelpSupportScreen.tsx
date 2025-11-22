import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert, Animated, LayoutAnimation, Modal, Dimensions } from 'react-native';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';

type SupportItem = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  contentKey?: string;
  fullContentKey?: string;
  action?: () => void;
  webPath?: string;
  onViewFullContent?: () => void;
};

type ExpandableItemProps = {
  item: SupportItem;
  isExpanded: boolean;
  onToggle: () => void;
  styles: any;
  t: (key: string, fallback?: string) => string;
  handleOpenWebPage: (path: string) => void;
  handleContactSupport: () => void;
  isLast?: boolean;
  onViewFullContent?: () => void;
};

const ExpandableItem: React.FC<ExpandableItemProps> = ({ 
  item, 
  isExpanded, 
  onToggle, 
  styles, 
  t,
  handleOpenWebPage,
  handleContactSupport,
  isLast = false,
  onViewFullContent
}) => {
  const [animation] = useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(animation, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isExpanded]);

  const rotateInterpolate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const maxHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1000],
  });

  const handleItemPress = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };

  const handleAction = () => {
    if (item.id === 'contact') {
      handleContactSupport();
    } else if (item.webPath && onViewFullContent) {
      onViewFullContent();
    } else if (item.action) {
      item.action();
    }
  };

  return (
    <View style={[styles.item, !isLast && styles.itemWithBorder]}>
      <TouchableOpacity
        style={styles.itemHeader}
        onPress={handleItemPress}
        activeOpacity={0.7}
      >
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>{t(item.titleKey)}</Text>
          <Text style={styles.itemDescription}>{t(item.descriptionKey)}</Text>
        </View>
        <Animated.Text 
          style={[
            styles.itemArrow,
            { transform: [{ rotate: rotateInterpolate }] }
          ]}
        >
          ▼
        </Animated.Text>
      </TouchableOpacity>
      
      <Animated.View 
        style={[
          styles.itemExpandedContent,
          { maxHeight, opacity: animation }
        ]}
      >
        <View style={styles.itemExpandedInner}>
          {item.contentKey && (
            <Text style={styles.itemExpandedText}>
              {t(item.contentKey)}
            </Text>
          )}
          <TouchableOpacity
            style={styles.itemActionButton}
            onPress={handleAction}
          >
            <Text style={styles.itemActionButtonText}>
              {item.id === 'contact' 
                ? t('helpSupport.sendEmail', 'Send Email')
                : t('helpSupport.viewFullContent', 'View Full Content')}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

export const HelpSupportScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(), [theme]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string; content: string } | null>(null);

  const handleContactSupport = () => {
    const email = 'wisheraapp@gmail.com';
    const subject = encodeURIComponent('Support Request');
    const mailtoLink = `mailto:${email}?subject=${subject}`;
    
    Linking.canOpenURL(mailtoLink).then(supported => {
      if (supported) {
        Linking.openURL(mailtoLink);
      } else {
        Alert.alert(
          t('helpSupport.emailNotAvailable', 'Email Not Available'),
          t('helpSupport.emailNotAvailableMessage', `Please email us at ${email}`)
        );
      }
    });
  };

  const handleOpenWebPage = (path: string) => {
    const url = `https://wishera.app${path}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert(
          t('common.error', 'Error'),
          t('helpSupport.cannotOpenLink', 'Cannot open link. Please check your internet connection.')
        );
      }
    });
  };

  const toggleItem = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const openFullContentModal = (item: SupportItem) => {
    setModalContent({
      title: t(item.titleKey),
      content: item.fullContentKey ? t(item.fullContentKey) : '',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalContent(null);
  };

  const supportItems: SupportItem[] = [
    {
      id: 'contact',
      titleKey: 'helpSupport.contactSupport',
      descriptionKey: 'helpSupport.contactSupportDescription',
      contentKey: 'helpSupport.contactSupportContent',
      webPath: undefined,
    },
    {
      id: 'privacy',
      titleKey: 'helpSupport.privacyPolicy',
      descriptionKey: 'helpSupport.privacyPolicyDescription',
      contentKey: 'helpSupport.privacyPolicyContent',
      fullContentKey: 'helpSupport.privacyPolicyFull',
      webPath: '/privacy',
    },
    {
      id: 'terms',
      titleKey: 'helpSupport.termsOfService',
      descriptionKey: 'helpSupport.termsOfServiceDescription',
      contentKey: 'helpSupport.termsOfServiceContent',
      fullContentKey: 'helpSupport.termsOfServiceFull',
      webPath: '/terms',
    },
    {
      id: 'cookies',
      titleKey: 'helpSupport.cookiePolicy',
      descriptionKey: 'helpSupport.cookiePolicyDescription',
      contentKey: 'helpSupport.cookiePolicyContent',
      fullContentKey: 'helpSupport.cookiePolicyFull',
      webPath: '/cookies',
    },
    {
      id: 'community',
      titleKey: 'helpSupport.communityGuidelines',
      descriptionKey: 'helpSupport.communityGuidelinesDescription',
      contentKey: 'helpSupport.communityGuidelinesContent',
      fullContentKey: 'helpSupport.communityGuidelinesFull',
      webPath: '/community',
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t('helpSupport.title', 'Help & Support')}</Text>
        <Text style={styles.subtitle}>{t('helpSupport.subtitle', 'Get help and learn more about Wishera')}</Text>

        <View style={styles.section}>
          {supportItems.map((item, index) => (
            <ExpandableItem
              key={item.id}
              item={item}
              isExpanded={expandedItems.has(item.id)}
              onToggle={() => toggleItem(item.id)}
              styles={styles}
              t={t}
              handleOpenWebPage={handleOpenWebPage}
              handleContactSupport={handleContactSupport}
              isLast={index === supportItems.length - 1}
              onViewFullContent={() => openFullContentModal(item)}
            />
          ))}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>{t('helpSupport.needMoreHelp', 'Need More Help?')}</Text>
          <Text style={styles.infoText}>
            {t('helpSupport.needMoreHelpDescription', 'Visit our website for FAQs and more information.')}
          </Text>
          <TouchableOpacity
            style={styles.websiteButton}
            onPress={() => handleOpenWebPage('/about')}
          >
            <Text style={styles.websiteButtonText}>
              {t('helpSupport.visitWebsite', 'Visit Website')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Full Content Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalContent?.title}</Text>
              <TouchableOpacity onPress={closeModal} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
              <Text style={styles.modalText}>{modalContent?.content}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  item: {
    overflow: 'hidden',
  },
  itemWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  itemArrow: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: 12,
  },
  itemExpandedContent: {
    overflow: 'hidden',
  },
  itemExpandedInner: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  itemExpandedText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  itemActionButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  itemActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  infoSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  websiteButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  websiteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.9,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    padding: 20,
  },
  modalText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
  },
});

