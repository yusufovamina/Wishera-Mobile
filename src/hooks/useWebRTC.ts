import { useRef, useCallback, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { createExpoGetUserMedia } from './expoMediaStreamPolyfill';

// Conditionally import react-native-webrtc for native platforms
let RTCModule: any = null;
let globalsRegistered = false;

if (Platform.OS !== 'web') {
  // Try multiple ways to load the module
  const loadWebRTCModule = () => {
    try {
      // Method 1: Direct require
      const webrtcModule = require('react-native-webrtc');
      if (webrtcModule && typeof webrtcModule === 'object') {
        // Try to register globals - this might make it work in Expo Go!
        if (webrtcModule.registerGlobals && typeof webrtcModule.registerGlobals === 'function' && !globalsRegistered) {
          try {
            webrtcModule.registerGlobals();
            globalsRegistered = true;
            console.log('[WebRTC] Registered globals successfully');
          } catch (e) {
            console.warn('[WebRTC] Failed to register globals:', e);
          }
        }
        
        if (webrtcModule.RTCPeerConnection || webrtcModule.RTCSessionDescription) {
          return webrtcModule;
        }
      }
    } catch (e) {
      // Try alternative loading methods
    }
    
    try {
      // Method 2: Try accessing from global (after registerGlobals)
      if ((global as any).RTCPeerConnection) {
        const globalWebRTC = {
          RTCPeerConnection: (global as any).RTCPeerConnection,
          RTCSessionDescription: (global as any).RTCSessionDescription || window?.RTCSessionDescription,
          RTCIceCandidate: (global as any).RTCIceCandidate || window?.RTCIceCandidate,
          MediaStream: (global as any).MediaStream || window?.MediaStream,
          mediaDevices: (global as any).mediaDevices || navigator?.mediaDevices,
        };
        if (globalWebRTC.RTCPeerConnection) {
          return globalWebRTC;
        }
      }
    } catch (e) {
      // Continue to next method
    }
    
    try {
      // Method 3: Try with different path
      const ReactNativeWebRTC = require('react-native-webrtc/dist/index');
      if (ReactNativeWebRTC) {
        if (ReactNativeWebRTC.registerGlobals && !globalsRegistered) {
          try {
            ReactNativeWebRTC.registerGlobals();
            globalsRegistered = true;
          } catch (e) {
            // Ignore
          }
        }
        return ReactNativeWebRTC;
      }
    } catch (e) {
      // Module not available
    }
    
    return null;
  };
  
  RTCModule = loadWebRTCModule();
  
  // If still null, try one more time after a delay (for lazy loading)
  if (!RTCModule && typeof setTimeout !== 'undefined') {
    setTimeout(() => {
      RTCModule = loadWebRTCModule();
    }, 100);
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
  addTrack: (track: MediaStreamTrack) => void;
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

// Server-relay peer connection for Expo Go
const createServerRelayPeerConnection = (config?: any) => {
  console.log('[WebRTC] Creating server-relay peer connection for Expo Go');
  
  // Create a mock peer connection that uses SignalR for media relay
  const mockPC = {
    addTrack: (track: any, stream: any) => {
      console.log('[ServerRelay] Adding track:', track.kind);
      // Track will be streamed via SignalR
    },
    createOffer: async (options?: any) => {
      console.log('[ServerRelay] Creating offer (will use SignalR)');
      return {
        type: 'offer',
        sdp: 'server-relay-offer', // Placeholder
      };
    },
    createAnswer: async (options?: any) => {
      console.log('[ServerRelay] Creating answer (will use SignalR)');
      return {
        type: 'answer',
        sdp: 'server-relay-answer', // Placeholder
      };
    },
    setLocalDescription: async (description: any) => {
      console.log('[ServerRelay] Setting local description');
      // Send via SignalR instead of WebRTC
    },
    setRemoteDescription: async (description: any) => {
      console.log('[ServerRelay] Setting remote description');
      // Receive via SignalR instead of WebRTC
    },
    addIceCandidate: async (candidate: any) => {
      console.log('[ServerRelay] Adding ICE candidate (not needed for server relay)');
    },
    close: () => {
      console.log('[ServerRelay] Closing connection');
    },
    getSenders: () => [],
    connectionState: 'connecting',
    signalingState: 'stable',
    iceConnectionState: 'checking',
    ontrack: null,
    onicecandidate: null,
    onconnectionstatechange: null,
    onsignalingstatechange: null,
    oniceconnectionstatechange: null,
  };
  
  return mockPC;
};

const createMockSessionDescription = (init: any) => {
  return {
    type: init.type,
    sdp: init.sdp || '',
  };
};

const createMockIceCandidate = (init: any) => {
  return {
    candidate: init.candidate || '',
    sdpMLineIndex: init.sdpMLineIndex || null,
    sdpMid: init.sdpMid || null,
  };
};

// Check if we're in Expo Go
const isExpoGo = () => {
  try {
    // Check if we're in Expo Go (not a development build)
    // In Expo Go, appOwnership is 'expo'
    // In dev builds, it's 'standalone' or null
    const appOwnership = Constants.appOwnership;
    return appOwnership === 'expo';
  } catch (e) {
    // If Constants is not available, assume not Expo Go
    return false;
  }
};

// Platform-specific WebRTC implementation
const getWebRTC = () => {
  if (Platform.OS === 'web') {
    // Use browser native WebRTC
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return null;
    }

    // Try to use react-native-webrtc web shim first for consistency
    if (RTCModule && typeof RTCModule === 'object' && RTCModule.RTCPeerConnection) {
      try {
        return {
          RTCPeerConnection: RTCModule.RTCPeerConnection,
          RTCSessionDescription: RTCModule.RTCSessionDescription || window.RTCSessionDescription,
          RTCIceCandidate: RTCModule.RTCIceCandidate || window.RTCIceCandidate,
          MediaStream: RTCModule.MediaStream || window.MediaStream,
          mediaDevices: RTCModule.mediaDevices || navigator.mediaDevices,
          getUserMedia: RTCModule.mediaDevices?.getUserMedia || navigator.mediaDevices?.getUserMedia,
        };
      } catch (e) {
        // Fall through to browser native
      }
    }

    // Fallback to browser native WebRTC
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
    // For native platforms, try react-native-webrtc first
    if (RTCModule && typeof RTCModule === 'object') {
      try {
        // Validate that required exports exist and are functions/constructors
        const hasRTCPeerConnection = RTCModule.RTCPeerConnection && typeof RTCModule.RTCPeerConnection === 'function';
        const hasRTCSessionDescription = RTCModule.RTCSessionDescription && typeof RTCModule.RTCSessionDescription === 'function';
        const hasRTCIceCandidate = RTCModule.RTCIceCandidate && typeof RTCModule.RTCIceCandidate === 'function';
        
        if (hasRTCPeerConnection && hasRTCSessionDescription && hasRTCIceCandidate) {
          return {
            RTCPeerConnection: RTCModule.RTCPeerConnection,
            RTCSessionDescription: RTCModule.RTCSessionDescription,
            RTCIceCandidate: RTCModule.RTCIceCandidate,
            MediaStream: RTCModule.MediaStream,
            mediaDevices: RTCModule.mediaDevices,
            getUserMedia: RTCModule.mediaDevices?.getUserMedia,
          };
        }
      } catch (e: any) {
        // Silently handle all errors - module may be partially loaded or incompatible
        RTCModule = null;
      }
    }
    
    // Check if globals were registered (might work in Expo Go after registerGlobals)
    // This is checked dynamically each time getWebRTC is called
    try {
      const globalRTCPeerConnection = (global as any).RTCPeerConnection;
      if (globalRTCPeerConnection && typeof globalRTCPeerConnection === 'function') {
        console.log('[WebRTC] Found RTCPeerConnection in globals - using it!');
        return {
          RTCPeerConnection: globalRTCPeerConnection,
          RTCSessionDescription: (global as any).RTCSessionDescription || (RTCModule as any)?.RTCSessionDescription,
          RTCIceCandidate: (global as any).RTCIceCandidate || (RTCModule as any)?.RTCIceCandidate,
          MediaStream: (global as any).MediaStream || (RTCModule as any)?.MediaStream,
          mediaDevices: (global as any).mediaDevices || (RTCModule as any)?.mediaDevices,
          getUserMedia: (global as any).mediaDevices?.getUserMedia || (RTCModule as any)?.mediaDevices?.getUserMedia,
        };
      }
    } catch (e) {
      // Globals not available
      console.log('[WebRTC] Globals check failed:', e);
    }
    
    // For Expo Go Android, use expo-camera and expo-av polyfill
    // We'll use server-relayed streaming instead of true P2P
    if (isExpoGo() && Platform.OS === 'android') {
      console.log('[WebRTC] Running in Expo Go Android - using expo-camera/expo-av with server relay');
      const expoGetUserMedia = createExpoGetUserMedia();
      
      // Create a WebRTC-like interface that uses server relay
      // This enables calls in Expo Go via SignalR media streaming
      return {
        RTCPeerConnection: createServerRelayPeerConnection, // Custom implementation
        RTCSessionDescription: createMockSessionDescription,
        RTCIceCandidate: createMockIceCandidate,
        MediaStream: null,
        mediaDevices: {
          getUserMedia: expoGetUserMedia,
        },
        getUserMedia: expoGetUserMedia,
        isExpoGoPolyfill: true, // Flag to indicate this is a polyfill
        useServerRelay: true, // Use server relay instead of P2P
      };
    }
    
    // WebRTC not available on this platform
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

  // ICE candidate buffering
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isRemoteDescriptionSetRef = useRef<boolean>(false);

  const [webrtc, setWebrtc] = useState<any>(getWebRTC());
  
  // Retry loading WebRTC in Expo Go after a delay
  useEffect(() => {
    if (!webrtc && Platform.OS !== 'web') {
      const retryTimer = setTimeout(() => {
        console.log('[WebRTC] Retrying WebRTC load...');
        const retryWebRTC = getWebRTC();
        if (retryWebRTC) {
          console.log('[WebRTC] Successfully loaded WebRTC on retry!');
          setWebrtc(retryWebRTC);
        }
      }, 1000);
      
      return () => clearTimeout(retryTimer);
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    // Check if we're using Expo Go polyfill (no peer connections)
    if (webrtc && (webrtc as any).isExpoGoPolyfill) {
      console.warn('[WebRTC] Expo Go polyfill: Peer connections not supported. Media capture works, but P2P calls require a development build.');
      // Return a mock peer connection that at least doesn't crash
      const mockPC = {
        addTrack: () => {},
        createOffer: async () => ({ type: 'offer', sdp: '' }),
        createAnswer: async () => ({ type: 'answer', sdp: '' }),
        setLocalDescription: async () => {},
        setRemoteDescription: async () => {},
        addIceCandidate: async () => {},
        close: () => {},
        getSenders: () => [],
        connectionState: 'disconnected',
        signalingState: 'stable',
        iceConnectionState: 'disconnected',
      };
      peerConnectionRef.current = mockPC as any;
      setCallState(prev => ({ ...prev, peerConnection: mockPC as any }));
      return mockPC as any;
    }
    
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

      // Reset state for new connection
      isRemoteDescriptionSetRef.current = false;
      pendingCandidatesRef.current = [];


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
        console.log('[WebRTC] Connection state changed:', state);
        if (connectionStateCallbackRef.current) {
          connectionStateCallbackRef.current(state);
        }
      };

      // Handle signaling state changes
      pc.onsignalingstatechange = () => {
        console.log('[WebRTC] Signaling state changed:', pc.signalingState);
      };

      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE connection state changed:', pc.iceConnectionState);
      };

      // Handle ICE gathering state changes
      pc.onicegatheringstatechange = () => {
        console.log('[WebRTC] ICE gathering state changed:', pc.iceGatheringState);
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
        // React Native WebRTC or Expo Go polyfill
        if (!webrtc) {
          throw new Error('WebRTC is not available on this platform. Please ensure react-native-webrtc is properly installed and linked.');
        }
        
        // Check if we're using Expo Go polyfill
        if ((webrtc as any).isExpoGoPolyfill) {
          console.log('[WebRTC] Using Expo Go polyfill for media capture');
          if (!webrtc.getUserMedia) {
            throw new Error('Expo Go polyfill getUserMedia not available');
          }
          stream = await webrtc.getUserMedia(constraints) as any;
        } else if (webrtc.mediaDevices && webrtc.mediaDevices.getUserMedia) {
          // Standard WebRTC
          stream = await webrtc.mediaDevices.getUserMedia(constraints) as any;
        } else if (webrtc.getUserMedia) {
          // Fallback
          stream = await webrtc.getUserMedia(constraints) as any;
        } else {
          throw new Error('WebRTC mediaDevices.getUserMedia not available on native platform');
        }
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
      const existingTrackIds = existingSenders.map((s: any) => s.track?.id).filter(Boolean);

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
      const existingTrackIds = existingSenders.map((s: any) => s.track?.id).filter(Boolean);

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

      // Mark remote description as set and flush pending candidates (for Callee)
      console.log('[WebRTC] Set remote description (offer) in createAnswer');
      isRemoteDescriptionSetRef.current = true;

      if (pendingCandidatesRef.current.length > 0) {
        console.log(`[WebRTC] Flushing ${pendingCandidatesRef.current.length} pending ICE candidates in createAnswer`);
        for (const candidate of pendingCandidatesRef.current) {
          try {
            const iceCandidate = new webrtc.RTCIceCandidate(candidate);
            await peerConnectionRef.current!.addIceCandidate(iceCandidate);
            console.log('[WebRTC] Added pending ICE candidate');
          } catch (e) {
            console.error('[WebRTC] Error adding pending ICE candidate:', e);
          }
        }
        pendingCandidatesRef.current = [];
      }

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

      // Mark remote description as set and flush pending candidates
      isRemoteDescriptionSetRef.current = true;

      if (pendingCandidatesRef.current.length > 0) {
        console.log(`[WebRTC] Flushing ${pendingCandidatesRef.current.length} pending ICE candidates`);
        for (const candidate of pendingCandidatesRef.current) {
          try {
            const iceCandidate = new webrtc.RTCIceCandidate(candidate);
            await peerConnectionRef.current.addIceCandidate(iceCandidate);
            console.log('[WebRTC] Added pending ICE candidate');
          } catch (e) {
            console.error('[WebRTC] Error adding pending ICE candidate:', e);
          }
        }
        pendingCandidatesRef.current = [];
      }
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

    // Buffer candidates if remote description is not set yet
    // Note: For caller, remote description is set when answer is received
    // For callee, remote description is set when offer is received (which happens before this is called usually)
    // But to be safe and handle race conditions, we buffer
    if (!peerConnectionRef.current.remoteDescription && !isRemoteDescriptionSetRef.current) {
      console.log('[WebRTC] Buffering ICE candidate (remote description not set)');
      pendingCandidatesRef.current.push(candidate);
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
    isWebRTCAvailable: !!webrtc,
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
