import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated, Easing, StatusBar, Dimensions, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useAuthStore } from '../state/auth';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreferences } from '../state/preferences';

const { width, height } = Dimensions.get('window');

type Props = NativeStackScreenProps<any>;

export const ResetPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(), [theme]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { resetPassword, loading, error } = useAuthStore();
  const [success, setSuccess] = useState(false);
  
  // Get token from route params or query string
  const token = route?.params?.token || '';
  
  const floatY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!token) {
      Alert.alert(t('auth.error', 'Error'), t('auth.invalidResetToken', 'Invalid reset token. Please request a new password reset.'));
      navigation.navigate('ForgotPassword');
      return;
    }

    // Floating blobs animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { 
          toValue: 20, 
          duration: 8000, 
          easing: Easing.inOut(Easing.sin), 
          useNativeDriver: true 
        }),
        Animated.timing(floatY, { 
          toValue: -20, 
          duration: 8000, 
          easing: Easing.inOut(Easing.sin), 
          useNativeDriver: true 
        }),
      ])
    ).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { 
          toValue: 1, 
          duration: 3000, 
          easing: Easing.inOut(Easing.sin), 
          useNativeDriver: true 
        }),
        Animated.timing(pulse, { 
          toValue: 0, 
          duration: 3000, 
          easing: Easing.inOut(Easing.sin), 
          useNativeDriver: true 
        }),
      ])
    ).start();

    // Fade in
    Animated.timing(fadeIn, { 
      toValue: 1, 
      duration: 800, 
      easing: Easing.out(Easing.cubic), 
      useNativeDriver: true 
    }).start();
  }, [floatY, pulse, fadeIn, token, navigation, t]);

  const handleSubmit = async () => {
    if (!password.trim()) {
      Alert.alert(t('auth.error', 'Error'), t('auth.passwordRequired', 'Please enter a new password'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('auth.error', 'Error'), t('auth.passwordsDoNotMatch', 'Passwords do not match'));
      return;
    }

    if (password.length < 8) {
      Alert.alert(t('auth.error', 'Error'), t('auth.passwordTooShort', 'Password must be at least 8 characters long'));
      return;
    }

    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (e) {
      // Error is handled by the store
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        
        <View style={styles.blobContainer} pointerEvents="none">
          <Animated.View
            style={[
              styles.blob,
              styles.blob1,
              {
                transform: [{ translateY: floatY }],
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.4] })
              }
            ]}
          />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, { opacity: fadeIn }]}>
            <View style={styles.header}>
              <Text style={styles.title}>{t('auth.passwordResetSuccess', 'Password Reset!')}</Text>
              <Text style={styles.subtitle}>
                {t('auth.passwordResetSuccessMessage', 'Your password has been reset successfully. You can now login with your new password.')}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.buttonContainer}>
                <Button 
                  title={t('auth.backToLogin', 'Back to Login')} 
                  onPress={() => navigation.navigate('Login')} 
                />
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Animated Background Blobs */}
      <View style={styles.blobContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.blob,
            styles.blob1,
            {
              transform: [{ translateY: floatY }],
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.4] })
            }
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob2,
            {
              transform: [{ translateY: floatY.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) }],
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.3] })
            }
          ]}
        />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.content, { opacity: fadeIn }]} pointerEvents="auto">
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('auth.resetPassword', 'Reset Password')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.resetPasswordSubtitle', 'Enter your new password')}
            </Text>
          </View>

          {/* Glassmorphism Card */}
          <View style={styles.card}>
            {/* Inputs */}
            <Input 
              label={t('auth.passwordLabel', 'PASSWORD')}
              value={password} 
              onChangeText={setPassword} 
              placeholder={t('auth.createPasswordPlaceholder', 'Create a password')}
              secureTextEntry 
            />
            
            <View style={{ height: 20 }} />
            
            <Input 
              label={t('auth.confirmPasswordLabel', 'CONFIRM PASSWORD')}
              value={confirmPassword} 
              onChangeText={setConfirmPassword} 
              placeholder={t('auth.confirmPasswordPlaceholder', 'Confirm your password')}
              secureTextEntry 
            />

            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            {/* Reset Button */}
            <View style={styles.buttonContainer}>
              <Button 
                title={t('auth.resetPasswordButton', 'RESET PASSWORD')} 
                onPress={handleSubmit} 
                loading={loading} 
              />
            </View>
          </View>

          {/* Back to Login Link */}
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.linkText}>{t('auth.backToLogin', 'Back to Login')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
    opacity: 0.3,
  },
  blob1: {
    width: width * 0.8,
    height: width * 0.8,
    backgroundColor: '#3B82F6',
    top: -width * 0.2,
    right: -width * 0.2,
  },
  blob2: {
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: colors.primary,
    top: height * 0.2,
    left: -width * 0.15,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    zIndex: 10,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 32,
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 24,
  },
  footerLinks: {
    alignItems: 'center',
    marginBottom: 24,
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});

