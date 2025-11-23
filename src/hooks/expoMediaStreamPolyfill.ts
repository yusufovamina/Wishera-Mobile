import { Platform } from 'react-native';
import * as Camera from 'expo-camera';
import { Audio } from 'expo-av';

/**
 * Expo Go MediaStream Polyfill
 * Creates a MediaStream-like interface using expo-camera and expo-av
 * This allows WebRTC-like functionality in Expo Go
 */

interface MediaStreamTrackPolyfill {
  enabled: boolean;
  kind: 'audio' | 'video';
  id: string;
  stop: () => void;
  cameraRef?: any;
  recording?: Audio.Recording;
}

interface MediaStreamPolyfill {
  id: string;
  getTracks: () => MediaStreamTrackPolyfill[];
  getAudioTracks: () => MediaStreamTrackPolyfill[];
  getVideoTracks: () => MediaStreamTrackPolyfill[];
  addTrack: (track: MediaStreamTrackPolyfill) => void;
  toURL: () => string;
  _tracks: MediaStreamTrackPolyfill[];
}

export const createExpoMediaStream = async (
  constraints: MediaStreamConstraints
): Promise<MediaStreamPolyfill> => {
  const tracks: MediaStreamTrackPolyfill[] = [];
  const streamId = `expo-stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Handle audio
  if (constraints.audio) {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

        const audioTrack: MediaStreamTrackPolyfill = {
          enabled: true,
          kind: 'audio',
          id: `audio-${Date.now()}`,
          recording,
          stop: async () => {
            if (recording) {
              try {
                await recording.stopAndUnloadAsync();
              } catch (e) {
                console.warn('[ExpoMediaStream] Error stopping audio:', e);
              }
            }
          },
        };
        tracks.push(audioTrack);
      }
    } catch (error) {
      console.error('[ExpoMediaStream] Error creating audio track:', error);
    }
  }

  // Handle video
  if (constraints.video) {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Camera permission not granted');
      }

      // Create a video track placeholder
      // The actual camera will be handled by the component using CameraView
      const videoTrack: MediaStreamTrackPolyfill = {
        enabled: true,
        kind: 'video',
        id: `video-${Date.now()}`,
        stop: () => {
          // Camera will be stopped by unmounting CameraView
          console.log('[ExpoMediaStream] Video track stopped');
        },
      };
      tracks.push(videoTrack);
    } catch (error) {
      console.error('[ExpoMediaStream] Error creating video track:', error);
    }
  }

  const stream: MediaStreamPolyfill = {
    id: streamId,
    _tracks: tracks,
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter(t => t.kind === 'audio'),
    getVideoTracks: () => tracks.filter(t => t.kind === 'video'),
    addTrack: (track: MediaStreamTrackPolyfill) => {
      tracks.push(track);
    },
    toURL: () => {
      return streamId;
    },
  };

  return stream;
};

export const createExpoGetUserMedia = () => {
  return async (constraints: MediaStreamConstraints): Promise<MediaStreamPolyfill> => {
    return createExpoMediaStream(constraints);
  };
};

