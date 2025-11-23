import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, AudioSource } from 'expo-audio';
import { colors } from '../theme/colors';
import { TimeIcon, PlayIcon, PauseIcon } from './Icon';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration: number;
  isOwnMessage?: boolean;
  onPlaybackStatusUpdate?: (status: { isPlaying: boolean; positionMillis: number; durationMillis: number }) => void;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  audioUrl,
  duration,
  isOwnMessage = false,
  onPlaybackStatusUpdate,
}) => {
  const [waveformHeights, setWaveformHeights] = useState<number[]>(Array(20).fill(8));
  const waveformAnimationInterval = useRef<NodeJS.Timeout | null>(null);

  // Use expo-audio's useAudioPlayer hook
  const player = useAudioPlayer(audioUrl as AudioSource, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);

  const isPlaying = status.isPlaying || false;
  const currentPosition = status.currentTime * 1000; // Convert to milliseconds
  const isLoading = status.playbackState === 'loading' || status.timeControlStatus === 'waitingToPlayAtSpecifiedRate';
  const audioDuration = status.duration > 0 ? status.duration * 1000 : duration * 1000; // Use status duration or fallback to prop

  // Update parent component with status
  useEffect(() => {
    if (onPlaybackStatusUpdate) {
      onPlaybackStatusUpdate({
        isPlaying,
        positionMillis: currentPosition,
        durationMillis: audioDuration,
      });
    }
  }, [isPlaying, currentPosition, audioDuration, onPlaybackStatusUpdate]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (waveformAnimationInterval.current) {
        clearInterval(waveformAnimationInterval.current);
      }
    };
  }, []);

  const togglePlayback = async () => {
    if (!player) return;

    try {
      if (isPlaying) {
        player.pause();
      } else {
        await player.play();
      }
    } catch (error) {
      console.error('Failed to toggle playback:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioDuration > 0 ? currentPosition / audioDuration : 0;
  const displayDuration = isPlaying ? currentPosition / 1000 : duration;

  return (
    <View style={[styles.container, isOwnMessage && styles.ownContainer]}>
      <TouchableOpacity
        style={[styles.playButton, isOwnMessage && styles.ownPlayButton]}
        onPress={togglePlayback}
        disabled={isLoading || !player}
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
        {formatDuration(displayDuration)}
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
