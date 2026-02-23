import React, { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { pickFirstPosterCandidate } from '../lib/giftPoster';

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

  return (
    <div className="absolute left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+40px)] z-gift-overlay pointer-events-none flex justify-center items-end">
      {/* Bounded box: gift scales to fit (object-contain), no mask, no crop */}
      <div className="w-full max-w-[min(400px,90vw)] h-[50vh] max-h-[320px] flex items-center justify-center overflow-hidden rounded-2xl">
        {isVideo ? (
          <video
            ref={videoRef}
            src={videoSrc}
            className="max-w-full max-h-full w-auto h-auto object-contain opacity-100 drop-shadow-2xl elix-overlay-in"
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
            className="max-w-full max-h-full w-auto h-auto object-contain opacity-90 drop-shadow-2xl animate-bounce-small elix-overlay-in"
            onLoad={() => setTimeout(onEnded, 1500)}
            onError={() => onEnded()}
          />
        )}
      </div>
    </div>
  );
}
