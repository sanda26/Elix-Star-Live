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
  const isVideo = videoSrc.endsWith('.webm') || videoSrc.endsWith('.mp4');

  return (
    <div className="absolute inset-0 pointer-events-none flex items-end justify-center overflow-hidden" style={{ zIndex: 30 }}>
      <div className="w-full flex items-end justify-center" style={{ height: '55%', WebkitMaskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)', maskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)' }}>
        {isVideo ? (
          <video ref={videoRef} key={videoSrc} src={videoSrc} className="max-w-[85%] max-h-full object-contain drop-shadow-2xl" playsInline autoPlay muted preload="auto"
            onLoadedData={() => { if (videoRef.current && !muteAllSounds) videoRef.current.muted = false; }}
            onEnded={() => { if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current); onEnded(); }}
            onError={() => { if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current); onEnded(); }}
          />
        ) : (
          <img src={videoSrc} alt="Gift" className="max-w-[85%] max-h-full object-contain opacity-90 drop-shadow-2xl animate-bounce-small"
            onLoad={() => { if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current); setTimeout(onEnded, 1500); }}
            onError={() => { if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current); onEnded(); }}
          />
        )}
      </div>
    </div>
  );
}
