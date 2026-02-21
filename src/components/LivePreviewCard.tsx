import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

function buildWsUrl(roomId: string, token: string): string {
  let wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (!wsUrl) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${proto}//${window.location.host}`;
  }
  if (!wsUrl.startsWith('ws://localhost') && wsUrl.startsWith('ws://')) {
    wsUrl = wsUrl.replace('ws://', 'wss://');
  }
  return `${wsUrl}/live/${roomId}?token=${encodeURIComponent(token)}`;
}

interface LivePreviewCardProps {
  streamKey: string;
  name: string;
  avatar?: string;
  viewers: number;
  title?: string;
  isActive: boolean;
  onStreamEnded?: () => void;
}

export default function LivePreviewCard({
  streamKey,
  name,
  avatar,
  viewers,
  title,
  isActive,
  onStreamEnded,
}: LivePreviewCardProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStream, setHasStream] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const mountedRef = useRef(true);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const iceBufRef = useRef<RTCIceCandidateInit[]>([]);
  const hasRemoteDescRef = useRef(false);

  const wsSend = useCallback((event: string, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
    }
  }, []);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      try { ws.close(); } catch {}
      wsRef.current = null;
    }
    hasRemoteDescRef.current = false;
    iceBufRef.current = [];
    if (mountedRef.current) {
      setHasStream(false);
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    if (!isActive || !streamKey) {
      cleanup();
      return;
    }

    const myUserId = user?.id ? `preview-${user.id}-${streamKey.slice(0, 6)}` : `preview-anon-${streamKey.slice(0, 6)}`;
    let cancelled = false;

    const connectPreview = async () => {
      setConnecting(true);

      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || 'anonymous';
      if (cancelled) return;

      const ws = new WebSocket(buildWsUrl(streamKey, token));
      wsRef.current = ws;

      const createPeerAndOffer = (targetUserId: string) => {
        if (pcRef.current) return;

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;
        const remoteStream = new MediaStream();

        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        pc.ontrack = (ev) => {
          ev.streams[0]?.getTracks().forEach(t => remoteStream.addTrack(t));
          if (videoRef.current && mountedRef.current) {
            videoRef.current.srcObject = remoteStream;
            videoRef.current.play().catch(() => {});
            setHasStream(true);
            setConnecting(false);
          }
        };

        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            wsSend('rtc_ice_candidate', {
              target_user_id: targetUserId,
              candidate: ev.candidate.toJSON(),
            });
          }
        };

        pc.onconnectionstatechange = () => {
          const s = pc.connectionState;
          if (s === 'failed' || s === 'disconnected') {
            if (mountedRef.current) {
              setHasStream(false);
              onStreamEnded?.();
            }
          }
        };

        (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            wsSend('rtc_offer', { target_user_id: targetUserId, sdp: offer });
          } catch {}
        })();
      };

      const flushIce = async () => {
        if (!hasRemoteDescRef.current || !pcRef.current) return;
        while (iceBufRef.current.length > 0) {
          const c = iceBufRef.current.shift()!;
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
      };

      ws.onopen = () => {
        wsSend('rtc_join', { user_id: myUserId });
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (cancelled) return;

          if (msg.event === 'rtc_join') {
            const remoteId = msg.data?.user_id;
            if (remoteId && remoteId !== myUserId && !pcRef.current) {
              createPeerAndOffer(remoteId);
            }
          } else if (msg.event === 'rtc_offer') {
            const fromId = msg.data?.from_user_id;
            if (!pcRef.current) {
              const pc = new RTCPeerConnection(ICE_SERVERS);
              pcRef.current = pc;
              const remoteStream = new MediaStream();
              pc.addTransceiver('video', { direction: 'recvonly' });
              pc.addTransceiver('audio', { direction: 'recvonly' });
              pc.ontrack = (ev) => {
                ev.streams[0]?.getTracks().forEach(t => remoteStream.addTrack(t));
                if (videoRef.current && mountedRef.current) {
                  videoRef.current.srcObject = remoteStream;
                  videoRef.current.play().catch(() => {});
                  setHasStream(true);
                  setConnecting(false);
                }
              };
              pc.onicecandidate = (ev) => {
                if (ev.candidate) {
                  wsSend('rtc_ice_candidate', { target_user_id: fromId, candidate: ev.candidate.toJSON() });
                }
              };
              pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                  if (mountedRef.current) { setHasStream(false); onStreamEnded?.(); }
                }
              };
            }
            try {
              await pcRef.current!.setRemoteDescription(new RTCSessionDescription(msg.data.sdp));
              hasRemoteDescRef.current = true;
              const answer = await pcRef.current!.createAnswer();
              await pcRef.current!.setLocalDescription(answer);
              wsSend('rtc_answer', { target_user_id: fromId, sdp: answer });
              await flushIce();
            } catch {}
          } else if (msg.event === 'rtc_answer') {
            if (!pcRef.current) return;
            try {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.data.sdp));
              hasRemoteDescRef.current = true;
              await flushIce();
            } catch {}
          } else if (msg.event === 'rtc_ice_candidate') {
            if (!pcRef.current) return;
            if (hasRemoteDescRef.current) {
              try { await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.data.candidate)); } catch {}
            } else {
              iceBufRef.current.push(msg.data.candidate);
            }
          }
        } catch {}
      };

      ws.onclose = () => {};
      ws.onerror = () => {};
    };

    const timer = setTimeout(connectPreview, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      cleanup();
    };
  }, [isActive, streamKey, user?.id, cleanup, wsSend, onStreamEnded]);

  // Timeout: if no video after 20s, stream is probably dead
  useEffect(() => {
    if (!isActive || hasStream) return;
    const timeout = setTimeout(() => {
      if (!hasStream && mountedRef.current) onStreamEnded?.();
    }, 20000);
    return () => clearTimeout(timeout);
  }, [isActive, hasStream, onStreamEnded]);

  const handleTap = () => {
    cleanup();
    navigate(`/watch/${streamKey}`);
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      className="w-full h-full relative bg-black overflow-hidden"
      title="Tap to join live"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
        style={{ opacity: hasStream ? 1 : 0, transition: 'opacity 0.4s ease' }}
      />

      {!hasStream && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10 gap-4">
          <div className="relative">
            <div className="absolute -inset-2 rounded-full border-2 border-red-500/50 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="w-24 h-24 rounded-full border-[3px] border-red-500 overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.4)] relative z-10">
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#1a1a2e] flex items-center justify-center">
                  <span className="text-[#C9A96E] font-bold text-3xl">{name.slice(0, 1).toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
          <p className="text-white font-semibold text-base">{name}</p>
          {connecting && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
              <span className="text-white/60 text-sm">Connecting...</span>
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-[2] pointer-events-none" />

      <div className="absolute bottom-16 left-0 right-0 z-[5] px-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/90">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-white text-[11px] font-bold">LIVE now</span>
          </div>
          <div className="px-2.5 py-1 rounded bg-white/15 backdrop-blur-sm">
            <span className="text-white text-[11px] font-semibold">
              {viewers >= 1000 ? (viewers / 1000).toFixed(1) + 'K' : viewers} viewers
            </span>
          </div>
        </div>
        <p className="text-white font-bold text-[15px] drop-shadow-lg">{name}</p>
        {title && (
          <p className="text-white/80 text-[13px] mt-0.5 drop-shadow-md line-clamp-2">{title}</p>
        )}
      </div>
    </button>
  );
}
