import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LiveKitSession,
  P2PSession,
  startLive,
  joinLive,
  endLive,
  startBattle,
  joinBattle,
  type StartLiveResult,
  type StreamMode,
} from '../lib/livekitService';
import { supabase } from '../lib/supabase';

interface UseLiveRoomOptions {
  isBroadcast: boolean;
  streamId: string;
  onViewerCount?: (count: number) => void;
  onChatMessage?: (data: any) => void;
  onDisconnected?: () => void;
}

interface RemoteStream {
  peerId: string;
  stream: MediaStream;
}

export function useLiveRoom(options: UseLiveRoomOptions) {
  const { isBroadcast, streamId, onViewerCount, onChatMessage, onDisconnected } = options;

  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<StreamMode | null>(null);
  const [roomName, setRoomName] = useState<string>('');
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [error, setError] = useState<string | null>(null);

  const lkSessionRef = useRef<LiveKitSession | null>(null);
  const p2pSessionRef = useRef<P2PSession | null>(null);
  const cleanupRef = useRef(false);

  // Start broadcasting
  const startBroadcast = useCallback(async (localStream: MediaStream, title?: string) => {
    try {
      setError(null);
      const result = await startLive(title);
      setMode(result.mode);
      setRoomName(result.room);

      if (result.mode === 'sfu' && result.token && result.livekit_url) {
        const session = new LiveKitSession();
        lkSessionRef.current = session;

        session.setOnRemoteTrack((track, participant) => {
          if (track.kind === 'video') {
            const stream = new MediaStream([track]);
            setRemoteStreams(prev => {
              const filtered = prev.filter(s => s.peerId !== participant.identity);
              return [...filtered, { peerId: participant.identity, stream }];
            });
          }
        });

        session.setOnRemoteTrackUnsubscribed((participant) => {
          setRemoteStreams(prev => prev.filter(s => s.peerId !== participant.identity));
        });

        session.setOnDisconnected(() => {
          setConnected(false);
          onDisconnected?.();
        });

        await session.connect(result.livekit_url, result.token);
        await session.publishCamera(localStream);
        setConnected(true);

      } else {
        // P2P fallback
        const wsUrl = result.ws_url || `wss://${window.location.host}`;
        const { data: authData } = await supabase.auth.getSession();
        const token = authData?.session?.access_token || '';

        const session = new P2PSession(result.room, true);
        p2pSessionRef.current = session;

        session.setLocalStream(localStream);

        session.setOnViewerCount((count) => onViewerCount?.(count));
        session.setOnChatMessage((data) => onChatMessage?.(data));
        session.setOnDisconnected(() => {
          setConnected(false);
          onDisconnected?.();
        });

        await session.connect(wsUrl, token);
        setConnected(true);
      }

      return result.room;
    } catch (e: any) {
      setError(e.message);
      console.error('[useLiveRoom] Start broadcast failed:', e);
      return null;
    }
  }, [onViewerCount, onChatMessage, onDisconnected]);

  // Join as viewer
  const joinAsViewer = useCallback(async (room: string): Promise<MediaStream | null> => {
    try {
      setError(null);
      const result = await joinLive(room);
      setMode(result.mode);
      setRoomName(room);

      if (result.mode === 'sfu' && result.token && result.livekit_url) {
        const session = new LiveKitSession();
        lkSessionRef.current = session;

        return new Promise((resolve) => {
          let resolved = false;

          session.setOnRemoteTrack((track, participant) => {
            if (track.kind === 'video' && !resolved) {
              resolved = true;
              const stream = new MediaStream([track]);
              setRemoteStreams(prev => [...prev, { peerId: participant.identity, stream }]);
              resolve(stream);
            } else if (track.kind === 'video') {
              const stream = new MediaStream([track]);
              setRemoteStreams(prev => {
                const filtered = prev.filter(s => s.peerId !== participant.identity);
                return [...filtered, { peerId: participant.identity, stream }];
              });
            }
          });

          session.setOnRemoteTrackUnsubscribed((participant) => {
            setRemoteStreams(prev => prev.filter(s => s.peerId !== participant.identity));
          });

          session.setOnDisconnected(() => {
            setConnected(false);
            onDisconnected?.();
          });

          session.connect(result.livekit_url!, result.token!).then(() => {
            setConnected(true);
            // If no track received in 5s, resolve null
            setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, 5000);
          });
        });

      } else {
        // P2P fallback
        const wsUrl = result.ws_url || `wss://${window.location.host}`;
        const { data: authData } = await supabase.auth.getSession();
        const token = authData?.session?.access_token || '';

        const session = new P2PSession(room, false);
        p2pSessionRef.current = session;

        return new Promise((resolve) => {
          let resolved = false;

          session.setOnRemoteStream((stream, peerId) => {
            setRemoteStreams(prev => {
              const filtered = prev.filter(s => s.peerId !== peerId);
              return [...filtered, { peerId, stream }];
            });
            if (!resolved) {
              resolved = true;
              resolve(stream);
            }
          });

          session.setOnViewerCount((count) => onViewerCount?.(count));
          session.setOnChatMessage((data) => onChatMessage?.(data));
          session.setOnPeerDisconnected((peerId) => {
            setRemoteStreams(prev => prev.filter(s => s.peerId !== peerId));
          });
          session.setOnDisconnected(() => {
            setConnected(false);
            onDisconnected?.();
          });

          session.connect(wsUrl, token).then(() => {
            setConnected(true);
            setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, 8000);
          });
        });
      }
    } catch (e: any) {
      setError(e.message);
      console.error('[useLiveRoom] Join failed:', e);
      return null;
    }
  }, [onViewerCount, onChatMessage, onDisconnected]);

  // Send chat via WebSocket (P2P mode)
  const sendChat = useCallback((text: string) => {
    p2pSessionRef.current?.sendWs('chat_message', { text });
  }, []);

  // Send gift via WebSocket (P2P mode)
  const sendGift = useCallback((giftData: any) => {
    p2pSessionRef.current?.sendWs('gift_sent', giftData);
  }, []);

  // End stream
  const disconnect = useCallback(async () => {
    cleanupRef.current = true;
    if (roomName) {
      try { await endLive(roomName); } catch {}
    }
    await lkSessionRef.current?.disconnect();
    await p2pSessionRef.current?.disconnect();
    lkSessionRef.current = null;
    p2pSessionRef.current = null;
    setConnected(false);
    setRemoteStreams([]);
  }, [roomName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!cleanupRef.current) {
        lkSessionRef.current?.disconnect();
        p2pSessionRef.current?.disconnect();
      }
    };
  }, []);

  return {
    connected,
    mode,
    roomName,
    remoteStreams,
    error,
    startBroadcast,
    joinAsViewer,
    sendChat,
    sendGift,
    disconnect,
  };
}
