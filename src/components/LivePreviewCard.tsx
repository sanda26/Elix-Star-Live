import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { websocket } from '../lib/websocket';
import { useLiveWebRTC } from '../hooks/useLiveWebRTC';

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
  const [hasStream, setHasStream] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const previewUserId = user?.id || `anon-${streamKey.slice(0, 8)}`;

  // Connect/disconnect websocket when card becomes active/inactive
  useEffect(() => {
    if (!isActive || !streamKey) {
      websocket.disconnect();
      setWsConnected(false);
      setHasStream(false);
      return;
    }

    let cancelled = false;

    const connect = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || '';
      if (cancelled) return;
      websocket.connect(streamKey, token);
      setWsConnected(true);
    };

    const timer = setTimeout(connect, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      websocket.disconnect();
      setWsConnected(false);
      setHasStream(false);
    };
  }, [isActive, streamKey]);

  // Use the same WebRTC hook as SpectatorPage
  const { remotePeers } = useLiveWebRTC({
    roomId: streamKey,
    localUserId: previewUserId,
    localStream: null,
    enabled: wsConnected && isActive && !!streamKey,
  });

  // Attach remote stream to video element
  useEffect(() => {
    if (remotePeers.length === 0) {
      setHasStream(false);
      return;
    }
    const peer = remotePeers[0];
    if (peer.stream && videoRef.current) {
      if (videoRef.current.srcObject !== peer.stream) {
        videoRef.current.srcObject = peer.stream;
        videoRef.current.play().catch(() => {});
        setHasStream(true);
      }
    }
  }, [remotePeers]);

  const handleTap = () => {
    websocket.disconnect();
    navigate(`/watch/${streamKey}`);
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      className="w-full h-full relative bg-black overflow-hidden"
      title="Tap to join live"
    >
      {/* Full-screen live video */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
        style={{ opacity: hasStream ? 1 : 0, transition: 'opacity 0.4s ease' }}
      />

      {/* Loading state: avatar + spinner while connecting */}
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
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            <span className="text-white/60 text-sm">Connecting...</span>
          </div>
        </div>
      )}

      {/* Subtle gradient at bottom for text readability */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-[2] pointer-events-none" />

      {/* Bottom overlay: LIVE badge + creator info */}
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
