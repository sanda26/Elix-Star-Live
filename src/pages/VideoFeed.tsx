import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import EnhancedVideoPlayer from '../components/EnhancedVideoPlayer';
import { useVideoStore } from '../store/useVideoStore';
import { useSafetyStore } from '../store/useSafetyStore';
import { supabase } from '../lib/supabase';
import {
  startVideoView,
  stopVideoView,
  cleanupAllViews,
  } from '../lib/interactionTracker';
import { startRealtimeSync, stopRealtimeSync } from '../lib/realtimeSync';

type HomeTopTab = 'live' | 'stem' | 'explore' | 'following' | 'shop' | 'foryou';

type FeedItem = { kind: 'video'; videoId: string };

export default function VideoFeed() {
  const location = useLocation();
  const { videos, fetchVideos, loading } = useVideoStore();
  const blockedUserIds = useSafetyStore((s) => s.blockedUserIds);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<HomeTopTab>('foryou');
  const [hoveredTopTabIndex, setHoveredTopTabIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const topTabs = [
    { key: 'live', width: 13 },
    { key: 'stem', width: 12 },
    { key: 'explore', width: 15 },
    { key: 'following', width: 18 },
    { key: 'shop', width: 12 },
    { key: 'foryou', width: 15 },
    { key: 'search', width: 15 },
  ] as const;
  const hoveredTopTabLeft =
    hoveredTopTabIndex === null ? 0 : topTabs.slice(0, hoveredTopTabIndex).reduce((sum, t) => sum + t.width, 0);
  const hoveredTopTabWidth = hoveredTopTabIndex === null ? 0 : topTabs[hoveredTopTabIndex]?.width ?? 0;
  const hoveredTopTabRight = 100 - hoveredTopTabLeft - hoveredTopTabWidth;

  // When you open app or go to feed → For You tab, refresh videos, scroll to first video
  useEffect(() => {
    if (location.pathname === '/feed') {
      setActiveTab('foryou');
      fetchVideos();
      setActiveIndex(0);
      const t = setTimeout(() => {
        containerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      }, 0);
      return () => clearTimeout(t);
    }
  }, [location.pathname, fetchVideos]);

  // Force re-fetch on mount if empty
  useEffect(() => {
    if (videos.length === 0) {
        fetchVideos();
    }
  }, []);

  useEffect(() => {
    startRealtimeSync();
    return () => stopRealtimeSync();
  }, []);
  const [loopCount, setLoopCount] = useState(1);

  const visibleVideos = blockedUserIds.length
    ? videos.filter((v) => !blockedUserIds.includes(v.user.id))
    : videos;

  const videoIds = Array.from({ length: loopCount }).flatMap(() => visibleVideos.map((v) => v.id));

  const feedItemsWithLive: FeedItem[] =
    activeTab === 'foryou'
      ? videoIds.map((id): FeedItem => ({ kind: 'video', videoId: id }))
      : [];

  useEffect(() => {
    if (visibleVideos.length === 0) return;
    setActiveIndex(0);
  }, [visibleVideos.length]);

  const handleVideoEnd = (feedIndex: number) => {
    const container = containerRef.current;
    if (!container) return;
    if (feedIndex < feedItemsWithLive.length - 1) {
      container.scrollTo({
        top: (feedIndex + 1) * container.clientHeight,
        behavior: 'smooth'
      });
    }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollPosition = container.scrollTop;
    const height = container.clientHeight;

    const index = Math.round(scrollPosition / height);
    if (index < 0 || index >= feedItemsWithLive.length) return;
    setActiveIndex(index);

    if (scrollPosition + height >= (feedItemsWithLive.length - 2) * height) {
      setLoopCount((c) => Math.min(20, c + 1));
    }
  };

  const nextItem = feedItemsWithLive[activeIndex + 1];
  const nextVideoUrl =
    nextItem && nextItem.kind === 'video'
      ? visibleVideos.find((v) => v.id === nextItem.videoId)?.url
      : undefined;

  useEffect(() => {
    if (!nextVideoUrl) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = nextVideoUrl;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [nextVideoUrl]);


  useEffect(() => {
    const currentItem = feedItemsWithLive[activeIndex];
    if (!currentItem || currentItem.kind !== 'video') return;

    const videoId = currentItem.videoId;
    const video = visibleVideos.find(v => v.id === videoId);
    const duration = video ? parseFloat(video.duration) || 15 : 15;

    startVideoView(videoId, duration);

    return () => {
      stopVideoView(videoId);
    };
  }, [activeIndex]);

  useEffect(() => {
    return () => {
      cleanupAllViews();
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory relative bg-[#13151A]"
      style={{ 
        margin: 0, 
        padding: 0, 
        gap: 0,
        scrollSnapType: 'y mandatory',
        scrollPadding: 0
      }}
      onScroll={handleScroll}
    >
      {/* Top Navigation Bar - LUXURY REDESIGN */}
      <div className="fixed left-0 right-0 z-[9999] flex justify-center pointer-events-none"
           style={{ top: 'calc(var(--safe-top) + 0.5mm)' }}>
        <div className="w-full max-w-[500px] relative px-2">
          
          {/* Background Image with Premium Glow */}
          <div className="relative w-full" style={{ transform: 'scaleY(0.80)', transformOrigin: 'top' }}>
            <img 
              src="/Icons/topbar.png" 
              alt="Navigation" 
              className="w-full h-auto pointer-events-none"
              style={{ 
                filter: 'drop-shadow(0 0 20px rgba(201,169,110,0.5)) drop-shadow(0 4px 15px rgba(0,0,0,0.6))',
              }}
            />
            <img
              src="/Icons/topbar.png"
              alt=""
              className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-200"
              style={{
                opacity: hoveredTopTabIndex === null ? 0 : 1,
                filter: 'brightness(1.25) saturate(1.4) contrast(1.15)',
                clipPath:
                  hoveredTopTabIndex === null
                    ? 'inset(0 100% 0 0)'
                    : `inset(0 ${hoveredTopTabRight}% 0 ${hoveredTopTabLeft}%)`,
              }}
            />
            
            {/* Clickable Button Overlays */}
            <div className="absolute inset-0 flex items-center pointer-events-auto">
              {/* LIVE Button - 13% */}
              <button
                onClick={() => { setActiveTab('live'); navigate('/live', { replace: true }); }}
                onMouseEnter={() => setHoveredTopTabIndex(0)}
                onMouseLeave={() => setHoveredTopTabIndex(null)}
                onFocus={() => setHoveredTopTabIndex(0)}
                onBlur={() => setHoveredTopTabIndex(null)}
                className="h-full bg-transparent focus:outline-none focus-visible:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
                style={{ width: '13%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
                title="Live"
              />
              
              {/* STEM Button - 12% */}
              <button
                onClick={() => { setActiveTab('stem'); navigate('/discover'); }}
                onMouseEnter={() => setHoveredTopTabIndex(1)}
                onMouseLeave={() => setHoveredTopTabIndex(null)}
                onFocus={() => setHoveredTopTabIndex(1)}
                onBlur={() => setHoveredTopTabIndex(null)}
                className="h-full bg-transparent focus:outline-none focus-visible:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
                style={{ width: '12%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
                title="STEM"
              />
              
              {/* Explore Button - 15% */}
              <button
                onClick={() => { setActiveTab('explore'); navigate('/discover'); }}
                onMouseEnter={() => setHoveredTopTabIndex(2)}
                onMouseLeave={() => setHoveredTopTabIndex(null)}
                onFocus={() => setHoveredTopTabIndex(2)}
                onBlur={() => setHoveredTopTabIndex(null)}
                className="h-full bg-transparent focus:outline-none focus-visible:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
                style={{ width: '15%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
                title="Explore"
              />
              
              {/* Following Button - 18% */}
              <button
                onClick={() => { setActiveTab('following'); navigate('/following'); }}
                onMouseEnter={() => setHoveredTopTabIndex(3)}
                onMouseLeave={() => setHoveredTopTabIndex(null)}
                onFocus={() => setHoveredTopTabIndex(3)}
                onBlur={() => setHoveredTopTabIndex(null)}
                className="h-full bg-transparent focus:outline-none focus-visible:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
                style={{ width: '18%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
                title="Following"
              />
              
              {/* Shop Button - 12% */}
              <button
                onClick={() => { setActiveTab('shop'); navigate('/purchase-coins'); }}
                onMouseEnter={() => setHoveredTopTabIndex(4)}
                onMouseLeave={() => setHoveredTopTabIndex(null)}
                onFocus={() => setHoveredTopTabIndex(4)}
                onBlur={() => setHoveredTopTabIndex(null)}
                className="h-full bg-transparent focus:outline-none focus-visible:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
                style={{ width: '12%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
                title="Shop"
              />
              
              {/* For You Button - 15% */}
              <button
                onClick={() => { setActiveTab('foryou'); }}
                onMouseEnter={() => setHoveredTopTabIndex(5)}
                onMouseLeave={() => setHoveredTopTabIndex(null)}
                onFocus={() => setHoveredTopTabIndex(5)}
                onBlur={() => setHoveredTopTabIndex(null)}
                className="h-full bg-transparent focus:outline-none focus-visible:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
                style={{ width: '15%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
                title="For You"
              />
              
              {/* Search Button - 15% */}
              <button
                onClick={() => navigate('/search')}
                onMouseEnter={() => setHoveredTopTabIndex(6)}
                onMouseLeave={() => setHoveredTopTabIndex(null)}
                onFocus={() => setHoveredTopTabIndex(6)}
                onBlur={() => setHoveredTopTabIndex(null)}
                className="h-full bg-transparent focus:outline-none focus-visible:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
                style={{ width: '15%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
                title="Search"
              />
            </div>
          </div>
        </div>
      </div>

      {feedItemsWithLive.map((item, index) => {
        return (
          <div
            key={`video-${item.videoId}-${index}`}
            className="h-[100dvh] w-full snap-start relative flex justify-center bg-[#13151A] px-2"
            style={{
              margin: 0,
              padding: 0,
              gap: 0,
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always'
            }}
          >
            <div
              className="w-full max-w-[480px] h-full relative"
              style={{
                margin: 0,
                gap: 0
              }}
            >
              <EnhancedVideoPlayer
                videoId={item.videoId}
                isActive={activeIndex === index}
                onVideoEnd={() => handleVideoEnd(index)}
              />
            </div>
          </div>
        );
      })}

      {nextVideoUrl && (
        <link rel="preload" as="video" href={nextVideoUrl} />
      )}

      {loading && feedItemsWithLive.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && feedItemsWithLive.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 pointer-events-none">
          <p>No videos found</p>
          <button 
            onClick={() => fetchVideos()} 
            className="mt-4 px-4 py-2 bg-white/10 rounded-full text-sm font-semibold pointer-events-auto hover:bg-white/20"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
