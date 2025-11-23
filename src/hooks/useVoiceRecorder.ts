import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

export interface VoiceRecording {
  uri: string;
  duration: number;
  fileSize: number;
}

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = useCallback(async () => {
    try {
      // If already recording, don't start another one
      if (isRecording || recordingRef.current) {
        console.warn('[useVoiceRecorder] Already recording, cleaning up first...');
        // Clean up any existing recording first
        const existingRecording = recordingRef.current;
        if (existingRecording) {
          try {
            const status = await existingRecording.getStatusAsync();
            if (status.isRecording) {
              await existingRecording.stopAndUnloadAsync();
            }
          } catch (cleanupError) {
            console.warn('[useVoiceRecorder] Error cleaning up existing recording:', cleanupError);
          }
          recordingRef.current = null;
          setRecording(null);
        }
        setIsRecording(false);
        // Wait a bit for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('Audio permission not granted');
        return false;
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Clear any existing interval
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Start recording with expo-audio
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        undefined,
        100 // Update interval in ms
      );

      console.log('[useVoiceRecorder] Recording started:', { hasRecording: !!newRecording });
      recordingRef.current = newRecording;
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);
      startTimeRef.current = new Date();

      // Update duration every 100ms
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((new Date().getTime() - startTimeRef.current.getTime()) / 1000);
          setRecordingDuration(elapsed);
        }
      }, 100);

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      setRecording(null);
      recordingRef.current = null;
      // Reset audio mode on error
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch (modeError) {
        console.warn('[useVoiceRecorder] Failed to reset audio mode:', modeError);
      }
      return false;
    }
  }, [isRecording]);

  const stopRecording = useCallback(async (): Promise<VoiceRecording | null> => {
    console.log('[useVoiceRecorder] stopRecording called', { 
      hasRecordingRef: !!recordingRef.current, 
      hasRecording: !!recording,
      isRecording
    });

    // Wait a bit for recording to be set if it's not yet (max 500ms)
    let attempts = 0;
    let currentRecording = recordingRef.current || recording;
    while (!currentRecording && isRecording && attempts < 5) {
      console.log('[useVoiceRecorder] Waiting for recording to be set...', attempts);
      await new Promise(resolve => setTimeout(resolve, 100));
      currentRecording = recordingRef.current || recording;
      attempts++;
    }
    
    // Use ref first (always up-to-date), fallback to state
    if (!currentRecording) {
      currentRecording = recordingRef.current || recording;
    }

    if (!currentRecording) {
      console.error('[useVoiceRecorder] No recording to stop - recording is null');
      console.error('[useVoiceRecorder] State check:', { 
        isRecording, 
        hasRecordingRef: !!recordingRef.current,
        hasRecording: !!recording,
        attempts
      });
      setIsRecording(false);
      setRecording(null);
      recordingRef.current = null;
      return null;
    }

    // Verify recording is actually a Recording object
    if (typeof currentRecording.getURI !== 'function' || typeof currentRecording.stopAndUnloadAsync !== 'function') {
      console.error('[useVoiceRecorder] Invalid recording object:', currentRecording);
      console.error('[useVoiceRecorder] Recording type:', typeof currentRecording);
      setIsRecording(false);
      setRecording(null);
      recordingRef.current = null;
      return null;
    }

    try {
      // Clear duration interval first
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Get status before stopping
      const statusBeforeStop = await currentRecording.getStatusAsync();
      console.log('[useVoiceRecorder] Status before stop:', statusBeforeStop);
      console.log('[useVoiceRecorder] Is recording?', statusBeforeStop.isRecording);
      console.log('[useVoiceRecorder] Duration:', statusBeforeStop.durationMillis);

      // Stop recording - getURI() works after stopAndUnloadAsync on all platforms
      console.log('[useVoiceRecorder] Stopping and unloading recording...');
      const stopStatus = await currentRecording.stopAndUnloadAsync();
      console.log('[useVoiceRecorder] Stop status:', stopStatus);
      
      // Get URI after stopping (this is the correct way per Expo docs)
      const uri = currentRecording.getURI();
      console.log('[useVoiceRecorder] URI after stop:', uri);
      
      if (!uri) {
        console.error('[useVoiceRecorder] Recording URI is null after stop');
        console.error('[useVoiceRecorder] Stop status:', stopStatus);
        setIsRecording(false);
        setRecording(null);
        recordingRef.current = null;
        return null;
      }
      
      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      // Get file info (skip on web with blob URIs - not needed)
      let fileSize = 0;
      let fileExists = false;
      if (Platform.OS !== 'web' || !uri.startsWith('blob:')) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          console.log('[useVoiceRecorder] File info:', fileInfo);
          fileExists = fileInfo.exists || false;
          fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
        } catch (fileInfoError: any) {
          console.warn('[useVoiceRecorder] Failed to get file info:', fileInfoError?.message);
          // Continue without file size - not critical
          fileSize = 0;
          fileExists = false;
        }
      } else {
        // On web with blob URIs, we can't get file size easily, but it's not needed
        console.log('[useVoiceRecorder] Skipping file info check for blob URI on web');
        fileSize = 0;
        fileExists = true; // Blob URIs exist if we got here
      }
      
      // Calculate duration: use status duration if available, otherwise use tracked duration
      let duration = 0;
      if (statusBeforeStop.durationMillis && statusBeforeStop.durationMillis > 0) {
        duration = Math.floor(statusBeforeStop.durationMillis / 1000);
      } else if (recordingDuration > 0) {
        duration = recordingDuration;
      } else {
        // Fallback: minimum 1 second
        duration = Math.max(1, recordingDuration || 1);
      }

      // Ensure duration is at least 1 second
      if (duration < 1) {
        duration = 1;
      }

      console.log('[useVoiceRecorder] Recording stopped successfully:', { 
        uri, 
        duration, 
        fileSize, 
        statusDuration: statusBeforeStop.durationMillis, 
        trackedDuration: recordingDuration,
        fileExists: fileExists
      });

      setIsRecording(false);
      setRecording(null);
      recordingRef.current = null;
      setRecordedUri(uri);
      setRecordedDuration(duration);
      setRecordingDuration(0);
      startTimeRef.current = null;

      // Wait a bit to ensure cleanup is complete before allowing new recording
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        uri,
        duration,
        fileSize,
      };
    } catch (error: any) {
      console.error('[useVoiceRecorder] Failed to stop recording:', error);
      console.error('[useVoiceRecorder] Error details:', error?.message, error?.stack);
      console.error('[useVoiceRecorder] Error name:', error?.name);
      setIsRecording(false);
      setRecording(null);
      recordingRef.current = null;
      return null;
    }
  }, [recording, recordingDuration]);

  const cancelRecording = useCallback(async () => {
    const currentRecording = recordingRef.current || recording;
    console.log('[useVoiceRecorder] cancelRecording called', { 
      hasRecordingRef: !!recordingRef.current,
      hasRecording: !!recording,
      hasCurrentRecording: !!currentRecording,
      isRecording 
    });
    
    // Clear duration interval first
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (!currentRecording) {
      console.log('[useVoiceRecorder] No recording to cancel');
      setIsRecording(false);
      setRecording(null);
      recordingRef.current = null;
      setRecordingDuration(0);
      setRecordedUri(null);
      setRecordedDuration(0);
      return;
    }

    try {
      // Get URI before stopping
      const uri = currentRecording.getURI();
      console.log('[useVoiceRecorder] Recording URI before cancel:', uri);
      
      // Stop and delete recording
      console.log('[useVoiceRecorder] Stopping and unloading recording...');
      await currentRecording.stopAndUnloadAsync();
      
      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      // Delete the file (skip on web with blob URIs - they're automatically cleaned up)
      if (uri && (Platform.OS !== 'web' || !uri.startsWith('blob:'))) {
        try {
          console.log('[useVoiceRecorder] Deleting recording file:', uri);
          await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch (deleteError: any) {
          console.warn('[useVoiceRecorder] Failed to delete recording file:', deleteError?.message);
        }
      } else if (uri && uri.startsWith('blob:')) {
        // On web, blob URIs are automatically cleaned up by the browser
        console.log('[useVoiceRecorder] Skipping blob URI deletion on web (auto-cleaned)');
      }

      setIsRecording(false);
      setRecording(null);
      recordingRef.current = null;
      setRecordingDuration(0);
      setRecordedUri(null);
      setRecordedDuration(0);
      startTimeRef.current = null;
      console.log('[useVoiceRecorder] Recording canceled successfully');
      
      // Wait a bit to ensure cleanup is complete before allowing new recording
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      console.error('[useVoiceRecorder] Failed to cancel recording:', error);
      console.error('[useVoiceRecorder] Error details:', error?.message, error?.stack);
      setIsRecording(false);
      setRecording(null);
      recordingRef.current = null;
      setRecordingDuration(0);
      setRecordedUri(null);
      setRecordedDuration(0);
      startTimeRef.current = null;
      
      // Try to reset audio mode even on error
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch (modeError) {
        console.warn('[useVoiceRecorder] Failed to reset audio mode:', modeError);
      }
      
      // Wait a bit to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }, [recording]);

  const clearRecording = useCallback(() => {
    setRecordedUri(null);
    setRecordedDuration(0);
  }, []);

  return {
    isRecording,
    recordingDuration,
    recordedUri,
    recordedDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
  };
}
