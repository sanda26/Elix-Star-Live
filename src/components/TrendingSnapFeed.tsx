import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Video } from '../store/useVideoStore';
import { getVideoPosterUrl } from '../lib/bunnyStorage';

function TrendingSlide({ video }: { video: Video }) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !video.url) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) videoRef.current?.play().catch(() => {});
        else videoRef.current?.pause();
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [video.url]);

  const poster = video.thumbnail || getVideoPosterUrl(video.url || '');

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black cursor-pointer"
      onClick={() => navigate(`/video/${video.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/video/${video.id}`);
        }
      }}
      role="button"
      tabIndex={0}
    >
      {video.url ? (
        <video
          ref={videoRef}
          src={video.url}
          poster={poster || undefined}
          muted
          loop
          playsInline
          preload="metadata"
          className="video-media-fill absolute inset-0 size-full"
        />
      ) : (
        <img src={poster} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
      <div className="absolute bottom-2 left-2 right-2 text-left">
        <div className="text-[10px] font-bold text-white truncate">@{video.user?.username || 'user'}</div>
        {video.description ? (
          <div className="text-[9px] text-white/80 line-clamp-2">{video.description}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Search: full column width, no card frame — sits flush under trending users. */
export function TrendingSnapFeed({ videos }: { videos: Video[] }) {
  const slideH = 'min(78dvh,calc(100vw*16/9))';

  if (videos.length === 0) {
    return (
      <div className="text-xs text-white/30 py-3 px-4 text-center w-full">
        No videos yet.
      </div>
    );
  }

  return (
    <div className="w-full bg-black">
      <div
        className="w-full overflow-y-auto snap-y snap-mandatory flex flex-col gap-0 no-scrollbar"
        style={{ overscrollBehavior: 'contain' }}
      >
        {videos.map((video) => (
          <div
            key={video.id}
            className="snap-start shrink-0 w-full overflow-hidden bg-black"
            style={{ height: slideH, maxHeight: 'min(82dvh, calc(100dvh - 9.5rem))' }}
          >
            <TrendingSlide video={video} />
          </div>
        ))}
      </div>
    </div>
  );
}
