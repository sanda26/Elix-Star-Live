import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LivePreviewCard from '../components/LivePreviewCard';
import EnhancedVideoPlayer from '../components/EnhancedVideoPlayer';
import { useVideoStore } from '../store/useVideoStore';
import { supabase } from '../lib/supabase';

type LiveStreamCard = {
  streamKey: string;
  name: string;
  avatar?: string;
  viewers: number;
  title?: string;
  thumbnail?: string;
};

type FeedItem =
  | { kind: 'live'; stream: LiveStreamCard }
  | { kind: 'video'; videoId: string };

export default function VideoFeed() {
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [liveStreams, setLiveStreams] = useState<LiveStreamCard[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const removedKeysRef = useRef<Set<string>>(new Set());

  const { videos, fetchVideos, loading: videosLoading } = useVideoStore();

  const removeLiveStream = useCallback((streamKey: string) => {
    removedKeysRef.current.add(streamKey);
    setLiveStreams(prev => prev.filter(s => s.streamKey !== streamKey));
    setTimeout(() => removedKeysRef.current.delete(streamKey), 15000);
  }, []);

  const fetchLiveStreams = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('live_streams')
        .select('*')
        .eq('is_live', true)
        .order('viewer_count', { ascending: false });

      if (!data || data.length === 0) {
        setLiveStreams([]);
        setLiveLoading(false);
        return;
      }

      const userIds = (data as any[]).map((s: any) => s.user_id).filter(Boolean);
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('user_id, username, display_name, avatar_url').in('user_id', userIds)
        : { data: [] };
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      const removed = removedKeysRef.current;
      setLiveStreams((data as any[])
        .filter((s: any) => !removed.has(s.stream_key) && !removed.has(s.id))
        .map((s: any) => {
          const p: any = profileMap.get(s.user_id);
          return {
            streamKey: s.stream_key || s.id,
            name: p?.display_name || p?.username || s.title || 'Creator',
            avatar: p?.avatar_url || '',
            viewers: s.viewer_count || 0,
            title: s.title || undefined,
            thumbnail: s.thumbnail_url || '',
          };
        }));
    } catch {
      setLiveStreams([]);
    }
    setLiveLoading(false);
  }, []);

  useEffect(() => {
    fetchLiveStreams();
    fetchVideos();

    const chan = supabase
      .channel('feed_live_streams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, (payload: any) => {
        const row = payload.new;
        if (row && row.is_live === false) {
          removeLiveStream(row.stream_key || row.id);
          return;
        }
        if (payload.eventType === 'DELETE' && payload.old) {
          const old = payload.old;
          removeLiveStream(old.stream_key || old.id);
          return;
        }
        if (payload.eventType === 'INSERT' && row?.is_live) {
          fetchLiveStreams();
        }
      })
      .subscribe();

    const poll = setInterval(fetchLiveStreams, 15000);

    return () => {
      supabase.removeChannel(chan);
      clearInterval(poll);
    };
  }, [fetchLiveStreams, fetchVideos, removeLiveStream]);

  useEffect(() => {
    if (location.pathname === '/feed') {
      setActiveIndex(0);
      fetchLiveStreams();
      fetchVideos();
      setTimeout(() => {
        containerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      }, 0);
    }
  }, [location.pathname, fetchLiveStreams, fetchVideos]);

  const feedItems: FeedItem[] = [
    ...liveStreams.map((stream): FeedItem => ({ kind: 'live', stream })),
    ...videos.map((v): FeedItem => ({ kind: 'video', videoId: v.id })),
  ];

  const handleScroll = () => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const index = Math.round(container.scrollTop / container.clientHeight);
    if (index >= 0 && index < feedItems.length) {
      setActiveIndex(index);
    }
  };

  const handleVideoEnd = (index: number) => {
    if (!containerRef.current || index >= feedItems.length - 1) return;
    containerRef.current.scrollTo({
      top: (index + 1) * containerRef.current.clientHeight,
      behavior: 'smooth',
    });
  };

  const prevCountRef = useRef(feedItems.length);
  useEffect(() => {
    const prev = prevCountRef.current;
    const cur = feedItems.length;
    prevCountRef.current = cur;
    if (cur < prev && activeIndex >= cur && cur > 0) {
      setActiveIndex(cur - 1);
      containerRef.current?.scrollTo({
        top: (cur - 1) * (containerRef.current?.clientHeight || 0),
        behavior: 'smooth',
      });
    }
  }, [feedItems.length, activeIndex]);

  const loading = liveLoading && videosLoading;

  return (
    <div
      ref={containerRef}
      className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory relative bg-[#0A0B0E]"
      style={{ scrollSnapType: 'y mandatory' }}
      onScroll={handleScroll}
    >
      {/* Top Navigation Bar */}
      <div className="fixed left-0 right-0 z-[9999] flex justify-center pointer-events-none"
           style={{ top: 'calc(var(--safe-top) + 2px)' }}>
        <div className="w-full max-w-[480px] relative px-2">
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-[200%] rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(201,169,110,0.15) 0%, rgba(201,169,110,0.05) 40%, transparent 70%)' }} />
          <div className="relative w-full">
            <img
              src="/Icons/Top Bar.png"
              alt="Navigation"
              className="w-full h-auto pointer-events-none"
              style={{ filter: 'drop-shadow(0 0 20px rgba(201,169,110,0.4)) drop-shadow(0 4px 30px rgba(201,169,110,0.2)) drop-shadow(0 2px 8px rgba(0,0,0,0.6))' }}
            />
            <div className="absolute inset-0 flex items-center pointer-events-auto z-10">
              <button type="button" onClick={() => navigate('/live', { replace: true })} className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer" style={{ width: '13%', minWidth: 0 }} title="Live" />
              <button type="button" onClick={() => navigate('/stem')} className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer" style={{ width: '12%', minWidth: 0 }} title="STEM" />
              <button type="button" onClick={() => navigate('/discover')} className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer" style={{ width: '15%', minWidth: 0 }} title="Explore" />
              <button type="button" onClick={() => navigate('/following')} className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer" style={{ width: '18%', minWidth: 0 }} title="Following" />
              <button type="button" onClick={() => navigate('/shop')} className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer" style={{ width: '12%', minWidth: 0 }} title="Shop" />
              <button type="button" onClick={() => navigate('/feed', { replace: true })} className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer" style={{ width: '15%', minWidth: 0 }} title="For You" />
              <button type="button" onClick={() => navigate('/search')} className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer" style={{ width: '15%', minWidth: 0 }} title="Search" />
            </div>
          </div>
        </div>
      </div>

      {/* Feed items: live streams first, then videos */}
      {feedItems.map((item, index) => {
        if (item.kind === 'live') {
          return (
            <div
              key={`live-${item.stream.streamKey}`}
              className="h-[100dvh] w-full snap-start relative flex justify-center bg-[#0A0B0E]"
              style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
            >
              <div className="w-full max-w-[480px] h-full relative">
                <LivePreviewCard
                  streamKey={item.stream.streamKey}
                  name={item.stream.name}
                  avatar={item.stream.avatar}
                  viewers={item.stream.viewers}
                  title={item.stream.title}
                  thumbnail={item.stream.thumbnail}
                  isActive={activeIndex === index}
                />
              </div>
            </div>
          );
        }

        return (
          <div
            key={`video-${item.videoId}-${index}`}
            className="h-[100dvh] w-full snap-start relative flex justify-center bg-[#0A0B0E]"
            style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
          >
            <div className="w-full max-w-[480px] h-full relative">
              <EnhancedVideoPlayer
                videoId={item.videoId}
                isActive={activeIndex === index}
                onVideoEnd={() => handleVideoEnd(index)}
              />
            </div>
          </div>
        );
      })}

      {loading && feedItems.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && feedItems.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-[#13151A] border border-white/10 flex items-center justify-center mb-4">
            <span className="text-3xl">📡</span>
          </div>
          <p className="text-white/60 font-semibold text-base mb-1">Nothing here yet</p>
          <p className="text-white/30 text-sm mb-4">Check back soon!</p>
          <button
            onClick={() => { fetchLiveStreams(); fetchVideos(); }}
            className="px-5 py-2 bg-[#C9A96E]/20 border border-[#C9A96E]/40 rounded-full text-[#C9A96E] text-sm font-bold pointer-events-auto active:scale-95 transition-transform"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
