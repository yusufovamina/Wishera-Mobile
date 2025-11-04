export const lightColors = {
  // Backgrounds - Using wishera-front inspired gradients
  background: '#FAFBFC',
  surface: '#FFFFFF',
  card: 'rgba(255, 255, 255, 0.8)',
  
  // Primary colors - Indigo/Purple theme from wishera-front
  primary: '#6366F1', // indigo-500
  primaryAlt: '#8B5CF6', // purple-500
  primaryDark: '#4F46E5', // indigo-600
  
  // Accent colors
  accent: '#8B5CF6', // purple-500
  accentLight: '#A78BFA', // violet-400
  
  // Text colors
  text: '#0F172A', // slate-900
  textSecondary: '#475569', // slate-600
  textMuted: '#64748B', // slate-500
  
  // UI colors
  muted: '#F1F5F9', // slate-100
  border: '#E2E8F0', // slate-200
  borderDark: '#CBD5E1', // slate-300
  
  // Status colors
  success: '#10B981', // emerald-500
  successLight: '#34D399',
  danger: '#EF4444', // red-500
  dangerLight: '#F87171',
  warning: '#F59E0B', // amber-500
  warningLight: '#FBBF24',
  info: '#3B82F6', // blue-500
  infoLight: '#60A5FA',
  
  // Gradient colors for glassmorphism
  gradientStart: '#6366F1',
  gradientMid: '#8B5CF6',
  gradientEnd: '#A78BFA',
  
  // Overlay for glassmorphism
  overlay: 'rgba(255, 255, 255, 0.1)',
  overlayDark: 'rgba(0, 0, 0, 0.2)',
};

export const darkColors = {
  background: '#0B1020',
  surface: '#111827',
  card: 'rgba(17, 24, 39, 0.9)',
  primary: '#8B5CF6',
  primaryAlt: '#6366F1',
  primaryDark: '#7C3AED',
  accent: '#A78BFA',
  accentLight: '#C4B5FD',
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  muted: '#1F2937',
  border: '#334155',
  borderDark: '#475569',
  success: '#34D399',
  successLight: '#10B981',
  danger: '#F87171',
  dangerLight: '#EF4444',
  warning: '#FBBF24',
  warningLight: '#F59E0B',
  info: '#60A5FA',
  infoLight: '#3B82F6',
  gradientStart: '#8B5CF6',
  gradientMid: '#6366F1',
  gradientEnd: '#4F46E5',
  overlay: 'rgba(0, 0, 0, 0.2)',
  overlayDark: 'rgba(255, 255, 255, 0.12)',
};

export type Colors = typeof lightColors;

let currentTheme: 'light' | 'dark' = 'light';
export const setThemeMode = (mode: 'light' | 'dark') => { currentTheme = mode; };
export const getColors = (): Colors => (currentTheme === 'dark' ? darkColors : lightColors);
// Dynamic colors proxy: always reflects current theme without refactoring existing imports
export const colors: Colors = new Proxy({} as any, {
  get(_target, prop: string) {
    const c = getColors() as any;
    return c[prop];
  },
});


