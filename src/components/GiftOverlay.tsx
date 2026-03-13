import React, { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

interface GiftOverlayProps {
  videoSrc: string | null;
  onEnded: () => void;
  isBattleMode?: boolean;
}

export function GiftOverlay({ videoSrc, onEnded, isBattleMode: _isBattleMode }: GiftOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { muteAllSounds } = useSettingsStore();
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    if (!videoSrc) return;
    safetyTimerRef.current = setTimeout(() => { onEndedRef.current(); }, 15000);
    return () => { if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current); };
  }, [videoSrc]);

  if (!videoSrc) return null;
  const path = videoSrc.split('?')[0].toLowerCase();
  const isImage = /\.(png|jpe?g|gif|webp|svg)(\s|$)/.test(path);
  const isVideo = !isImage && (path.includes('.webm') || path.includes('.mp4'));

  return (
    <div
      className="absolute left-0 right-0 bottom-0 pointer-events-none overflow-hidden"
      style={{
        height: '70%',
        zIndex: 30,
        WebkitMaskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)',
        maskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)',
      }}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          className="absolute inset-0 w-full h-full object-cover drop-shadow-2xl"
          playsInline
          autoPlay
          muted
          preload="auto"
          onLoadedData={() => {
            // Unmute if global sounds are enabled
            if (videoRef.current && !muteAllSounds) videoRef.current.muted = false;
          }}
          onEnded={() => {
            if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
            onEnded();
          }}
          onError={() => {
            if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
            onEnded();
          }}
        />
      ) : (
        <img
          src={videoSrc}
          alt="Gift"
          className="absolute inset-0 w-full h-full object-cover opacity-90 drop-shadow-2xl animate-bounce-small"
          onLoad={() => {
            if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
            setTimeout(onEnded, 1500);
          }}
          onError={() => {
            if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
            onEnded();
          }}
        />
      )}
    </div>
  );
}
