import React, { PropsWithChildren, useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { getColors } from '../theme/colors';
import { usePreferences } from '../state/preferences';

type CardProps = PropsWithChildren<{ style?: ViewStyle }>;

export const Card: React.FC<CardProps> = ({ style, children }) => {
  const { theme } = usePreferences();
  const colors = useMemo(() => getColors(), [theme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.card, style]}>{children}</View>;
};

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 16,
  },
});


