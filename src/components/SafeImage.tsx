import React, { useState, useCallback, useMemo } from 'react';
import { Image, ImageProps, View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../theme/colors';

interface SafeImageProps extends Omit<ImageProps, 'source'> {
  source: { uri: string } | number;
  fallbackUri?: string;
  placeholder?: string;
  style?: ImageProps['style'];
}

export const SafeImage: React.FC<SafeImageProps> = React.memo(({
  source,
  fallbackUri,
  placeholder,
  style,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);
  
  const sourceUri = useMemo(() => {
    if (typeof source === 'object' && 'uri' in source) {
      return source.uri;
    }
    return null;
  }, [source]);

  const handleError = useCallback(() => {
    // Only try fallback once
    if (!triedFallback && fallbackUri && sourceUri !== fallbackUri) {
      setTriedFallback(true);
      // Don't set hasError yet, let it try the fallback
      return;
    }
    // If fallback also failed or no fallback, show placeholder
    if (placeholder) {
      setHasError(true);
    }
  }, [triedFallback, fallbackUri, sourceUri, placeholder]);

  // If error occurred and we have a placeholder, show placeholder
  if (hasError && placeholder && (!fallbackUri || triedFallback)) {
    return (
      <View style={[style, styles.placeholder]}>
        <Text style={styles.placeholderText}>{placeholder}</Text>
      </View>
    );
  }

  // Use fallback URI if original failed, otherwise use original source
  const imageSource = useMemo(() => {
    if (triedFallback && fallbackUri) {
      return { uri: fallbackUri };
    }
    return source;
  }, [triedFallback, fallbackUri, source]);

  return (
    <Image
      {...props}
      source={imageSource}
      style={style}
      onError={handleError}
      // Prevent the browser from attempting to access storage
      // This doesn't stop the warning but reduces unnecessary reloads
      defaultSource={Platform.OS === 'web' ? undefined : props.defaultSource}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  const prevUri = typeof prevProps.source === 'object' && 'uri' in prevProps.source 
    ? prevProps.source.uri 
    : prevProps.source;
  const nextUri = typeof nextProps.source === 'object' && 'uri' in nextProps.source 
    ? nextProps.source.uri 
    : nextProps.source;
  
  return prevUri === nextUri 
    && prevProps.fallbackUri === nextProps.fallbackUri
    && prevProps.placeholder === nextProps.placeholder;
});

SafeImage.displayName = 'SafeImage';

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});

