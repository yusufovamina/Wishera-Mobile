import { useRef, useCallback, useState, useEffect } from 'react';
import { Platform } from 'react-native';

// WebRTC types
interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer';
  sdp?: string;
}

interface RTCIceCandidateInit {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
}

interface MediaStream {
  getTracks: () => MediaStreamTrack[];
  getAudioTracks: () => MediaStreamTrack[];
  getVideoTracks: () => MediaStreamTrack[];
  toURL: () => string;
}

interface MediaStreamTrack {
  enabled: boolean;
  kind: string;
  stop: () => void;
}

interface WebRTCCallState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: any | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isFrontCamera: boolean;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Platform-specific WebRTC implementation
const getWebRTC = () => {
  if (Platform.OS === 'web') {
    // Use browser native WebRTC
    return {
      RTCPeerConnection: window.RTCPeerConnection || (window as any).webkitRTCPeerConnection || (window as any).mozRTCPeerConnection,
      RTCSessionDescription: window.RTCSessionDescription || (window as any).webkitRTCSessionDescription || (window as any).mozRTCSessionDescription,
      RTCIceCandidate: window.RTCIceCandidate || (window as any).webkitRTCIceCandidate || (window as any).mozRTCIceCandidate,
      getUserMedia: navigator.mediaDevices?.getUserMedia || 
                   (navigator as any).getUserMedia || 
                   (navigator as any).webkitGetUserMedia || 
                   (navigator as any).mozGetUserMedia,
    };
  } else {
    // For native platforms, try to import react-native-webrtc
    try {
      return require('react-native-webrtc');
    } catch (e) {
      console.warn('react-native-webrtc not available, using fallback');
      return null;
    }
  }
};

