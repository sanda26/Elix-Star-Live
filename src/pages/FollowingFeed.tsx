import { useState, useEffect } from 'react';
import { UserPlus, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { trackScreenView } from '../lib/analytics';
import EnhancedVideoPlayer from '../components/EnhancedVideoPlayer';

interface Video {
  id: string;
  video_url: string;
  thumbnail_url: string;
  description: string;
  user_id: string;
  creator?: { username: string; avatar_url: string | null; is_live: boolean };
}

export default function FollowingFeed() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeVideoIndex] = useState(0);
  const followingUsers = (() => {
    const map = new Map<string, { id: string; username: string; avatar_url: string | null }>();
    for (const v of videos) {
      if (!v.creator?.username) continue;
      if (map.has(v.user_id)) continue;
      map.set(v.user_id, { id: v.user_id, username: v.creator.username, avatar_url: v.creator.avatar_url ?? null });
    }
    return Array.from(map.values()).slice(0, 10);
  })();

  const headerHeight = !loading && followingUsers.length > 0 ? 160 : 72;

  useEffect(() => {
    loadCurrentUser();
    trackScreenView('following_feed');
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadFollowingVideos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const loadCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    setCurrentUserId(data.user?.id || null);
  };

  const loadFollowingVideos = async () => {
    if (!currentUserId) return;

    setLoading(true);
    try {
      // Get users the current user is following
      const { data: following } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', currentUserId);

      const followingIds = following?.map(f => f.following_id) || [];

      if (followingIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get videos from followed users
      const { data: videosData, error } = await supabase
        .from('videos')
        .select('*, creator:profiles!user_id(username, avatar_url, is_live)')
        .in('user_id', followingIds)
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setVideos(videosData || []);
    } catch (error) {
      console.error('Failed to load following videos:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-black text-white overflow-y-scroll snap-y snap-mandatory">
            {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-black">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:brightness-125 rounded-full transition">
            <img src="/Icons/power-button.png" alt="Back" className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold">Following</h1>
          <div className="w-10"></div>
        </div>

        {!loading && followingUsers.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex gap-4 overflow-x-auto no-scrollbar">
              {followingUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => navigate(`/profile/${u.id}`)}
                  className="flex-shrink-0 w-[72px] flex flex-col items-center gap-2"
                >
                  <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[#00f5ff] via-[#00f5ff] to-[#E6B36A]">
                    <div className="w-full h-full rounded-full bg-[#121212] p-[2px]">
                      <img src={u.avatar_url || ''} alt={u.username} className="w-full h-full rounded-full object-cover" draggable={false} />
                    </div>
                  </div>
                  <div className="text-xs text-white/80 truncate w-full text-center">{u.username}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ paddingTop: headerHeight }}>
      {loading ? (
        <div className="flex items-center justify-center" style={{ height: `calc(100dvh - ${headerHeight}px)` }}>
          <div className="text-white/40">Loading...</div>
        </div>
      ) : videos.length > 0 ? (
        videos.map((video, index) => (
          <div key={video.id} className="snap-start relative" style={{ height: `calc(100dvh - ${headerHeight}px)` }}>
            <EnhancedVideoPlayer
              videoId={video.id}
              isActive={index === activeVideoIndex}
              onVideoEnd={() => {}}
            />
            
            {/* Live Indicator (if creator is currently live) */}
            {video.creator?.is_live && (
              <button
                onClick={() => navigate(`/live/${video.user_id}`)}
                className="absolute top-20 right-4 z-30 flex items-center gap-2 px-3 py-2 bg-red-500 rounded-full animate-pulse"
              >
                <Radio className="w-4 h-4" />
                <span className="text-xs font-bold">LIVE NOW</span>
              </button>
            )}
          </div>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center text-center px-8" style={{ height: `calc(100dvh - ${headerHeight}px)` }}>
          <UserPlus size={48} className="mb-4 text-white/40" />
          <h2 className="text-xl font-bold mb-2">Follow creators</h2>
          <p className="text-white/60 mb-6">Videos from people you follow will appear here</p>
          <button
            onClick={() => navigate('/discover')}
            className="px-6 py-3 bg-[#E6B36A] text-black rounded-full font-bold hover:opacity-90 transition"
          >
            Discover Creators
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
