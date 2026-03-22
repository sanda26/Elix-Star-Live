import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiStub } from '../lib/apiStub';
import { useAuthStore } from '../store/useAuthStore';
import { useVideoStore } from '../store/useVideoStore';
import { trackScreenView } from '../lib/analytics';
import EnhancedVideoPlayer from '../components/EnhancedVideoPlayer';
import { apiUrl } from '../lib/api';
import { profileRingInnerPx } from '../lib/profileFrame';

const STORY_RING_OUTER = 85;
const STORY_RING_INNER = profileRingInnerPx(STORY_RING_OUTER);

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
  const followingIds = useVideoStore((s) => s.followingUsers);
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
      const [profilesRes, streamsRes] = await Promise.all([
        fetch(apiUrl('/api/profiles'), { credentials: 'include' }),
        fetch(apiUrl('/api/live/streams'), { credentials: 'include' }).catch(() => null as any),
      ]);

      const profilesBody = await profilesRes.json().catch(() => ({ profiles: [] }));
      const streamsBody = streamsRes ? await streamsRes.json().catch(() => ({ streams: [] })) : { streams: [] };

      const profiles = Array.isArray(profilesBody?.profiles) ? profilesBody.profiles : [];
      const byId = new Map<string, any>();
      for (const p of profiles) {
        const id = String(p.user_id ?? p.userId ?? '');
        if (!id) continue;
        byId.set(id, p);
      }

      const streams = Array.isArray(streamsBody?.streams) ? streamsBody.streams : [];
      const liveMap = new Map<string, string>();
      for (const s of streams) {
        const uid = String(s.user_id ?? s.userId ?? '');
        const streamKey = String(s.stream_key ?? s.streamKey ?? s.room_id ?? uid);
        if (uid && streamKey) liveMap.set(uid, streamKey);
      }

      const followingSet = new Set(followingIds || []);

      const followingUsersList: FollowingUser[] = (followingIds || [])
        .filter((id) => id && id !== user.id)
        .map((id) => {
          const p = byId.get(id);
          return {
            id,
            username: String(p?.username ?? 'user'),
            name: String(p?.display_name ?? p?.displayName ?? p?.username ?? 'User'),
            avatar_url: (p?.avatar_url ?? p?.avatarUrl ?? null) as any,
            is_live: liveMap.has(id),
            stream_id: liveMap.get(id),
            is_following: true,
          };
        });

      const otherLiveUsers: FollowingUser[] = Array.from(liveMap.entries())
        .filter(([uid]) => uid && uid !== user.id && !followingSet.has(uid))
        .map(([uid, streamKey]) => {
          const p = byId.get(uid);
          return {
            id: uid,
            username: String(p?.username ?? 'user'),
            name: String(p?.display_name ?? p?.displayName ?? p?.username ?? 'User'),
            avatar_url: (p?.avatar_url ?? p?.avatarUrl ?? null) as any,
            is_live: true,
            stream_id: streamKey,
            is_following: false,
          };
        });

      const liveFollowers = followingUsersList.filter((u) => u.is_live);
      const nonLiveFollowers = followingUsersList.filter((u) => !u.is_live);
      const finalList = [...liveFollowers, ...otherLiveUsers, ...nonLiveFollowers];
      setFollowingUsers(finalList);
    } catch {
      setFollowingUsers([]);
    }
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
    <div className="h-full min-h-0 w-full flex justify-center bg-[#13151A]">
      <div className="w-full max-w-[480px] h-full min-h-0 flex flex-col overflow-hidden mx-auto">
        <div className="w-full shrink-0 bg-[#13151A] z-10 relative pt-app-header-safe">
          <div className="px-3 pb-1 flex items-center justify-between relative">
            <button onClick={() => navigate('/search')} className="p-1 z-10" aria-label="Search"><Search size={18} className="text-white" /></button>
            <h1 className="text-sm font-bold text-white absolute left-1/2 transform -translate-x-1/2">Following</h1>
            <button
              onClick={() => navigate(-1)}
              title="Back"
              className="p-1 z-10"
            >
              <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5 object-contain" />
            </button>
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
                  <img src="/Icons/Profile icon.png" alt="" className="w-full h-full object-contain" style={{ position: 'relative', zIndex: 1 }} />
                  <img
                    src={user?.avatar || (user?.id && typeof localStorage !== 'undefined' ? localStorage.getItem('elix_avatar_' + user.id) : null) || '/Icons/Profile icon.png'}
                    alt="You"
                    className="absolute rounded-full object-cover"
                    style={{
                      width: STORY_RING_INNER,
                      height: STORY_RING_INNER,
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      objectPosition: 'center center',
                      zIndex: 0,
                    }}
                  />
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
                  <div className="relative flex items-center justify-center" style={{ width: 85, height: 85 }}>
                    {u.is_live ? (
                      <>
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            width: 85, height: 85,
                            background: 'conic-gradient(#ff0040, #ff6a00, #ff0040, #ff6a00, #ff0040)',
                            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
                            mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
                          }}
                        />
                        <img
                          src={u.avatar_url || '/Icons/Profile icon.png'}
                          alt={u.name || u.username}
                          className="absolute rounded-full object-cover"
                          style={{
                            width: STORY_RING_INNER,
                            height: STORY_RING_INNER,
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            objectPosition: 'center center',
                            zIndex: 1,
                          }}
                        />
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded z-20 whitespace-nowrap">
                          LIVE
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="relative" style={{ width: 85, height: 85 }}>
                          <img src="/Icons/Profile icon.png" alt="" className="w-full h-full object-contain" style={{ position: 'relative', zIndex: 1 }} />
                          <img
                            src={u.avatar_url || '/Icons/Profile icon.png'}
                            alt={u.name || u.username}
                            className="absolute rounded-full object-cover"
                            style={{
                              width: STORY_RING_INNER,
                              height: STORY_RING_INNER,
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              objectPosition: 'center center',
                              zIndex: 0,
                            }}
                          />
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

        <div
          ref={containerRef}
          className="flex-1 min-h-0 w-full overflow-y-scroll snap-y snap-mandatory relative overscroll-none bg-[#0A0B0E]"
          style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}
          onScroll={handleScroll}
        >
          {friendVideoIds.map((videoId, index) => (
            <div
              key={`following-${videoId}-${index}`}
              data-slide-index={index}
              className="h-full w-full shrink-0 snap-start bg-[#0A0B0E]"
              style={{
                height: '100%',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
              }}
            >
              <div className="w-full h-full min-h-0 relative overflow-hidden bg-[#0A0B0E]">
                <EnhancedVideoPlayer
                  videoId={videoId}
                  isActive={activeIndex === index}
                  onVideoEnd={() => handleVideoEnd(index)}
                />
              </div>
            </div>
          ))}

          {loading && friendVideoIds.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-8 h-8 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && friendVideoIds.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 px-6 text-center">
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
