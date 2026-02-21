import { useEffect, useRef, useState } from 'react';
import { Search, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { trackScreenView } from '../lib/analytics';
import EnhancedVideoPlayer from '../components/EnhancedVideoPlayer';

interface FollowingUser {
  id: string;
  username: string;
  avatar_url: string | null;
  is_live: boolean;
  stream_id?: string;
}

export default function FollowingFeed() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [followingUsers, setFollowingUsers] = useState<FollowingUser[]>([]);
  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackScreenView('following_feed');
    if (user?.id) loadData();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: followData } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id);
      const followingIds = (followData || []).map((f: any) => f.following_id);
      if (followingIds.length === 0) { setLoading(false); return; }

      const [profilesRes, liveRes, videosRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', followingIds),
        supabase
          .from('live_streams')
          .select('id, user_id')
          .in('user_id', followingIds)
          .eq('is_live', true),
        supabase
          .from('videos')
          .select('id, user_id')
          .in('user_id', followingIds)
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const liveMap = new Map<string, string>();
      (liveRes.data || []).forEach((s: any) => liveMap.set(s.user_id, s.id));

      const users: FollowingUser[] = (profilesRes.data || []).map((p: any) => ({
        id: p.user_id,
        username: p.username || 'user',
        avatar_url: p.avatar_url,
        is_live: liveMap.has(p.user_id),
        stream_id: liveMap.get(p.user_id),
      }));
      users.sort((a, b) => (a.is_live === b.is_live ? 0 : a.is_live ? -1 : 1));
      setFollowingUsers(users);
      setVideoIds((videosRes.data || []).map((v: any) => v.id));
    } catch {}
    setLoading(false);
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollPos = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const index = Math.round(scrollPos / height);
    if (index >= 0 && index < videoIds.length) setActiveIndex(index);
  };

  const handleVideoEnd = (index: number) => {
    if (!containerRef.current || index >= videoIds.length - 1) return;
    containerRef.current.scrollTo({
      top: (index + 1) * containerRef.current.clientHeight,
      behavior: 'smooth',
    });
  };

  return (
    <div className="fixed inset-0 bg-[#13151A] flex justify-center">
      <div className="w-full max-w-[480px] flex flex-col h-full overflow-hidden">

        {/* Header + Circles with gold frame */}
        <div className="mx-2 mt-2 rounded-t-2xl border-2 border-b-0 border-[#C9A96E] bg-[#13151A] z-10" style={{ boxShadow: '0 0 8px rgba(212,175,55,0.3)' }}>
          <div className="px-3 pt-[env(safe-area-inset-top,8px)] pb-1 flex items-center justify-between relative">
            <button onClick={() => navigate(-1)} className="p-1 z-10" title="Back">
              <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-bold text-white absolute left-1/2 transform -translate-x-1/2">Following</h1>
            <div className="flex items-center gap-3 z-10">
              <button onClick={() => navigate('/search')} aria-label="Search"><Search size={18} className="text-white" /></button>
            </div>
          </div>

          {/* Circles */}
          <div className="px-3 py-2">
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => navigate('/create')}
                className="flex-shrink-0 flex flex-col items-center gap-1" style={{ width: 95, minWidth: 95 }}
              >
                <div className="relative" style={{ width: 85, height: 85 }}>
                  <img src="/Icons/Profile icon.png" alt="" className="w-full h-full object-contain" />
                </div>
                <div className="text-[11px] text-white/80 truncate w-full text-center">Create</div>
              </button>

              {followingUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => u.is_live ? navigate(`/watch/${u.id}`) : navigate(`/profile/${u.id}`)}
                  className="flex-shrink-0 flex flex-col items-center gap-1" style={{ width: 95, minWidth: 95 }}
                >
                  <div className="relative" style={{ width: 85, height: 85 }}>
                    <img
                      src="/Icons/Profile icon.png"
                      alt=""
                      className="w-full h-full object-contain"
                      style={u.is_live ? { filter: 'hue-rotate(-30deg) saturate(2) brightness(1.1)' } : undefined}
                    />
                    {u.avatar_url && (
                      <img
                        src={u.avatar_url}
                        alt={u.username}
                        className="absolute rounded-full object-cover"
                        style={{ width: 52, height: 52, top: '45%', left: '51%', transform: 'translate(-50%, -50%)', zIndex: -1 }}
                      />
                    )}
                    {u.is_live && (
                      <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-500 rounded-full flex items-center gap-1 z-10">
                        <Radio size={8} className="text-white" />
                        <span className="text-[8px] font-bold text-white uppercase">Live</span>
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-white/80 truncate w-full text-center">{u.username}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Video feed */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory"
          style={{ scrollSnapType: 'y mandatory' }}
          onScroll={handleScroll}
        >
          {videoIds.map((videoId, index) => (
            <div
              key={`following-${videoId}-${index}`}
              className="w-full snap-start relative flex justify-center bg-[#13151A] px-2 pb-2"
              style={{ height: '100%', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
            >
              <div className="w-full h-full relative rounded-b-2xl overflow-hidden border-2 border-t-0 border-[#C9A96E]" style={{ boxShadow: '0 0 8px rgba(212,175,55,0.3)' }}>
                <EnhancedVideoPlayer
                  videoId={videoId}
                  isActive={activeIndex === index}
                  onVideoEnd={() => handleVideoEnd(index)}
                />
              </div>
            </div>
          ))}

          {loading && videoIds.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && videoIds.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-white/50 px-6 text-center">
              <p className="text-base font-semibold mb-1">No videos from people you follow</p>
              <p className="text-xs text-white/30 mb-4">Follow people to see their videos here</p>
              <button
                onClick={() => navigate('/discover')}
                className="px-5 py-2 bg-[#C9A96E] text-black rounded-full text-sm font-bold"
              >
                Discover people
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
