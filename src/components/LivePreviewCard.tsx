import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
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
  ],
  iceCandidatePoolSize: 4,
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
}

export default function LivePreviewCard({
  streamKey,
  name,
  avatar,
  viewers,
  title,
  isActive,
}: LivePreviewCardProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [hasStream, setHasStream] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const mountedRef = useRef(true);
  const iceCandidateBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const hasRemoteDescRef = useRef(false);

  const wsSend = useCallback((event: string, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
    }
  }, []);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (wsRef.current) {
      try {
        const ws = wsRef.current;
        ws.onclose = null;
        ws.close();
      } catch {}
      wsRef.current = null;
    }
    hasRemoteDescRef.current = false;
    iceCandidateBufferRef.current = [];
    setHasStream(false);
    setConnecting(false);
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

    const previewUserId = user?.id ? `preview-${user.id}-${streamKey}` : `preview-anon-${streamKey}`;
    let cancelled = false;

    const connectPreview = async () => {
      setConnecting(true);

      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || 'anonymous';

      if (cancelled) return;

      const wsUrl = buildWsUrl(streamKey, token);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      const remoteStream = new MediaStream();

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach(track => {
          remoteStream.addTrack(track);
        });
        if (videoRef.current && mountedRef.current) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.play().catch(() => {});
          setHasStream(true);
          setConnecting(false);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          wsSend('rtc_ice_candidate', {
            target_user_id: streamKey,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          if (mountedRef.current) setHasStream(false);
        }
      };

      const flushIceCandidates = async () => {
        if (!hasRemoteDescRef.current) return;
        while (iceCandidateBufferRef.current.length > 0) {
          const candidate = iceCandidateBufferRef.current.shift()!;
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
        }
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (cancelled || !pcRef.current) return;

          if (msg.event === 'rtc_offer') {
            try {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.data.sdp));
              hasRemoteDescRef.current = true;
              const answer = await pcRef.current.createAnswer();
              await pcRef.current.setLocalDescription(answer);
              wsSend('rtc_answer', {
                target_user_id: msg.data.from_user_id,
                sdp: answer,
              });
              await flushIceCandidates();
            } catch {}
          } else if (msg.event === 'rtc_ice_candidate') {
            if (hasRemoteDescRef.current) {
              try { await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.data.candidate)); } catch {}
            } else {
              iceCandidateBufferRef.current.push(msg.data.candidate);
            }
          }
        } catch {}
      };

      ws.onopen = () => {
        wsSend('rtc_join', { user_id: previewUserId });
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
  }, [isActive, streamKey, user?.id, cleanup, wsSend]);

  const handleTap = () => {
    cleanup();
    navigate(`/watch/${streamKey}`);
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      className="w-full h-full relative bg-[#0A0B0E] overflow-hidden group"
    >
      {/* Live video background */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
        style={{ opacity: hasStream ? 1 : 0, transition: 'opacity 0.5s ease' }}
      />

      {/* Fallback: animated gradient + avatar when no stream yet */}
      {!hasStream && (
        <>
          <div className="absolute inset-0 animate-pulse" style={{
            background: 'radial-gradient(ellipse at 50% 40%, rgba(239,68,68,0.15) 0%, rgba(201,169,110,0.08) 40%, transparent 70%)',
            animationDuration: '2s',
          }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-5">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full border-2 border-red-500/40 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute -inset-6 rounded-full border border-red-500/20 animate-ping" style={{ animationDuration: '3s' }} />
              <div className="w-28 h-28 rounded-full border-[3px] border-red-500 overflow-hidden shadow-[0_0_40px_rgba(239,68,68,0.5)] relative z-10">
                {avatar ? (
                  <img src={avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#C9A96E]/20 flex items-center justify-center">
                    <span className="text-[#C9A96E] font-bold text-4xl">{name.slice(0, 1).toUpperCase()}</span>
                  </div>
                )}
              </div>
            </div>
            {connecting && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-white/80 text-sm font-medium">Connecting...</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Overlay gradient on top of live video */}
      {hasStream && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 z-[1]" />
      )}

      {/* LIVE badge - always visible */}
      <div className="absolute top-[calc(var(--safe-top,0px)+60px)] left-3 z-[5] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/90 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span className="text-white text-[11px] font-extrabold uppercase tracking-wider">Live</span>
      </div>

      {/* Bottom info overlay - always visible */}
      <div className="absolute bottom-4 left-0 right-0 z-[5] px-4">
        <div className="flex items-end justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-10 h-10 rounded-full border-2 border-red-500/60 overflow-hidden flex-shrink-0">
                {avatar ? (
                  <img src={avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#C9A96E]/20 flex items-center justify-center">
                    <span className="text-[#C9A96E] font-bold text-sm">{name.slice(0, 1).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">{name}</p>
                {title && (
                  <p className="text-white/50 text-xs truncate">{title}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-white/60 ml-12">
              <Eye size={12} />
              <span className="text-[11px] font-semibold">
                {viewers >= 1000 ? (viewers / 1000).toFixed(1) + 'K' : viewers} watching
              </span>
            </div>
          </div>

          {/* Tap to join indicator */}
          <div className="px-5 py-2.5 rounded-full bg-red-500/90 shadow-[0_0_20px_rgba(239,68,68,0.3)] group-active:scale-95 transition-transform flex-shrink-0">
            <span className="text-white font-bold text-xs tracking-wide">Tap to Watch</span>
          </div>
        </div>
      </div>
    </button>
  );
}
