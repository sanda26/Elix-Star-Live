import React, { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { pickFirstPosterCandidate } from '../lib/giftPoster';

interface GiftOverlayProps {
  videoSrc: string | null;
  onEnded: () => void;
  isBattleMode?: boolean;
}

export function GiftOverlay({ videoSrc, onEnded, isBattleMode }: GiftOverlayProps) {
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

  const height = isBattleMode ? '30vh' : '55vh';

  return (
    <div className="fixed left-0 right-0 bottom-0 z-[50] pointer-events-none flex justify-center">
      <div 
        className="w-full flex items-end justify-center overflow-hidden" 
        style={{ 
          height,
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, transparent 10%, rgba(0,0,0,0.3) 20%, rgba(0,0,0,0.6) 30%, black 45%, black 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, transparent 10%, rgba(0,0,0,0.3) 20%, rgba(0,0,0,0.6) 30%, black 45%, black 100%)',
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
        }}
      >
        {isVideo ? (
          <video 
            ref={videoRef} 
            src={videoSrc} 
            className="w-full h-full object-cover object-bottom drop-shadow-2xl elix-overlay-in" 
            playsInline 
            preload="auto" 
            muted={muteAllSounds} 
            onEnded={onEnded} 
            onError={() => { 
              onEnded(); 
            }} 
          />
        ) : (
          <img 
            src={videoSrc} 
            alt="Gift" 
            className="w-full h-full object-cover object-bottom drop-shadow-2xl animate-bounce-small elix-overlay-in" 
            onLoad={() => { 
              setTimeout(onEnded, 1500); 
            }} 
            onError={() => { 
              onEnded(); 
            }} 
          />
        )}
      </div>
    </div>
  );
}
