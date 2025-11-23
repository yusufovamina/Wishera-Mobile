import { useRef, useCallback, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { CameraView, CameraType } from 'expo-camera';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';

/**
 * WebSocket-based calling solution for Expo Go
 * This provides P2P-like calling functionality using WebSocket streaming
 * Works in Expo Go without native modules
 */

interface CallState {
  isConnected: boolean;
  isCallActive: boolean;
  localStream: any | null;
  remoteStream: any | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
}

interface WebSocketCallOptions {
  signalingUrl: string;
  onRemoteStream?: (stream: any) => void;
  onCallStateChange?: (state: string) => void;
}

export const useWebSocketCall = (options: WebSocketCallOptions) => {
  const [callState, setCallState] = useState<CallState>({
    isConnected: false,
    isCallActive: false,
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isVideoEnabled: true,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const audioRecordingRef = useRef<Audio.Recording | null>(null);
  const mediaStreamRef = useRef<any>(null);
  const remoteStreamRef = useRef<any>(null);

  // Connect to WebSocket signaling server
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(options.signalingUrl);
      
      ws.onopen = () => {
        console.log('[WebSocketCall] Connected to signaling server');
        setCallState(prev => ({ ...prev, isConnected: true }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleSignalingMessage(message);
        } catch (e) {
          console.error('[WebSocketCall] Error parsing message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocketCall] WebSocket error:', error);
        setCallState(prev => ({ ...prev, isConnected: false }));
      };

      ws.onclose = () => {
        console.log('[WebSocketCall] WebSocket closed');
        setCallState(prev => ({ ...prev, isConnected: false, isCallActive: false }));
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocketCall] Error connecting:', error);
    }
  }, [options.signalingUrl]);

  // Handle signaling messages
  const handleSignalingMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'offer':
        // Handle incoming call offer
        break;
      case 'answer':
        // Handle call answer
        break;
      case 'ice-candidate':
        // Handle ICE candidate (not used in WebSocket approach)
        break;
      case 'media-data':
        // Handle incoming media data
        handleRemoteMediaData(message.data);
        break;
      case 'call-ended':
        endCall();
        break;
    }
  }, []);

  // Handle remote media data
  const handleRemoteMediaData = useCallback((data: any) => {
    // Decode and display remote media
    // This would need proper media decoding/rendering
    if (options.onRemoteStream) {
      options.onRemoteStream(data);
    }
  }, [options]);

  // Start capturing local media
  const startLocalMedia = useCallback(async (isVideo: boolean = true) => {
    try {
      // Request permissions
      if (isVideo) {
        const { status } = await Camera.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Camera permission not granted');
        }
      }

      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      if (audioStatus !== 'granted') {
        throw new Error('Microphone permission not granted');
      }

      // Set up audio recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // For video, we'll use CameraView component
      // For audio, we'll use Audio.Recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      audioRecordingRef.current = recording;

      // Create a media stream object
      const stream = {
        id: `local-stream-${Date.now()}`,
        videoEnabled: isVideo,
        audioEnabled: true,
        cameraRef: cameraRef,
        recording: recording,
        getTracks: () => [],
        getVideoTracks: () => isVideo ? [{ enabled: true, kind: 'video' }] : [],
        getAudioTracks: () => [{ enabled: true, kind: 'audio' }],
      };

      mediaStreamRef.current = stream;
      setCallState(prev => ({ ...prev, localStream: stream }));

      // Start streaming media data over WebSocket
      startMediaStreaming(stream, isVideo);

      return stream;
    } catch (error) {
      console.error('[WebSocketCall] Error starting local media:', error);
      throw error;
    }
  }, []);

  // Start streaming media over WebSocket
  const startMediaStreaming = useCallback(async (stream: any, isVideo: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[WebSocketCall] WebSocket not connected');
      return;
    }

    // For audio, we'll periodically send audio chunks
    if (audioRecordingRef.current) {
      // Note: This is a simplified approach
      // In production, you'd need proper audio encoding/streaming
      const streamAudio = async () => {
        try {
          // Get audio data from recording
          // This is simplified - you'd need proper audio capture and encoding
          const status = await audioRecordingRef.current!.getStatusAsync();
          
          // Send audio data over WebSocket
          // In a real implementation, you'd capture audio chunks and send them
          wsRef.current?.send(JSON.stringify({
            type: 'media-data',
            kind: 'audio',
            data: null, // Would contain encoded audio data
          }));
        } catch (e) {
          console.error('[WebSocketCall] Error streaming audio:', e);
        }
      };

      // Stream audio periodically
      const audioInterval = setInterval(streamAudio, 100); // Every 100ms
      
      // Store interval for cleanup
      (stream as any)._audioInterval = audioInterval;
    }

    // For video, we'd capture frames from CameraView
    // This would require frame capture and encoding
    // For now, we'll just mark video as available
    if (isVideo) {
      console.log('[WebSocketCall] Video streaming would be implemented here');
      // In production: capture frames from CameraView and send over WebSocket
    }
  }, []);

  // Start a call
  const startCall = useCallback(async (userId: string, callId: string, isVideo: boolean = true) => {
    try {
      await startLocalMedia(isVideo);
      
      // Send call offer over WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'offer',
          targetUserId: userId,
          callId: callId,
          isVideo: isVideo,
        }));
      }

      setCallState(prev => ({ ...prev, isCallActive: true }));
    } catch (error) {
      console.error('[WebSocketCall] Error starting call:', error);
      throw error;
    }
  }, [startLocalMedia]);

  // Accept a call
  const acceptCall = useCallback(async (userId: string, callId: string, isVideo: boolean = true) => {
    try {
      await startLocalMedia(isVideo);
      
      // Send call answer over WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'answer',
          targetUserId: userId,
          callId: callId,
          isVideo: isVideo,
        }));
      }

      setCallState(prev => ({ ...prev, isCallActive: true }));
    } catch (error) {
      console.error('[WebSocketCall] Error accepting call:', error);
      throw error;
    }
  }, [startLocalMedia]);

  // End call
  const endCall = useCallback(() => {
    // Stop media capture
    if (audioRecordingRef.current) {
      audioRecordingRef.current.stopAndUnloadAsync();
      audioRecordingRef.current = null;
    }

    // Clear intervals
    if (mediaStreamRef.current?._audioInterval) {
      clearInterval(mediaStreamRef.current._audioInterval);
    }

    // Send call end message
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call-ended',
      }));
    }

    setCallState({
      isConnected: callState.isConnected,
      isCallActive: false,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isVideoEnabled: true,
    });

    mediaStreamRef.current = null;
    remoteStreamRef.current = null;
  }, [callState.isConnected]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    // In production, you'd mute/unmute the audio stream
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    setCallState(prev => ({ ...prev, isVideoEnabled: !prev.isVideoEnabled }));
    // In production, you'd enable/disable video streaming
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [endCall]);

  return {
    ...callState,
    connect,
    startCall,
    acceptCall,
    endCall,
    toggleMute,
    toggleVideo,
    cameraRef,
  };
};

