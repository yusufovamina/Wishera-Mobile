import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated } from 'react-native';
import { Audio } from 'expo-av';
import { colors } from '../theme/colors';
import { TimeIcon, PlayIcon, PauseIcon } from './Icon';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration: number;
  isOwnMessage?: boolean;
  onPlaybackStatusUpdate?: (status: Audio.SoundStatus) => void;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  audioUrl,
  duration,
  isOwnMessage = false,
  onPlaybackStatusUpdate,
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [waveformHeights, setWaveformHeights] = useState<number[]>(Array(20).fill(8));
  const waveformAnimationInterval = useRef<NodeJS.Timeout | null>(null);
  const positionUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (sound) {
        sound.unloadAsync();
      }
      if (positionUpdateInterval.current) {
        clearInterval(positionUpdateInterval.current);
      }
      if (waveformAnimationInterval.current) {
        clearInterval(waveformAnimationInterval.current);
      }
    };
  }, [sound]);

  // Animate waveform while playing
  useEffect(() => {
    if (isPlaying) {
      waveformAnimationInterval.current = setInterval(() => {
        setWaveformHeights(prev => 
          prev.map(() => 8 + Math.random() * 22)
        );
      }, 100);
    } else {
      if (waveformAnimationInterval.current) {
        clearInterval(waveformAnimationInterval.current);
        waveformAnimationInterval.current = null;
      }
      setWaveformHeights(Array(20).fill(8));
    }

    return () => {
      if (waveformAnimationInterval.current) {
        clearInterval(waveformAnimationInterval.current);
      }
    };
  }, [isPlaying]);

  const loadSound = async () => {
    if (sound) {
      return sound;
    }

    try {
      setIsLoading(true);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false },
        (status) => {
          if (status.isLoaded) {
            setCurrentPosition(status.positionMillis || 0);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setCurrentPosition(0);
              if (positionUpdateInterval.current) {
                clearInterval(positionUpdateInterval.current);
                positionUpdateInterval.current = null;
              }
            }
            if (onPlaybackStatusUpdate) {
              onPlaybackStatusUpdate(status);
            }
          }
        }
      );

      setSound(newSound);
      setIsLoading(false);
      return newSound;
    } catch (error) {
      console.error('Failed to load sound:', error);
      setIsLoading(false);
      return null;
    }
  };

  const playSound = async () => {
    try {
      const soundToPlay = await loadSound();
      if (!soundToPlay) {
        return;
      }

      await soundToPlay.playAsync();
      setIsPlaying(true);

      // Update position every 100ms
      positionUpdateInterval.current = setInterval(async () => {
        if (soundToPlay) {
          const status = await soundToPlay.getStatusAsync();
          if (status.isLoaded) {
            setCurrentPosition(status.positionMillis || 0);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setCurrentPosition(0);
              if (positionUpdateInterval.current) {
                clearInterval(positionUpdateInterval.current);
                positionUpdateInterval.current = null;
              }
            }
          }
        }
      }, 100);
    } catch (error) {
      console.error('Failed to play sound:', error);
      setIsPlaying(false);
    }
  };

  const pauseSound = async () => {
    try {
      if (sound) {
        await sound.pauseAsync();
        setIsPlaying(false);
        if (positionUpdateInterval.current) {
          clearInterval(positionUpdateInterval.current);
          positionUpdateInterval.current = null;
        }
      }
    } catch (error) {
      console.error('Failed to pause sound:', error);
    }
  };

  const stopSound = async () => {
    try {
      if (sound) {
        await sound.stopAsync();
        await sound.setPositionAsync(0);
        setIsPlaying(false);
        setCurrentPosition(0);
        if (positionUpdateInterval.current) {
          clearInterval(positionUpdateInterval.current);
          positionUpdateInterval.current = null;
        }
      }
    } catch (error) {
      console.error('Failed to stop sound:', error);
    }
  };

  const togglePlayback = async () => {
    if (isPlaying) {
      await pauseSound();
    } else {
      await playSound();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? currentPosition / (duration * 1000) : 0;

  return (
    <View style={[styles.container, isOwnMessage && styles.ownContainer]}>
      <TouchableOpacity
        style={[styles.playButton, isOwnMessage && styles.ownPlayButton]}
        onPress={togglePlayback}
        disabled={isLoading}
      >
        {isLoading ? (
          <TimeIcon size={20} color={isOwnMessage ? 'white' : colors.primary} />
        ) : isPlaying ? (
          <PauseIcon size={20} color={isOwnMessage ? 'white' : colors.primary} />
        ) : (
          <PlayIcon size={20} color={isOwnMessage ? 'white' : colors.primary} />
        )}
      </TouchableOpacity>

      <View style={styles.waveformContainer}>
        {/* Waveform visualization */}
        <View style={styles.waveform}>
          {waveformHeights.map((height, index) => {
            const isActive = index < progress * 20;
            
            return (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height,
                    opacity: isActive
                      ? (isOwnMessage ? 1 : 0.8)
                      : 0.3,
                    backgroundColor: isOwnMessage
                      ? 'rgba(255, 255, 255, 0.8)'
                      : colors.primary,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${progress * 100}%`,
                backgroundColor: isOwnMessage ? 'white' : colors.primary,
              },
            ]}
          />
        </View>
      </View>

      <Text style={[styles.duration, isOwnMessage && styles.ownDuration]}>
        {formatDuration(isPlaying ? currentPosition / 1000 : duration)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.muted,
    borderRadius: 18,
    minWidth: 200,
    maxWidth: 250,
  },
  ownContainer: {
    backgroundColor: colors.primary,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  ownPlayButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  waveformContainer: {
    flex: 1,
    marginRight: 8,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 20,
    marginBottom: 4,
  },
  waveformBar: {
    width: 2,
    borderRadius: 1,
    marginHorizontal: 1,
  },
  progressBarContainer: {
    height: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 1,
  },
  duration: {
    fontSize: 12,
    color: colors.textSecondary,
    minWidth: 40,
    textAlign: 'right',
  },
  ownDuration: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

