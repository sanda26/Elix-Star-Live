import React, { useEffect, useRef, useState } from 'react';

const videoCache = new Map<string, string>();

function preloadVideo(src: string): Promise<string> {
  if (videoCache.has(src)) return Promise.resolve(videoCache.get(src)!);
  return new Promise((resolve, reject) => {
    const vid = document.createElement('video');
    vid.preload = 'auto';
    vid.muted = true;
    vid.playsInline = true;
    vid.oncanplaythrough = () => {
      videoCache.set(src, src);
      resolve(src);
    };
    vid.onerror = () => reject(new Error('preload failed'));
    vid.src = src;
    vid.load();
  });
}

interface GiftOverlayProps {
  videoSrc: string | null;
  previewSrc?: string | null;
  onEnded: () => void;
  isBattleMode?: boolean;
  /** When false, spectators can hear the gift video sound. Default true (muted) for creator/autoplay. */
  muted?: boolean;
  /** Use lighter, less obstructive layout for spectator pages. */
  spectatorMode?: boolean;
}

export function GiftOverlay({
  videoSrc,
  previewSrc: _previewSrc,
  onEnded,
  isBattleMode: _isBattleMode,
  muted = true,
  spectatorMode = false,
}: GiftOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    if (!videoSrc) return;

    setVideoReady(false);

    safetyTimerRef.current = setTimeout(() => {
      onEndedRef.current();
    }, 8000);

    const path = videoSrc.split('?')[0].toLowerCase();
    const isVideo = path.endsWith('.mp4') || path.endsWith('.webm');


    if (!isVideo) {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      onEndedRef.current();
      return;
    }

    if (videoCache.has(videoSrc)) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'creator-gift-debug',hypothesisId:'C3',location:'src/components/GiftOverlay.tsx:60',message:'Gift overlay video cache hit',data:{videoSrc},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setVideoReady(true);
    } else {
      preloadVideo(videoSrc)
        .then(() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'creator-gift-debug',hypothesisId:'C4',location:'src/components/GiftOverlay.tsx:65',message:'Gift overlay preload success',data:{videoSrc},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          setVideoReady(true);
        })
        .catch(() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'creator-gift-debug',hypothesisId:'C5',location:'src/components/GiftOverlay.tsx:69',message:'Gift overlay preload failed',data:{videoSrc},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
          onEndedRef.current();
        });
    }

    return () => { if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current); };
  }, [videoSrc]);

  if (!videoSrc || !videoReady) return null;

  return (
    <div
      className="absolute left-0 right-0 bottom-0 pointer-events-none overflow-hidden"
      style={{
        height: spectatorMode ? '52%' : '70%',
        zIndex: 95,
        WebkitMaskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)',
        maskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)',
      }}
    >
      <video
        ref={videoRef}
        key={videoSrc}
        src={videoSrc}
        className={`absolute inset-0 w-full h-full ${spectatorMode ? 'object-contain' : 'object-cover'} drop-shadow-2xl`}
        playsInline
        autoPlay
        muted={muted}
        preload="auto"
        style={spectatorMode ? { opacity: 0.88 } : undefined}
        onLoadedData={() => {
          if (videoRef.current?.paused) {
            videoRef.current.play().catch(() => {});
          }
        }}
        onEnded={() => {
          if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
          onEnded();
        }}
        onError={() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'creator-gift-debug',hypothesisId:'C6',location:'src/components/GiftOverlay.tsx:108',message:'Gift overlay <video> onError',data:{videoSrc},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
          onEnded();
        }}
      />
    </div>
  );
}
