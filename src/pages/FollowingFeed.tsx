import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useVideoStore } from '../store/useVideoStore';
import { trackScreenView } from '../lib/analytics';
import EnhancedVideoPlayer from '../components/EnhancedVideoPlayer';

interface FollowingUser {
  id: string;
  username: string;
  name: string;
  avatar_url: string | null;
  is_live: boolean;
  stream_id?: string;
  is_following?: boolean;
}

export default function FollowingFeed() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { friendVideos, fetchFriendVideos, friendsLoading: loading } = useVideoStore();
  const [followingUsers, setFollowingUsers] = useState<FollowingUser[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const friendVideoIds = friendVideos.map((v) => v.id);

  useEffect(() => {
    trackScreenView('following_feed');
    if (user?.id) {
      loadData();
      fetchFriendVideos();
    }
  }, [user?.id, fetchFriendVideos]);

  const loadData = async () => {
    if (!user?.id) return;
    try {
      const { data: followData } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id);
      const followingIds = (followData || []).map((f: any) => f.following_id);

      const { data: liveData } = await supabase
        .from('live_streams')
        .select('id, user_id')
        .eq('is_live', true);
      const liveList = liveData || [];
      const liveUserIds = [...new Set(liveList.map((s: any) => s.user_id))];
      const liveMap = new Map<string, string>();
      liveList.forEach((s: any) => liveMap.set(s.user_id, s.id));

      const allLiveUserIds = liveUserIds.length ? liveUserIds : [];
      const followingSet = new Set(followingIds);

      const idsToFetch = followingIds.length > 0
        ? [...new Set([...followingIds, ...allLiveUserIds])]
        : allLiveUserIds;
      if (idsToFetch.length === 0) {
        setFollowingUsers([]);
        return;
      }

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url')
        .in('user_id', idsToFetch);

      const profiles = profilesData || [];
      const followingWithLive = followingIds
        .map((id: string) => {
          const p = profiles.find((r: any) => r.user_id === id);
          if (!p) return null;
          const isLive = liveMap.has(id);
          return {
            id: p.user_id,
            username: p.username || 'user',
            name: (p.display_name || p.username || 'User') as string,
            avatar_url: p.avatar_url,
            is_live: isLive,
            stream_id: liveMap.get(p.user_id),
            is_following: true,
          } as FollowingUser;
        })
        .filter(Boolean) as FollowingUser[];

      const otherLiveIds = allLiveUserIds.filter((id: string) => !followingSet.has(id));
      const otherLiveUsers: FollowingUser[] = otherLiveIds.map((id: string) => {
        const p = profiles.find((r: any) => r.user_id === id);
        return {
          id,
          username: p?.username || 'user',
          name: (p?.display_name || p?.username || 'User') as string,
          avatar_url: p?.avatar_url || null,
          is_live: true,
          stream_id: liveMap.get(id),
          is_following: false,
        };
      });

      const liveFollowers = followingWithLive.filter((u) => u.is_live);
      const nonLiveFollowers = followingWithLive.filter((u) => !u.is_live);
      const circleUsers = [...liveFollowers, ...otherLiveUsers, ...nonLiveFollowers];

      setFollowingUsers(circleUsers);
    } catch {}
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollPos = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const index = Math.round(scrollPos / height);
    if (index >= 0 && index < friendVideoIds.length) setActiveIndex(index);
  };

  useEffect(() => {
    if (!containerRef.current || friendVideoIds.length === 0) return;
    const container = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = Number((entry.target as HTMLElement).dataset.slideIndex);
          if (!Number.isNaN(idx) && idx >= 0 && idx < friendVideoIds.length) setActiveIndex(idx);
        });
      },
      { root: container, rootMargin: '0px', threshold: 0.51 }
    );
    const slides = container.querySelectorAll('[data-slide-index]');
    slides.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [friendVideoIds.length]);

  const handleVideoEnd = (index: number) => {
    if (!containerRef.current || index >= friendVideoIds.length - 1) return;
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
          <div className="px-3 pt-[calc(env(safe-area-inset-top,8px)+6px)] pb-1 flex items-center justify-between relative">
            <button onClick={() => navigate('/search')} className="p-1 z-10" aria-label="Search"><Search size={18} className="text-white" /></button>
            <h1 className="text-sm font-bold text-white absolute left-1/2 transform -translate-x-1/2">Following</h1>
            <div className="flex items-center gap-3 z-10">
              <button onClick={() => navigate(-1)} title="Back">
                <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Circles — Create, then followers who are live, then all other users who are live; scroll left */}
          <div className="px-3 py-2">
            <div className="flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
              <button
                type="button"
                onClick={() => navigate('/create')}
                className="flex-shrink-0 flex flex-col items-center gap-1" style={{ width: 95, minWidth: 95 }}
              >
                <div className="relative" style={{ width: 85, height: 85 }}>
                  <img src="/Icons/Profile icon.png" alt="" className="w-full h-full object-contain" />
                  {(user?.avatar || (user?.id && typeof localStorage !== 'undefined' ? localStorage.getItem('elix_avatar_' + user.id) : null)) && (
                    <img
                      src={user?.avatar || (user?.id && typeof localStorage !== 'undefined' ? localStorage.getItem('elix_avatar_' + user.id) : null) || ''}
                      alt="You"
                      className="absolute rounded-full object-cover"
                      style={{ width: 52, height: 52, top: '45%', left: '51%', transform: 'translate(-50%, -50%)', zIndex: -1 }}
                    />
                  )}
                </div>
                <div className="text-[11px] text-white/80 truncate w-full text-center">Create</div>
              </button>

              {followingUsers.filter((u) => u.id !== user?.id && (u.name || u.username || '').trim().toLowerCase() !== 'user').map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => u.is_live ? navigate(`/watch/${u.id}`) : navigate(`/profile/${u.id}`)}
                  className="flex-shrink-0 flex flex-col items-center gap-1" style={{ width: 95, minWidth: 95 }}
                >
                  <div className="relative flex items-center justify-center" style={{ width: 90, height: 90 }}>
                    {u.is_live ? (
                      <>
                        <div className="absolute inset-0 rounded-full border-4 border-red-500" style={{ width: 90, height: 90 }} />
                        <div className="relative rounded-full overflow-hidden flex items-center justify-center" style={{ width: 78, height: 78 }}>
                          <img
                            src="/Icons/Profile icon.png"
                            alt=""
                            className="w-full h-full object-contain"
                          />
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.name || u.username}
                              className="absolute rounded-full object-cover"
                              style={{ width: 48, height: 48, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: -1 }}
                            />
                          ) : (
                            <span className="absolute text-[#C9A96E] font-bold text-lg z-10" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                              {(u.name || u.username || 'U').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded z-20 whitespace-nowrap">
                          LIVE
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="relative" style={{ width: 85, height: 85 }}>
                          <img
                            src="/Icons/Profile icon.png"
                            alt=""
                            className="w-full h-full object-contain"
                          />
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.name || u.username}
                              className="absolute rounded-full object-cover"
                              style={{ width: 52, height: 52, top: '45%', left: '51%', transform: 'translate(-50%, -50%)', zIndex: -1 }}
                            />
                          ) : (
                            <span className="absolute text-[#C9A96E] font-bold text-xl z-10" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                              {(u.name || u.username || 'U').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-white/80 truncate w-full text-center">{u.name || u.username}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Friend video feed — full-height scroll, play when in view */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 overflow-y-scroll snap-y snap-mandatory overscroll-none"
          style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}
          onScroll={handleScroll}
        >
          {friendVideoIds.map((videoId, index) => (
            <div
              key={`following-${videoId}-${index}`}
              data-slide-index={index}
              className="w-full min-h-full snap-start snap-always relative flex justify-center bg-[#13151A] px-2 pb-2"
              style={{ height: '100%', minHeight: '100%', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
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

          {loading && friendVideoIds.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && friendVideoIds.length === 0 && (
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
