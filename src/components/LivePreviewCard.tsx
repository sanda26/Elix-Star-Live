import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useLiveWebRTC } from '../hooks/useLiveWebRTC';
import { websocket } from '../lib/websocket';
import { supabase } from '../lib/supabase';

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

  useEffect(() => {
    if (!isActive || !streamKey || !user?.id) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || '';
      if (cancelled) return;
      websocket.connect(streamKey, token);
      setWsConnected(true);
    })();

    return () => {
      cancelled = true;
      setWsConnected(false);
      websocket.disconnect();
    };
  }, [isActive, streamKey, user?.id]);

  const { remotePeers } = useLiveWebRTC({
    roomId: streamKey,
    localUserId: user?.id || '',
    localStream: null,
    enabled: isActive && wsConnected && !!streamKey && !!user?.id,
  });

  useEffect(() => {
    if (remotePeers.length === 0) return;
    const broadcasterPeer = remotePeers[0];
    if (videoRef.current && broadcasterPeer.stream) {
      if (videoRef.current.srcObject !== broadcasterPeer.stream) {
        videoRef.current.srcObject = broadcasterPeer.stream;
        videoRef.current.play().catch(() => {});
        setHasStream(true);
      }
    }
  }, [remotePeers]);

  useEffect(() => {
    if (!isActive && videoRef.current) {
      videoRef.current.srcObject = null;
      setHasStream(false);
    }
  }, [isActive]);

  const handleTap = () => {
    navigate(`/watch/${streamKey}`);
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      className="w-full h-full relative bg-black overflow-hidden"
      title="Tap to join live"
    >
      {/* Live video stream */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover z-[1] ${hasStream ? 'opacity-100' : 'opacity-0'}`}
        playsInline
        autoPlay
        muted
      />

      {/* Fallback: blurred avatar background (shown while connecting) */}
      {!hasStream && (
        <div className="absolute inset-0 flex items-center justify-center">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              className="w-full h-full object-cover blur-2xl scale-110 opacity-40"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-[#1a1a2e] to-[#0a0b0e]" />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-20 h-20 rounded-full border-[3px] border-red-500 overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.3)] bg-[#1a1a2e]">
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[#C9A96E] font-bold text-2xl">{name.slice(0, 1).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="w-5 h-5 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* LIVE badge + viewers — always visible */}
      <div className="absolute top-[calc(env(safe-area-inset-top,0px)+50px)] left-3 z-[10] flex items-center gap-1.5">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/90">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-white text-[10px] font-bold">LIVE</span>
        </div>
        {viewers > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm">
            <Eye size={10} className="text-white/70" />
            <span className="text-white text-[10px] font-semibold">
              {viewers >= 1000 ? (viewers / 1000).toFixed(1) + 'K' : viewers}
            </span>
          </div>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 z-[5] pointer-events-none">
        <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 pb-20 px-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full border border-white/30 overflow-hidden bg-[#1a1a2e] flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[#C9A96E] font-bold text-xs">{name.slice(0, 1).toUpperCase()}</span>
                </div>
              )}
            </div>
            <span className="text-white font-bold text-sm drop-shadow-lg">{name}</span>
          </div>
          {title && (
            <p className="text-white/80 text-xs mt-0.5 drop-shadow-md line-clamp-2 ml-10">{title}</p>
          )}
        </div>
      </div>
    </button>
  );
}
