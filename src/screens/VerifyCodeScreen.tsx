import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated, Easing, StatusBar, Dimensions, ScrollView, Alert, TextInput } from 'react-native';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { Button } from '../components/Button';
import { useAuthStore } from '../state/auth';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreferences } from '../state/preferences';

const { width, height } = Dimensions.get('window');

type Props = NativeStackScreenProps<any>;

export const VerifyCodeScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(), [theme]);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const { verifyResetCode, verifyLoginCode, resendLoginCode, loading, error } = useAuthStore();
  const inputRefs = useRef<(TextInput | null)[]>([]);
  
  // Get email and type from route params
  const email = route?.params?.email || '';
  const codeType = route?.params?.type || 'reset'; // 'reset' or 'login'
  
  const floatY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!email) {
      Alert.alert(t('auth.error', 'Error'), t('auth.emailRequired', 'Email is required'));
      if (codeType === 'reset') {
        navigation.navigate('ForgotPassword');
      } else {
        navigation.navigate('Login');
      }
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
  }, [floatY, pulse, fadeIn, email, navigation, t]);

  const handleCodeChange = (value: string, index: number) => {
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, '');
    if (digit.length > 1) return;
    
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const codeString = code.join('');
    if (codeString.length !== 6) {
      Alert.alert(t('auth.error', 'Error'), t('auth.invalidCode', 'Please enter the complete 6-digit code'));
      return;
    }

    try {
      if (codeType === 'login') {
        await verifyLoginCode(email, codeString);
        // Navigation will be handled automatically after successful login
      } else {
        const token = await verifyResetCode(email, codeString);
        // Navigate to reset password screen with token
        navigation.navigate('ResetPassword', { token });
      }
    } catch (e) {
      // Error is handled by the store
      console.log('Verify code error:', e);
    }
  };

  const handleResend = async () => {
    try {
      if (codeType === 'login') {
        await resendLoginCode(email);
        Alert.alert(t('auth.success', 'Success'), t('auth.codeResent', 'Code has been resent to your email'));
      } else {
        navigation.navigate('ForgotPassword', { email });
      }
    } catch (e) {
      // Error is handled by the store
      console.log('Resend code error:', e);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
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
            <Text style={styles.title}>
              {codeType === 'login' 
                ? t('auth.signInConfirmation', 'Sign In Confirmation')
                : t('auth.verifyCode', 'Verify Code')}
            </Text>
            <Text style={styles.subtitle}>
              {codeType === 'login'
                ? t('auth.signInCodeSubtitle', 'Enter the 6-digit code sent to your email to complete sign in')
                : t('auth.verifyCodeSubtitle', 'Enter the 6-digit code sent to your email')}
            </Text>
            <Text style={styles.emailText}>{email}</Text>
          </View>

          {/* Code Input */}
          <View style={styles.card}>
            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={styles.codeInput}
                  value={digit}
                  onChangeText={(value) => handleCodeChange(value, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <View style={styles.buttonContainer}>
              <Button 
                title={t('auth.verifyCodeButton', 'VERIFY CODE')} 
                onPress={handleSubmit} 
                loading={loading} 
              />
            </View>

            {/* Resend Code */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>
                {t('auth.didntReceiveCode', "Didn't receive the code?")}
              </Text>
              <TouchableOpacity onPress={handleResend}>
                <Text style={styles.resendLink}>{t('auth.resendCode', 'Resend')}</Text>
              </TouchableOpacity>
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
    marginBottom: 8,
  },
  emailText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 8,
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
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  codeInput: {
    width: 50,
    height: 60,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
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
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  resendText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginRight: 4,
  },
  resendLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
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

