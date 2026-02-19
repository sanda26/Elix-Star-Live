// 🔒 LOCKED FILE: DO NOT MODIFY.
// This file is locked to preserve the exact behavior of gift overlay video playback.
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
          .then(() => { 
            // Automatic playback started! 
          }) 
          .catch((error) => { 
            console.warn("Auto-play was prevented:", error); 
            // Fallback: try muted if sound was the issue 
            if (videoRef.current) { 
                videoRef.current.muted = true; 
                videoRef.current.play().catch(e => { 
                    console.error("Muted play also failed", e); 
                    // If we can't play at all, end the animation so we don't block the queue 
                    onEnded(); 
                }); 
            } 
          }); 
      } 
    } 
  }, [muteAllSounds, videoSrc]); 
 
  if (!videoSrc) return null; 
 
  const isVideo = videoSrc.endsWith('.webm') || videoSrc.endsWith('.mp4'); 
  const poster = isVideo ? pickFirstPosterCandidate(videoSrc) : undefined; 
 
  return ( 
    <div className="absolute left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)-10px)] z-[40] pointer-events-none flex justify-center">
      <div 
        className="w-full h-[70vh] flex items-end justify-center overflow-hidden" 
        style={{ 
          WebkitMaskImage: 'linear-gradient(to top, black 0%, black 70%, transparent 100%)', 
          maskImage: 'linear-gradient(to top, black 0%, black 70%, transparent 100%)', 
          WebkitMaskSize: '100% 100%', 
          maskSize: '100% 100%', 
          WebkitMaskRepeat: 'no-repeat', 
          maskRepeat: 'no-repeat', 
          zIndex: 40, // Covers chat (z-20) but below controls (z-50)
        }} 
      > 
        {isVideo ? ( 
          <video 
            ref={videoRef} 
            src={videoSrc} 
            poster={poster} 
            className="w-full h-full object-cover object-top opacity-100 drop-shadow-2xl elix-overlay-in" 
            playsInline 
            preload="auto" 
            muted={muteAllSounds} 
            onEnded={onEnded} 
            onError={(e) => { 
              console.error("Video error:", e); 
              onEnded(); 
            }} 
          /> 
        ) : ( 
          <img 
            src={videoSrc} 
            alt="Gift" 
            className="w-full h-full object-cover object-top opacity-90 drop-shadow-2xl animate-bounce-small elix-overlay-in" 
            onLoad={() => { 
              setTimeout(onEnded, 1500); 
            }} 
            onError={() => { 
              console.error("Gift image failed to load:", videoSrc); 
              onEnded(); 
            }} 
          /> 
        )} 
      </div> 
    </div> 
  ); 
}
