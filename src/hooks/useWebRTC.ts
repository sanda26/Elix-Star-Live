import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';

interface WebRTCConfig {
  roomId: string;
  isBroadcaster: boolean;
}

interface PeerConnection {
  pc: RTCPeerConnection;
  userId: string;
  stream?: MediaStream;
}

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'stream-start' | 'stream-end';
  from: string;
  to?: string;
  roomId: string;
  data?: any;
  candidate?: RTCIceCandidateInit;
}

export function useWebRTC({ roomId, isBroadcaster }: WebRTCConfig) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const user = useAuthStore(s => s.user);

  // STUN/TURN servers configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Add TURN servers for production
      // { urls: 'turn:your-turn-server.com:3478', username: 'user', credential: 'pass' }
    ]
  };

  // Initialize Local Stream (Camera/Mic)
  const startLocalStream = useCallback(async () => {
    try {
      // If we already have a stream, don't re-request
      if (localStreamRef.current) return localStreamRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      // Notify others that stream started
      if (wsRef.current && isBroadcaster) {
        wsRef.current.send(JSON.stringify({
          type: 'stream-start',
          from: user?.id || '',
          roomId,
          data: { viewerCount: peersRef.current.size }
        }));
      }
      
      return stream;
    } catch (error) {
      console.error('Failed to get local stream:', error);
      throw error;
    }
  }, [roomId, isBroadcaster, user?.id]);

  // Create peer connection
  const createPeerConnection = useCallback((userId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(iceServers);
    
    // Add local stream tracks if broadcaster
    if (isBroadcaster && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          from: user?.id || '',
          to: userId,
          roomId,
          candidate: event.candidate
        }));
      }
    };

    // Handle remote streams
    pc.ontrack = (event) => {
      if (event.streams[0]) {
        setRemoteStreams(prev => new Map(prev.set(userId, event.streams[0])));
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}:`, pc.connectionState);
      
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
        
        // Remove peer from ref
        peersRef.current.delete(userId);
        
        // Update viewer count
        setViewerCount(peersRef.current.size);
      }
    };

    return pc;
  }, [isBroadcaster, user?.id]);

  // Handle incoming signaling messages
  const handleSignalingMessage = useCallback(async (message: SignalingMessage) => {
    const { type, from, to, data, candidate } = message;
    
    switch (type) {
      case 'join':
        if (isBroadcaster && to === user?.id) {
          // Create peer connection for new viewer
          const pc = createPeerConnection(from);
          peersRef.current.set(from, { pc, userId: from });
          
          // Create offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          
          // Send offer to viewer
          if (wsRef.current) {
            wsRef.current.send(JSON.stringify({
              type: 'offer',
              from: user?.id || '',
              to: from,
              roomId,
              data: offer
            }));
          }
        }
        break;

      case 'offer':
        if (!isBroadcaster && to === user?.id) {
          // Create peer connection for broadcaster
          const pc = createPeerConnection(from);
          peersRef.current.set(from, { pc, userId: from });
          
          // Set remote description and create answer
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          // Send answer to broadcaster
          if (wsRef.current) {
            wsRef.current.send(JSON.stringify({
              type: 'answer',
              from: user?.id || '',
              to: from,
              roomId,
              data: answer
            }));
          }
        }
        break;

      case 'answer':
        if (isBroadcaster && to === user?.id) {
          const peer = peersRef.current.get(from);
          if (peer) {
            await peer.pc.setRemoteDescription(new RTCSessionDescription(data));
          }
        }
        break;

      case 'ice-candidate':
        if (to === user?.id && candidate) {
          const peer = peersRef.current.get(from);
          if (peer) {
            await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
        break;

      case 'leave':
        // Clean up peer connection
        const peer = peersRef.current.get(from);
        if (peer) {
          peer.pc.close();
          peersRef.current.delete(from);
        }
        break;

      case 'stream-start':
        // Update viewer count when stream starts
        setViewerCount(data?.viewerCount || 0);
        break;

      case 'stream-end':
        // Clean up all connections when stream ends
        peersRef.current.forEach((peer) => {
          peer.pc.close();
        });
        peersRef.current.clear();
        setRemoteStreams(new Map());
        setViewerCount(0);
        break;
    }
  }, [isBroadcaster, user?.id, roomId, createPeerConnection]);

  // Initialize WebSocket & WebRTC
  useEffect(() => {
    if (!roomId || !user?.id) return;

    // Connect to signaling server with fallback
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?roomId=${roomId}&userId=${user.id}`;
    
    let ws: WebSocket | null = null;
    
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('Connected to signaling server');
        setIsConnected(true);
        
        // Join room
        ws?.send(JSON.stringify({
          type: 'join',
          from: user.id,
          roomId,
          data: { isBroadcaster }
        }));
      };
      
      ws.onerror = (error) => {
        console.warn('WebSocket connection failed, using fallback mode:', error);
        setIsConnected(false);
        // Fallback to HTTP polling or disabled WebSocket
      };
      
      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const message: SignalingMessage = JSON.parse(event.data);
          handleSignalingMessage(message);
        } catch (error) {
          console.error('Failed to parse signaling message:', error);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnected(false);
    }

    ws.onclose = () => {
      console.log('Disconnected from signaling server');
      setIsConnected(false);
      
      // Clean up all peer connections
      peersRef.current.forEach((peer) => {
        peer.pc.close();
      });
      peersRef.current.clear();
      setRemoteStreams(new Map());
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;

    return () => {
      // Leave room on cleanup
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'leave',
          from: user.id,
          roomId
        }));
      }
      ws.close();
    };
  }, [roomId, user?.id, isBroadcaster, handleSignalingMessage]);

  // Stop local stream
  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Notify others that stream ended
    if (wsRef.current && isBroadcaster) {
      wsRef.current.send(JSON.stringify({
        type: 'stream-end',
        from: user?.id || '',
        roomId
      }));
    }
  }, [isBroadcaster, user?.id, roomId]);

  // Switch camera
  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current) return;

    try {
      // Stop current tracks
      localStreamRef.current.getTracks().forEach(track => track.stop());

      // Get new stream with different camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: localStreamRef.current.getVideoTracks()[0]?.getSettings().facingMode === 'user' ? 'environment' : 'user'
        },
        audio: true
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Update all peer connections with new stream
      if (isBroadcaster) {
        peersRef.current.forEach((peer) => {
          // Remove old tracks
          peer.pc.getSenders().forEach(sender => {
            peer.pc.removeTrack(sender);
          });
          
          // Add new tracks
          stream.getTracks().forEach(track => {
            peer.pc.addTrack(track, stream);
          });
        });
      }
    } catch (error) {
      console.error('Failed to switch camera:', error);
    }
  }, [isBroadcaster]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
  }, []);

  return {
    localStream,
    remoteStreams,
    isConnected,
    viewerCount,
    startLocalStream,
    stopLocalStream,
    switchCamera,
    toggleAudio,
    toggleVideo
  };
}