export const useWebRTC = () => {
  const [callState, setCallState] = useState<WebRTCCallState>({
    localStream: null,
    remoteStream: null,
    peerConnection: null,
    isMuted: false,
    isVideoEnabled: true,
    isFrontCamera: true,
  });

  const peerConnectionRef = useRef<any | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateCallbackRef = useRef<((candidate: RTCIceCandidateInit) => void) | null>(null);
  const webrtc = getWebRTC();

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    if (!webrtc || !webrtc.RTCPeerConnection) {
      console.error('[WebRTC] WebRTC not available');
      return null;
    }

    // Close existing connection if any
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {
        console.warn('[WebRTC] Error closing existing connection:', e);
      }
    }

    try {
      const pc = new webrtc.RTCPeerConnection({ iceServers: ICE_SERVERS });
      
      // Add local stream tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
          pc.addTrack(track, localStreamRef.current as any);
        });
      }

      // Handle remote stream
      pc.ontrack = (event: any) => {
        console.log('[WebRTC] Received remote track');
        if (event.streams && event.streams[0]) {
          setCallState(prev => ({ ...prev, remoteStream: event.streams[0] }));
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          console.log('[WebRTC] ICE candidate:', event.candidate);
          // Call callback if registered
          if (iceCandidateCallbackRef.current) {
            iceCandidateCallbackRef.current({
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            });
          }
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
      };

      peerConnectionRef.current = pc;
      setCallState(prev => ({ ...prev, peerConnection: pc }));
      return pc;
    } catch (error) {
      console.error('[WebRTC] Error creating peer connection:', error);
      return null;
    }
  }, [webrtc]);

  // Set ICE candidate callback
  const setIceCandidateCallback = useCallback((callback: (candidate: RTCIceCandidateInit) => void) => {
    iceCandidateCallbackRef.current = callback;
  }, []);

  // Get user media (camera and microphone)
  const getLocalStream = useCallback(async (isVideo: boolean = true) => {
    if (!webrtc || !webrtc.getUserMedia) {
      throw new Error('WebRTC getUserMedia not available');
    }

    try {
      // Stop existing stream if any
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: true,
        video: isVideo ? {
          facingMode: callState.isFrontCamera ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } : false,
      };

      let stream: MediaStream;
      if (Platform.OS === 'web') {
        // Browser native getUserMedia
        stream = await navigator.mediaDevices.getUserMedia(constraints) as any;
      } else {
        // React Native WebRTC
        stream = await webrtc.getUserMedia(constraints) as any;
      }

      // Add toURL method for compatibility
      if (!stream.toURL) {
        (stream as any).toURL = () => {
          if (Platform.OS === 'web') {
            // For web, return object URL
            return URL.createObjectURL(stream as any);
          }
          return '';
        };
      }

      localStreamRef.current = stream as any;
      setCallState(prev => ({ ...prev, localStream: stream as any }));
      return stream as any;
    } catch (error) {
      console.error('[WebRTC] Error getting user media:', error);
      throw error;
    }
  }, [webrtc, callState.isFrontCamera]);

  // Create offer (caller)
  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current) {
      const pc = createPeerConnection();
      if (!pc) throw new Error('Failed to create peer connection');
    }

    try {
      const offer = await peerConnectionRef.current!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callState.isVideoEnabled,
      });
      
      await peerConnectionRef.current!.setLocalDescription(offer);
      console.log('[WebRTC] Created offer:', offer);
      return offer;
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
      throw error;
    }
  }, [callState.isVideoEnabled, createPeerConnection]);

  // Create answer (callee)
  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      const pc = createPeerConnection();
      if (!pc) throw new Error('Failed to create peer connection');
    }

    if (!webrtc || !webrtc.RTCSessionDescription) {
      throw new Error('RTCSessionDescription not available');
    }

    try {
      const sessionDescription = new webrtc.RTCSessionDescription(offer);
      await peerConnectionRef.current!.setRemoteDescription(sessionDescription);
      const answer = await peerConnectionRef.current!.createAnswer();
      await peerConnectionRef.current!.setLocalDescription(answer);
      console.log('[WebRTC] Created answer:', answer);
      return answer;
    } catch (error) {
      console.error('[WebRTC] Error creating answer:', error);
      throw error;
    }
  }, [createPeerConnection, webrtc]);

  // Set remote description (caller receives answer)
  const setRemoteDescription = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      throw new Error('Peer connection not initialized');
    }
    if (!webrtc || !webrtc.RTCSessionDescription) {
      throw new Error('RTCSessionDescription not available');
    }
    try {
      const sessionDescription = new webrtc.RTCSessionDescription(answer);
      await peerConnectionRef.current.setRemoteDescription(sessionDescription);
      console.log('[WebRTC] Set remote description (answer)');
    } catch (error) {
      console.error('[WebRTC] Error setting remote description:', error);
      throw error;
    }
  }, [webrtc]);

  // Add ICE candidate
  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) {
      console.warn('[WebRTC] Peer connection not ready for ICE candidate');
      return;
    }
    if (!webrtc || !webrtc.RTCIceCandidate) {
      console.warn('[WebRTC] RTCIceCandidate not available');
      return;
    }
    try {
      const iceCandidate = new webrtc.RTCIceCandidate(candidate);
      await peerConnectionRef.current.addIceCandidate(iceCandidate);
      console.log('[WebRTC] Added ICE candidate');
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
    }
  }, [webrtc]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track: MediaStreamTrack) => {
        track.enabled = !track.enabled;
      });
      setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track: MediaStreamTrack) => {
        track.enabled = !track.enabled;
      });
      setCallState(prev => ({ ...prev, isVideoEnabled: !prev.isVideoEnabled }));
    }
  }, []);

  // Switch camera
  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack && 'switchCamera' in videoTrack && typeof (videoTrack as any).switchCamera === 'function') {
      (videoTrack as any).switchCamera();
      setCallState(prev => ({ ...prev, isFrontCamera: !prev.isFrontCamera }));
    } else {
      // Fallback: recreate stream with different camera
      const newStream = await getLocalStream(true);
      if (newStream && peerConnectionRef.current) {
        // Replace tracks in peer connection
        const sender = peerConnectionRef.current.getSenders().find((s: any) => 
          s.track && s.track.kind === 'video'
        );
        if (sender && newStream.getVideoTracks()[0]) {
          await sender.replaceTrack(newStream.getVideoTracks()[0]);
        }
      }
    }
  }, [getLocalStream]);

  // End call - cleanup
  const endCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {
        console.warn('[WebRTC] Error closing peer connection:', e);
      }
      peerConnectionRef.current = null;
    }

    setCallState({
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      isMuted: false,
      isVideoEnabled: true,
      isFrontCamera: true,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    ...callState,
    createPeerConnection,
    getLocalStream,
    createOffer,
    createAnswer,
    setRemoteDescription,
    addIceCandidate,
    setIceCandidateCallback,
    toggleMute,
    toggleVideo,
    switchCamera,
    endCall,
  };
};
