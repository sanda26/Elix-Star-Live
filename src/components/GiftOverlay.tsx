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

  const [phase, setPhase] = useState<'preview' | 'video' | 'image'>('preview');
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    if (!videoSrc) return;

    setVideoReady(false);
    setPhase('preview');

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GiftOverlay.tsx:useEffect',message:'Gift overlay triggered',data:{videoSrc,previewSrc,cached:videoCache.has(videoSrc)},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion

    safetyTimerRef.current = setTimeout(() => { onEndedRef.current(); }, 15000);

    const path = videoSrc.split('?')[0].toLowerCase();
    const isVideo = path.endsWith('.mp4') || path.endsWith('.webm');

    if (isVideo) {
      if (videoCache.has(videoSrc)) {
        setVideoReady(true);
        setPhase('video');
      } else {
        preloadVideo(videoSrc)
          .then(() => { setVideoReady(true); setPhase('video'); })
          .catch(() => {
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
      )}

      {showImage && (
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
