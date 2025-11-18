import { useRef, useCallback, useState, useEffect } from 'react';
import { Platform } from 'react-native';

// Conditionally import react-native-webrtc for native platforms
let RTCModule: any = null;
if (Platform.OS !== 'web') {
  try {
    RTCModule = require('react-native-webrtc');
  } catch (e) {
    console.warn('[WebRTC] react-native-webrtc not available:', e);
  }
}

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
  id?: string;
}

interface MediaStreamTrack {
  enabled: boolean;
  kind: string;
  stop: () => void;
  id?: string;
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
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return null;
    }
    
    return {
      RTCPeerConnection: window.RTCPeerConnection || (window as any).webkitRTCPeerConnection || (window as any).mozRTCPeerConnection,
      RTCSessionDescription: window.RTCSessionDescription || (window as any).webkitRTCSessionDescription || (window as any).mozRTCSessionDescription,
      RTCIceCandidate: window.RTCIceCandidate || (window as any).webkitRTCIceCandidate || (window as any).mozRTCIceCandidate,
      MediaStream: window.MediaStream,
      mediaDevices: navigator.mediaDevices,
      getUserMedia: navigator.mediaDevices?.getUserMedia || 
                   (navigator as any).getUserMedia || 
                   (navigator as any).webkitGetUserMedia || 
                   (navigator as any).mozGetUserMedia,
    };
  } else {
    // For native platforms, use react-native-webrtc
    if (RTCModule) {
      return {
        RTCPeerConnection: RTCModule.RTCPeerConnection,
        RTCSessionDescription: RTCModule.RTCSessionDescription,
        RTCIceCandidate: RTCModule.RTCIceCandidate,
        MediaStream: RTCModule.MediaStream,
        mediaDevices: RTCModule.mediaDevices,
        getUserMedia: RTCModule.mediaDevices?.getUserMedia,
      };
    }
    return null;
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
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateCallbackRef = useRef<((candidate: RTCIceCandidateInit) => void) | null>(null);
  const connectionStateCallbackRef = useRef<((state: string) => void) | null>(null);
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
        console.log('[WebRTC] Received remote track:', event.track?.kind, event.track?.id);
        
        // Get or create remote stream
        let remoteStream = remoteStreamRef.current;
        
        if (!remoteStream && webrtc?.MediaStream) {
          // Create new remote stream if it doesn't exist
          remoteStream = new webrtc.MediaStream();
          remoteStreamRef.current = remoteStream;
        } else if (!remoteStream && Platform.OS === 'web') {
          // For web, use event.streams[0] if available
          if (event.streams && event.streams[0]) {
            remoteStream = event.streams[0];
            remoteStreamRef.current = remoteStream;
          }
        }
        
        // Add track to remote stream if we have a stream object
        if (event.track && remoteStream) {
          // Check if track is already in the stream
          const existingTracks = remoteStream.getTracks();
          const trackExists = existingTracks.some((t: MediaStreamTrack) => t.id === event.track.id);
          
          if (!trackExists) {
            console.log('[WebRTC] Adding track to remote stream:', event.track.kind);
            remoteStream.addTrack(event.track);
            
            // Ensure track is enabled
            event.track.enabled = true;
            
            // For audio tracks on native, log to help debug
            if (event.track.kind === 'audio' && Platform.OS !== 'web') {
              console.log('[WebRTC] Audio track added and enabled:', event.track.id, event.track.enabled);
            }
            
            // Add toURL method for native platforms if not present
            if (Platform.OS !== 'web' && !(remoteStream as any).toURL) {
              (remoteStream as any).toURL = () => {
                // For react-native-webrtc, return stream ID as URL
                return (remoteStream as any).id || '';
              };
            }
            
            // Update state with the stream
            setCallState(prev => ({ ...prev, remoteStream: remoteStream as any }));
          }
        } else if (event.streams && event.streams[0]) {
          // Fallback: use the stream from the event
          const stream = event.streams[0];
          
          // Enable all tracks in the stream
          stream.getTracks().forEach((track: MediaStreamTrack) => {
            track.enabled = true;
            console.log('[WebRTC] Enabled remote track:', track.kind, track.id);
          });
          
          // Add toURL method for native platforms if not present
          if (Platform.OS !== 'web' && !(stream as any).toURL) {
            (stream as any).toURL = () => {
              // For react-native-webrtc, return stream ID as URL
              return (stream as any).id || '';
            };
          }
          
          remoteStreamRef.current = stream as any;
          setCallState(prev => ({ ...prev, remoteStream: stream as any }));
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
        const state = pc.connectionState;
        console.log('[WebRTC] Connection state:', state);
        if (connectionStateCallbackRef.current) {
          connectionStateCallbackRef.current(state);
        }
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

  // Set connection state callback
  const setConnectionStateCallback = useCallback((callback: (state: string) => void) => {
    connectionStateCallbackRef.current = callback;
  }, []);

  // Get user media (camera and microphone)
  const getLocalStream = useCallback(async (isVideo: boolean = true) => {
    try {
      // Stop existing stream if any
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: isVideo ? {
          facingMode: callState.isFrontCamera ? 'user' : 'environment',
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        } : false,
      };

      let stream: MediaStream;
      if (Platform.OS === 'web') {
        // Browser native getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('getUserMedia is not supported in this browser');
        }
        stream = await navigator.mediaDevices.getUserMedia(constraints) as any;
      } else {
        // React Native WebRTC
        if (!webrtc) {
          throw new Error('WebRTC is not available on this platform');
        }
        if (!webrtc.mediaDevices || !webrtc.mediaDevices.getUserMedia) {
          throw new Error('WebRTC mediaDevices.getUserMedia not available on native platform');
        }
        stream = await webrtc.mediaDevices.getUserMedia(constraints) as any;
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

      // Ensure all tracks are enabled
      stream.getTracks().forEach((track: MediaStreamTrack) => {
        track.enabled = true;
        console.log('[WebRTC] Local track enabled:', track.kind, track.id, track.enabled);
      });

      localStreamRef.current = stream as any;
      setCallState(prev => ({ ...prev, localStream: stream as any }));
      return stream as any;
    } catch (error) {
      console.error('[WebRTC] Error getting user media:', error);
      throw error;
    }
  }, [webrtc, callState.isFrontCamera]);

  // Create offer (caller)
  const createOffer = useCallback(async (isVideoCall: boolean = true) => {
    if (!peerConnectionRef.current) {
      const pc = createPeerConnection();
      if (!pc) throw new Error('Failed to create peer connection');
    }

    // Ensure local stream tracks are added to peer connection
    if (localStreamRef.current && peerConnectionRef.current) {
      const existingSenders = peerConnectionRef.current.getSenders();
      const existingTrackIds = existingSenders.map(s => s.track?.id).filter(Boolean);
      
      localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
        // Only add track if it's not already added
        if (!existingTrackIds.includes(track.id)) {
          console.log('[WebRTC] Adding track to peer connection:', track.kind, track.id);
          peerConnectionRef.current!.addTrack(track, localStreamRef.current as any);
        }
      });
    }

    try {
      const offer = await peerConnectionRef.current!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideoCall,
      });
      
      await peerConnectionRef.current!.setLocalDescription(offer);
      console.log('[WebRTC] Created offer:', offer);
      return offer;
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
      throw error;
    }
  }, [createPeerConnection]);

  // Create answer (callee)
  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      const pc = createPeerConnection();
      if (!pc) throw new Error('Failed to create peer connection');
    }

    // Ensure local stream tracks are added to peer connection
    if (localStreamRef.current && peerConnectionRef.current) {
      const existingSenders = peerConnectionRef.current.getSenders();
      const existingTrackIds = existingSenders.map(s => s.track?.id).filter(Boolean);
      
      localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
        // Only add track if it's not already added
        if (!existingTrackIds.includes(track.id)) {
          console.log('[WebRTC] Adding track to peer connection:', track.kind, track.id);
          peerConnectionRef.current!.addTrack(track, localStreamRef.current as any);
        }
      });
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

    // Stop remote stream tracks
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      remoteStreamRef.current = null;
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
    setConnectionStateCallback,
    toggleMute,
    toggleVideo,
    switchCamera,
    endCall,
  };
};
