import React, { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

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

export function GiftOverlay({ videoSrc, previewSrc, onEnded, isBattleMode: _isBattleMode }: GiftOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { muteAllSounds } = useSettingsStore();
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const instanceIdRef = useRef(0);

  const [phase, setPhase] = useState<'preview' | 'video' | 'image'>('preview');
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    if (!videoSrc) return;
    const instId = ++instanceIdRef.current;

    setVideoReady(false);
    setPhase('preview');

    safetyTimerRef.current = setTimeout(() => {
      // #region agent log
      fetch('/api/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'gift-safety-timer-fired', data: { instId, videoSrc: videoSrc?.slice(0, 60) }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      onEndedRef.current();
    }, 8000);

    const path = videoSrc.split('?')[0].toLowerCase();
    const isVideo = path.endsWith('.mp4') || path.endsWith('.webm');

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GiftOverlay.tsx:init',message:'gift-overlay-init',data:{videoSrc:videoSrc?.slice(0,80),previewSrc:previewSrc?.slice(0,80),isVideo,cached:videoCache.has(videoSrc)},timestamp:Date.now(),hypothesisId:'H12'})}).catch(()=>{});
    // #endregion

    if (isVideo) {
      if (videoCache.has(videoSrc)) {
        setVideoReady(true);
        setPhase('video');
      } else {
        preloadVideo(videoSrc)
          .then(() => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GiftOverlay.tsx:preloadOk',message:'gift-video-preload-ok',data:{videoSrc:videoSrc?.slice(0,80)},timestamp:Date.now(),hypothesisId:'H12'})}).catch(()=>{});
            // #endregion
            setVideoReady(true); setPhase('video');
          })
          .catch((err) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GiftOverlay.tsx:preloadFail',message:'gift-video-preload-fail',data:{videoSrc:videoSrc?.slice(0,80),error:String(err),hasPreview:!!previewSrc},timestamp:Date.now(),hypothesisId:'H12'})}).catch(()=>{});
            // #endregion
            if (previewSrc) {
              setTimeout(() => onEndedRef.current(), 2000);
            } else {
              onEndedRef.current();
            }
          });
      }
    } else {
      setPhase('image');
    }

    return () => { if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current); };
  }, [videoSrc, previewSrc]);

  if (!videoSrc) return null;

  const showPreview = phase === 'preview' && previewSrc && !videoReady;
  const showVideo = phase === 'video' && videoReady;
  const showImage = phase === 'image';

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
      {showPreview && (
        <img
          src={previewSrc!}
          alt="Gift preview"
          className="absolute inset-0 w-full h-full object-cover opacity-90 drop-shadow-2xl animate-pulse"
        />
      )}

      {showVideo && (
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
            fetch('/api/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'gift-video-loadeddata', data: { videoSrc: videoSrc?.slice(0, 60), duration: videoRef.current?.duration, paused: videoRef.current?.paused }, timestamp: Date.now() }) }).catch(() => {});
            // #endregion
            if (videoRef.current && !muteAllSounds) videoRef.current.muted = false;
            if (videoRef.current?.paused) {
              videoRef.current.play().catch(() => {});
            }
          }}
          onEnded={() => {
            // #region agent log
            fetch('/api/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'gift-video-ended', data: { videoSrc: videoSrc?.slice(0, 60) }, timestamp: Date.now() }) }).catch(() => {});
            // #endregion
            if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
            onEnded();
          }}
          onError={() => {
            // #region agent log
            fetch('/api/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'gift-video-error', data: { videoSrc: videoSrc?.slice(0, 60) }, timestamp: Date.now() }) }).catch(() => {});
            // #endregion
            if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
            onEnded();
          }}
        />
      )}

      {showImage && (
        <img
          src={videoSrc}
          alt="Gift"
          className="absolute inset-0 w-full h-full object-cover opacity-90 drop-shadow-2xl animate-bounce-small"
          onLoad={() => {
            // #region agent log
            fetch('/api/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'gift-image-loaded', data: { videoSrc: videoSrc?.slice(0, 60) }, timestamp: Date.now() }) }).catch(() => {});
            // #endregion
            if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
            setTimeout(onEnded, 1500);
          }}
          onError={() => {
            // #region agent log
            fetch('/api/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'gift-image-error', data: { videoSrc: videoSrc?.slice(0, 60) }, timestamp: Date.now() }) }).catch(() => {});
            // #endregion
            if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
            onEnded();
          }}
        />
      )}
    </div>
  );
}
