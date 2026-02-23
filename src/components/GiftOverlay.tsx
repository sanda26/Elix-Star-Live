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

  useEffect(() => {
    if (videoSrc && videoRef.current) {
      videoRef.current.muted = muteAllSounds;
      videoRef.current.load();
      const playPromise = videoRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {})
          .catch(() => {
            if (videoRef.current) {
                videoRef.current.muted = true;
                videoRef.current.play().catch(() => {
                    onEnded();
                });
            }
          });
      }
    }
  }, [muteAllSounds, videoSrc]);

  if (!videoSrc) return null;

  const isVideo = videoSrc.endsWith('.webm') || videoSrc.endsWith('.mp4');

  const maskStyle = {
    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%)',
    maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%)',
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  };

  return (
    <div className="absolute inset-0 z-gift-overlay pointer-events-none overflow-hidden">
      <div className="absolute inset-0 w-full h-full" style={maskStyle}>
        {isVideo ? (
          <video
            ref={videoRef}
            src={videoSrc}
            className="absolute inset-0 w-full h-full object-cover object-top drop-shadow-2xl elix-overlay-in"
            playsInline
            preload="auto"
            muted={muteAllSounds}
            onEnded={onEnded}
            onError={() => onEnded()}
          />
        ) : (
          <img
            src={videoSrc}
            alt="Gift"
            className="absolute inset-0 w-full h-full object-cover object-top opacity-90 drop-shadow-2xl animate-bounce-small elix-overlay-in"
            onLoad={() => setTimeout(onEnded, 1500)}
            onError={() => onEnded()}
          />
        )}
      </div>
    </div>
  );
}
