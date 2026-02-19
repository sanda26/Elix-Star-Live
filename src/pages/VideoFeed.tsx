import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import EnhancedVideoPlayer from '../components/EnhancedVideoPlayer';
import { useVideoStore } from '../store/useVideoStore';
import { LivePromo, useLivePromoStore } from '../store/useLivePromoStore';
import { useSafetyStore } from '../store/useSafetyStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import {
  startVideoView,
  stopVideoView,
  cleanupAllViews,
  } from '../lib/interactionTracker';
import { startRealtimeSync, stopRealtimeSync } from '../lib/realtimeSync';

type HomeTopTab = 'live' | 'stem' | 'explore' | 'following' | 'shop' | 'foryou';

type LiveStreamData = {
  id: string;
  stream_key: string;
  title: string;
  viewer_count: number;
  user_id: string;
  username?: string;
};

type FeedItem =
  | { kind: 'promo'; promo: LivePromo }
  | { kind: 'video'; videoId: string }
  | { kind: 'live'; stream: LiveStreamData };

function LiveStreamCard({ stream, onOpen }: { stream: LiveStreamData; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full h-full relative bg-black"
    >
      <div className="absolute left-4 top-16 z-0 flex items-center gap-2">
        <div className="px-2.5 py-1 rounded-full bg-red-600 text-white text-[11px] font-black tracking-widest animate-pulse">
          LIVE
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 text-white text-[11px] font-bold">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
          </svg>
          {stream.viewer_count?.toLocaleString() || 0}
        </div>
      </div>

      <div className="absolute left-4 bottom-28 z-0 text-left">
        <p className="text-white text-xl font-black">
          {stream.title || 'Live Stream'}
        </p>
        <p className="text-white/70 text-sm font-semibold">@{stream.username || 'creator'}</p>
      </div>

      <div className="absolute left-4 bottom-12 z-0">
        <div className="px-5 py-2 rounded-full bg-[#E6B36A] text-black text-sm font-black">
          Watch Live
        </div>
      </div>
    </button>
  );
}

function PromoCard({ promo, onOpen }: { promo: LivePromo; onOpen: () => void }) {
  const previewSrc =
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full h-full relative bg-black"
    >
      {promo.type === 'battle' ? (
        <div className="absolute inset-0 flex">
          <video className="w-1/2 h-full object-cover" src={previewSrc} autoPlay loop muted playsInline />
          <video className="w-1/2 h-full object-cover" src={previewSrc} autoPlay loop muted playsInline />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
        </div>
      ) : (
        <div className="absolute inset-0">
          <video className="w-full h-full object-cover" src={previewSrc} autoPlay loop muted playsInline />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
        </div>
      )}

      <div className="absolute left-4 top-16 z-10 flex items-center gap-2">
        <div className="px-2.5 py-1 rounded-full bg-[#E6B36A] text-black text-[11px] font-black tracking-widest">
          LIVE
        </div>
        <div className="px-2.5 py-1 rounded-full text-[#E6B36A] text-[11px] font-black tracking-widest">
          {promo.type === 'battle' ? 'BATTLE' : 'STREAM'}
        </div>
      </div>

      <div className="absolute left-4 bottom-28 z-10 text-left">
        <p className="text-white text-xl font-black">
          {promo.type === 'battle' ? 'Live Battle' : 'Live Stream'}
        </p>
        <p className="text-[#E6B36A] text-sm font-bold">{promo.likes.toLocaleString()} likes</p>
      </div>

      <div className="absolute left-4 bottom-12 z-10">
        <div className="px-5 py-2 rounded-full bg-[#E6B36A] text-black text-sm font-black">Watch now</div>
      </div>
    </button>
  );
}

export default function VideoFeed() {
  const location = useLocation();
  const { videos, fetchVideos, loading } = useVideoStore();
  const blockedUserIds = useSafetyStore((s) => s.blockedUserIds);
  const promoBattle = useLivePromoStore((s) => s.promoBattle);
  const promoLive = useLivePromoStore((s) => s.promoLive);
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
  const promos: FeedItem[] = [];
  const promoCount = promos.length;
  const [loopCount, setLoopCount] = useState(1);

  const visibleVideos = blockedUserIds.length
    ? videos.filter((v) => !blockedUserIds.includes(v.user.id))
    : videos;

  const videoIds = Array.from({ length: loopCount }).flatMap(() => visibleVideos.map((v) => v.id));

  const [liveStreams, setLiveStreams] = useState<LiveStreamData[]>([]);
  const authUserId = useAuthStore((s) => s.user?.id ?? null);

  useEffect(() => {
    const fetchLiveStreams = async () => {
      if (activeTab !== 'foryou') return;
      if (!authUserId) {
        setLiveStreams([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('live_streams')
          .select('id, stream_key, title, viewer_count, user_id')
          .eq('is_live', true)
          .eq('user_id', authUserId)
          .limit(1);

        if (error) {
          console.error('Error fetching live streams:', error);
          setLiveStreams([]);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setLiveStreams((data || []).map((d: any) => ({
            id: d.id,
            stream_key: d.stream_key,
            title: d.title || 'Live Stream',
            viewer_count: d.viewer_count || 0,
            user_id: d.user_id,
            username: d.title || 'creator'
          })));
        }
      } catch (err) {
        console.error('Error fetching live streams:', err);
        setLiveStreams([]);
      }
    };

    fetchLiveStreams();
  }, [activeTab, authUserId]);

  const feedItemsWithLive: FeedItem[] =
    activeTab === 'foryou'
      ? [
          ...promos,
          ...liveStreams.map((stream): FeedItem => ({ kind: 'live', stream })),
          ...videoIds.map((id): FeedItem => ({ kind: 'video', videoId: id })),
        ]
      : [];

  useEffect(() => {
    if (visibleVideos.length === 0) return;
    setActiveIndex(0);
  }, [visibleVideos.length, promoCount, liveStreams.length]);

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
      className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory relative bg-black"
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
                filter: 'drop-shadow(0 0 20px rgba(0,242,234,0.5)) drop-shadow(0 4px 15px rgba(0,0,0,0.6))',
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
                onClick={() => { setActiveTab('live'); navigate('/live'); }}
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
        if (item.kind === 'promo') {
          return (
            <div
              key={`promo-${index}`}
              className="h-[100dvh] w-full snap-start relative flex justify-center bg-black px-2"
              style={{
                margin: 0,
                padding: 0,
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always'
              }}
            >
              <div className="w-full max-w-[480px] h-full relative">
                <PromoCard
                  promo={item.promo}
                  onOpen={() =>
                    navigate(`/live/${item.promo.streamId}${item.promo.type === 'battle' ? '?battle=1' : ''}`)
                  }
                />
              </div>
            </div>
          );
        }

        if (item.kind === 'live') {
          return (
            <div
              key={`live-${item.stream.id}-${index}`}
              className="h-[100dvh] w-full snap-start relative flex justify-center bg-black px-2"
              style={{
                margin: 0,
                padding: 0,
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always'
              }}
            >
              <div className="w-full max-w-[480px] h-full relative">
                <LiveStreamCard
                  stream={item.stream}
                  onOpen={() => navigate(`/live/${item.stream.stream_key}`)}
                />
              </div>
            </div>
          );
        }

        return (
          <div
            key={`video-${item.videoId}-${index}`}
            className="h-[100dvh] w-full snap-start relative flex justify-center bg-black px-2"
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
          <div className="w-8 h-8 border-2 border-[#E6B36A] border-t-transparent rounded-full animate-spin" />
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
