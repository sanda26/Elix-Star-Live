import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import EnhancedVideoPlayer from '../components/EnhancedVideoPlayer';
import LivePreviewCard from '../components/LivePreviewCard';
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

type LiveStreamCard = {
  streamKey: string;
  name: string;
  avatar?: string;
  viewers: number;
  title?: string;
};

type FeedItem =
  | { kind: 'video'; videoId: string }
  | { kind: 'live'; stream: LiveStreamCard };

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

  const [liveStreams, setLiveStreams] = useState<LiveStreamCard[]>([]);

  const fetchLiveStreams = async () => {
    try {
      const { data } = await supabase
        .from('live_streams')
        .select('*')
        .eq('is_live', true)
        .order('viewer_count', { ascending: false });
      if (!data || data.length === 0) { setLiveStreams([]); return; }
      const userIds = (data as any[]).map((s: any) => s.user_id).filter(Boolean);
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('user_id, username, display_name, avatar_url').in('user_id', userIds)
        : { data: [] };
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      setLiveStreams((data as any[]).map((s: any) => {
        const p: any = profileMap.get(s.user_id);
        return {
          streamKey: s.stream_key || s.id,
          name: p?.display_name || p?.username || s.title || 'Creator',
          avatar: p?.avatar_url || s.thumbnail_url,
          viewers: s.viewer_count || 0,
          title: s.title || undefined,
        };
      }));
    } catch { setLiveStreams([]); }
  };

  useEffect(() => {
    fetchLiveStreams();

    // Realtime: instantly react when streams go live or end
    const chan = supabase
      .channel('feed_live_streams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, (payload: any) => {
        const row = payload.new;
        // Stream ended → immediately remove it from feed
        if (row && row.is_live === false && row.stream_key) {
          setLiveStreams(prev => prev.filter(s => s.streamKey !== row.stream_key && s.streamKey !== row.id));
        }
        // Any change → also do a full re-fetch to catch new lives
        fetchLiveStreams();
      })
      .subscribe();

    // Polling fallback: refresh every 10s in case realtime misses an event
    const poll = setInterval(fetchLiveStreams, 10000);

    return () => {
      supabase.removeChannel(chan);
      clearInterval(poll);
    };
  }, []);

  const [loopCount, setLoopCount] = useState(1);

  const visibleVideos = blockedUserIds.length
    ? videos.filter((v) => !blockedUserIds.includes(v.user.id))
    : videos;

  const videoIds = Array.from({ length: loopCount }).flatMap(() => visibleVideos.map((v) => v.id));

  const feedItemsWithLive: FeedItem[] =
    activeTab === 'foryou'
      ? [
          ...liveStreams.map((stream): FeedItem => ({ kind: 'live', stream })),
          ...videoIds.map((id): FeedItem => ({ kind: 'video', videoId: id })),
        ]
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

  // When a live stream ends and its card is removed, adjust activeIndex so the user
  // doesn't get stuck on an empty slot or an out-of-bounds index
  const prevFeedLengthRef = useRef(feedItemsWithLive.length);
  useEffect(() => {
    const prevLen = prevFeedLengthRef.current;
    const curLen = feedItemsWithLive.length;
    prevFeedLengthRef.current = curLen;

    if (curLen < prevLen && activeIndex >= curLen && curLen > 0) {
      setActiveIndex(curLen - 1);
      const container = containerRef.current;
      if (container) {
        container.scrollTo({ top: (curLen - 1) * container.clientHeight, behavior: 'smooth' });
      }
    }
  }, [feedItemsWithLive.length, activeIndex]);

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
      {/* Top Navigation Bar */}
      <div className="fixed left-0 right-0 z-[9999] flex justify-center pointer-events-none"
           style={{ top: 'calc(var(--safe-top) + 2px)' }}>
        <div className="w-full max-w-[480px] relative px-2">
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-[200%] rounded-full pointer-events-none" style={{background:'radial-gradient(ellipse at center, rgba(201,169,110,0.15) 0%, rgba(201,169,110,0.05) 40%, transparent 70%)'}} />
          <div className="relative w-full">
            <img 
              src="/Icons/Top Bar.png" 
              alt="Navigation" 
              className="w-full h-auto pointer-events-none"
              style={{ filter: 'drop-shadow(0 0 20px rgba(201,169,110,0.4)) drop-shadow(0 4px 30px rgba(201,169,110,0.2)) drop-shadow(0 2px 8px rgba(0,0,0,0.6))' }}
            />
            <div className="absolute inset-0 flex items-center pointer-events-auto">
              <button onClick={() => navigate('/live', { replace: true })} className="h-full bg-transparent border-0 p-0 m-0" style={{ width: '13%' }} title="Live" />
              <button onClick={() => navigate('/discover')} className="h-full bg-transparent border-0 p-0 m-0" style={{ width: '12%' }} title="STEM" />
              <button onClick={() => navigate('/discover')} className="h-full bg-transparent border-0 p-0 m-0" style={{ width: '15%' }} title="Explore" />
              <button onClick={() => navigate('/following')} className="h-full bg-transparent border-0 p-0 m-0" style={{ width: '18%' }} title="Following" />
              <button onClick={() => navigate('/shop')} className="h-full bg-transparent border-0 p-0 m-0" style={{ width: '12%' }} title="Shop" />
              <button onClick={() => navigate('/feed', { replace: true })} className="h-full bg-transparent border-0 p-0 m-0" style={{ width: '15%' }} title="For You" />
              <button onClick={() => navigate('/search')} className="h-full bg-transparent border-0 p-0 m-0" style={{ width: '15%' }} title="Search" />
            </div>
          </div>
        </div>
      </div>

      {feedItemsWithLive.map((item, index) => {
        const itemKey = item.kind === 'live' ? `live-${item.stream.streamKey}` : `video-${item.videoId}-${index}`;
        return (
          <div
            key={itemKey}
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
              style={{ margin: 0, gap: 0 }}
            >
              {item.kind === 'live' ? (
                <LivePreviewCard
                  streamKey={item.stream.streamKey}
                  name={item.stream.name}
                  avatar={item.stream.avatar}
                  viewers={item.stream.viewers}
                  title={item.stream.title}
                  isActive={activeIndex === index}
                />
              ) : (
                <EnhancedVideoPlayer
                  videoId={item.videoId}
                  isActive={activeIndex === index}
                  onVideoEnd={() => handleVideoEnd(index)}
                />
              )}
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
