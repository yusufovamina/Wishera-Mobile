import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated, Easing, StatusBar, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useAuthStore } from '../state/auth';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

const { width, height } = Dimensions.get('window');

type Props = NativeStackScreenProps<any>;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { register, loading, error } = useAuthStore();
  
  const floatY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Floating blobs animation - smoother
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

    // Pulse animation - smoother
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
  }, [floatY, pulse, fadeIn]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Animated Background Blobs - Orange/Yellow theme for registration - Pointer events disabled */}
      <View style={styles.blobContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.blob,
            styles.blob1,
            {
              transform: [
                { translateY: floatY }
              ],
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.4] })
            }
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob2,
            {
              transform: [
                { translateY: floatY.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) }
              ],
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join us today</Text>
          </View>

          {/* Glassmorphism Card */}
          <View style={styles.card}>
            {/* Inputs */}
            <Input 
              label="USERNAME" 
              value={username} 
              onChangeText={setUsername} 
              placeholder="Choose a username" 
            />
            
            <View style={{ height: 20 }} />
            
            <Input 
              label="EMAIL" 
              value={email} 
              onChangeText={setEmail} 
              placeholder="Enter your email" 
            />
            
            <View style={{ height: 20 }} />
            
            <Input 
              label="PASSWORD" 
              value={password} 
              onChangeText={setPassword} 
              placeholder="Create a password" 
              secureTextEntry 
            />
            
            <View style={{ height: 20 }} />
            
            <Input 
              label="CONFIRM PASSWORD" 
              value={confirmPassword} 
              onChangeText={setConfirmPassword} 
              placeholder="Confirm your password" 
              secureTextEntry 
            />

            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            {/* Register Button */}
            <View style={styles.buttonContainer}>
              <Button 
                title="CREATE ACCOUNT" 
                onPress={() => register(username, password)} 
                loading={loading} 
              />
            </View>
          </View>

          {/* Login Link */}
          <View style={styles.loginSection}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
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
    backgroundColor: '#F59E0B', // amber
    top: -width * 0.2,
    right: -width * 0.2,
  },
  blob2: {
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: '#F97316', // orange
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
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 32,
    marginBottom: 24,
    shadowColor: '#F59E0B',
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
  loginSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  loginLink: {
    color: '#F59E0B',
    fontSize: 15,
    fontWeight: '600',
  },
});
