import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Search, Share2, Plus, UserPlus, Radio } from 'lucide-react';
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
      const { data: following } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', currentUserId);

      const followingIds = following?.map(f => f.following_id) || [];

      if (followingIds.length === 0) {
        setLoading(false);
        return;
      }

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
    <div className="min-h-[100dvh] bg-[#121212] text-[#00f2ea] flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] rounded-3xl overflow-hidden bg-[#121212] pt-[var(--safe-top)] pb-[calc(var(--safe-bottom)+12mm)] overflow-y-auto">
        {/* Header — same as Friends */}
        <div className="p-4 flex items-center justify-between relative">
          <button onClick={() => navigate(-1)} className="p-1 z-10" title="Back">
            <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
          </button>

          <h1 className="text-lg font-bold absolute left-1/2 transform -translate-x-1/2">Following</h1>

          <div className="flex items-center gap-4 z-10">
            <button onClick={() => navigate('/search')} aria-label="Search"><Search size={24} /></button>
            <button onClick={() => navigate('/search')} title="Add" className="w-8 h-8 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                <Plus size={16} className="text-[#00f2ea] stroke-[4px]" />
              </div>
            </button>
          </div>
        </div>

        {/* Circles Section — same as Friends */}
        <div className="px-4 pb-4">
          <div className="flex gap-4 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => navigate('/create')}
              className="flex-shrink-0 w-[72px] flex flex-col items-center gap-2"
            >
              <div className="relative w-16 h-16 rounded-full bg-[#121212]">
                <div className="absolute inset-0 rounded-full ring-2 ring-[#00f2ea]" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#00f2ea] flex items-center justify-center text-black font-bold leading-none">+</div>
                <img
                  src="https://ui-avatars.com/api/?name=Create&background=121212&color=00f2ea"
                  alt="Create"
                  className="w-full h-full rounded-full object-cover"
                  draggable={false}
                />
              </div>
              <div className="text-xs text-[#00f2ea]/80 truncate w-full text-center">Create</div>
            </button>

            {followingUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => navigate(`/profile/${u.id}`)}
                className="flex-shrink-0 w-[72px] flex flex-col items-center gap-2"
              >
                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[#00f2ea] to-[#00f2ea]">
                  <div className="w-full h-full rounded-full bg-[#121212] p-[2px]">
                    <img src={u.avatar_url || ''} alt={u.username} className="w-full h-full rounded-full object-cover" draggable={false} />
                  </div>
                </div>
                <div className="text-xs text-[#00f2ea]/80 truncate w-full text-center">{u.username}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Video Content */}
        {loading ? (
          <div className="flex items-center justify-center h-[60dvh]">
            <div className="text-[#00f2ea]/40">Loading...</div>
          </div>
        ) : videos.length > 0 ? (
          <div className="px-2 pb-6">
            {videos.map((video, index) => (
              <div key={video.id} className="w-full rounded-3xl overflow-hidden bg-[#121212] relative aspect-[9/16] mb-4">
                <EnhancedVideoPlayer
                  videoId={video.id}
                  isActive={index === activeVideoIndex}
                  onVideoEnd={() => {}}
                />

                {video.creator?.is_live && (
                  <button
                    onClick={() => navigate(`/live/${video.user_id}`)}
                    className="absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-2 bg-red-500 rounded-full animate-pulse"
                  >
                    <Radio className="w-4 h-4" />
                    <span className="text-xs font-bold">LIVE NOW</span>
                  </button>
                )}

                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.55) 100%)' }} />

                <div className="absolute right-3 bottom-4 flex flex-col items-center gap-4 pointer-events-auto">
                  <button type="button" onClick={() => navigate('/discover')} title="Discover" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-[#00f2ea]" />
                  </button>
                  <button type="button" onClick={() => navigate('/inbox')} title="Messages" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-[#00f2ea]" />
                  </button>
                  <button type="button" onClick={() => { if (navigator.share) navigator.share({ title: 'Elix', url: window.location.href }); }} title="Share" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-[#00f2ea]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-8 h-[60dvh]">
            <UserPlus size={48} className="mb-4 text-[#00f2ea]/40" />
            <h2 className="text-xl font-bold mb-2">Follow creators</h2>
            <p className="text-[#00f2ea]/60 mb-6">Videos from people you follow will appear here</p>
            <button
              onClick={() => navigate('/discover')}
              className="px-6 py-3 bg-[#00f2ea] text-black rounded-full font-bold hover:opacity-90 transition"
            >
              Discover Creators
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
