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
}

export function GiftOverlay({ videoSrc, previewSrc: _previewSrc, onEnded, isBattleMode: _isBattleMode }: GiftOverlayProps) {
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'gift-safety-timer-fired',data:{videoSrc:videoSrc?.slice(0,60)},timestamp:Date.now(),hypothesisId:'H17'})}).catch(()=>{});
      // #endregion
      onEndedRef.current();
    }, 8000);

    const path = videoSrc.split('?')[0].toLowerCase();
    const isVideo = path.endsWith('.mp4') || path.endsWith('.webm');

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GiftOverlay.tsx:init',message:'gift-overlay-init',data:{videoSrc:videoSrc?.slice(0,80),isVideo,cached:videoCache.has(videoSrc)},timestamp:Date.now(),hypothesisId:'H12'})}).catch(()=>{});
    // #endregion

    if (!isVideo) {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      onEndedRef.current();
      return;
    }

    if (videoCache.has(videoSrc)) {
      setVideoReady(true);
    } else {
      preloadVideo(videoSrc)
        .then(() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GiftOverlay.tsx:preloadOk',message:'gift-video-preload-ok',data:{videoSrc:videoSrc?.slice(0,80)},timestamp:Date.now(),hypothesisId:'H12'})}).catch(()=>{});
          // #endregion
          setVideoReady(true);
        })
        .catch(() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GiftOverlay.tsx:preloadFail',message:'gift-video-preload-fail',data:{videoSrc:videoSrc?.slice(0,80)},timestamp:Date.now(),hypothesisId:'H12'})}).catch(()=>{});
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
        height: '70%',
        zIndex: 30,
        WebkitMaskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)',
        maskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)',
      }}
    >
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'gift-video-loadeddata',data:{videoSrc:videoSrc?.slice(0,60),duration:videoRef.current?.duration,paused:videoRef.current?.paused},timestamp:Date.now(),hypothesisId:'H17'})}).catch(()=>{});
          // #endregion
          if (videoRef.current?.paused) {
            videoRef.current.play().catch(() => {});
          }
        }}
        onEnded={() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'gift-video-ended',data:{videoSrc:videoSrc?.slice(0,60)},timestamp:Date.now(),hypothesisId:'H17'})}).catch(()=>{});
          // #endregion
          if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
          onEnded();
        }}
        onError={() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'gift-video-error',data:{videoSrc:videoSrc?.slice(0,60)},timestamp:Date.now(),hypothesisId:'H17'})}).catch(()=>{});
          // #endregion
          if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
          onEnded();
        }}
      />
    </div>
  );
}
