import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, Hash, Users, Video as VideoIcon, Trophy, Music, Flame, Sparkles, Star, Zap } from 'lucide-react';
import { trackEvent } from '../lib/analytics';
import { AvatarRing } from '../components/AvatarRing';
import { getVideoPosterUrl } from '../lib/bunnyStorage';
import { apiUrl } from '../lib/api';
import { isIndecentExploreCaption } from '../lib/suggestiveCaption';
import { useAuthStore } from '../store/useAuthStore';
import { useVideoStore } from '../store/useVideoStore';

interface Video {
  id: string;
  user_id: string;
  thumbnail_url: string;
  url: string;
  description: string;
  views: number;
  likes: number;
  engagement_score: number;
  creator?: { username: string; avatar_url: string | null };
}

interface User {
  user_id: string;
  username: string;
  avatar_url: string | null;
  followers_count: number;
}

interface Hashtag {
  tag: string;
  use_count: number;
}

interface CreatorRanking {
  rank: number;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_coins: number;
}

export default function Discover() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'trending' | 'search' | 'hashtags' | 'ranking'>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const { friendVideos, fetchFriendVideos, friendsLoading } = useVideoStore();
  const [searchResults, setSearchResults] = useState<{ videos: Video[]; users: User[] }>({
    videos: [],
    users: [],
  });
  const [trendingHashtags, setTrendingHashtags] = useState<Hashtag[]>([]);
  const [rankings, setRankings] = useState<CreatorRanking[]>([]);
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (activeTab === 'trending') {
      loadTrending();
    } else if (activeTab === 'hashtags') {
      loadHashtags();
    } else if (activeTab === 'ranking') {
      loadRanking();
    }
  }, [activeTab]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => {
        performSearch();
      }, 300); // Debounce
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        await fetchFriendVideos();
        if (cancelled) return;
      } catch {
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const followingVideosForUi: Video[] = (friendVideos || []).slice(0, 50).map((v: any) => ({
    id: String(v.id),
    user_id: String(v.user?.id ?? v.user_id ?? ''),
    thumbnail_url: v.thumbnail || v.thumbnail_url || getVideoPosterUrl(v.url || ''),
    url: v.url || '',
    description: v.description || '',
    views: v.stats?.views || 0,
    likes: v.stats?.likes || 0,
    engagement_score: 0,
    creator: {
      username: v.user?.username || v.user?.name || 'Creator',
      avatar_url: v.user?.avatar ?? null,
    },
  }));

  const loadTrending = async () => {
    setLoading(true);
    setTrendingVideos([]);
    try {
      const session = useAuthStore.getState().session;
      const headers: Record<string, string> = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(apiUrl('/api/videos'), { credentials: 'include', headers });
      if (!res.ok) throw new Error('Failed');
      const body = await res.json();
      const list = Array.isArray(body?.videos) ? body.videos : [];


      if (list.length > 0) {
        const profRes = await fetch(apiUrl('/api/profiles'), { credentials: 'include', headers });
        const allProfiles = profRes.ok ? ((await profRes.json()).profiles || []) : [];
        const profileMap: Record<string, { username: string; avatar_url: string | null }> = {};
        allProfiles.forEach((p: any) => { profileMap[p.user_id] = { username: p.username || 'User', avatar_url: p.avatar_url ?? null }; });

        const sorted = [...list].sort(
          (a: any, b: any) => (Number(b.views) || 0) - (Number(a.views) || 0),
        );

        /* Explore: only indecent-tagged clips (caption/hashtags), not all trending */
        const indecentOnly = sorted.filter((v: any) => {
          const tags = Array.isArray(v.hashtags) ? v.hashtags : [];
          return isIndecentExploreCaption(v.description || '', tags);
        });

        setTrendingVideos(indecentOnly.slice(0, 30).map((v: any) => ({
          id: v.id,
          user_id: v.userId || v.user_id,
          thumbnail_url: v.thumbnail || v.thumbnail_url || '',
          url: v.url || '',
          description: v.description || '',
          views: v.views || 0,
          likes: v.likes || 0,
          engagement_score: 0,
          creator: profileMap[v.userId || v.user_id] || { username: v.username || 'User', avatar_url: v.avatar || null },
        })));
      }
    } catch {
      setTrendingVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const loadHashtags = async () => {
    setLoading(true);
    try {
      // Extract hashtags from videos in the store
      const { videos } = useVideoStore.getState();
      const tagCount = new Map<string, number>();
      videos.forEach(v => (v.hashtags || []).forEach(h => tagCount.set(h, (tagCount.get(h) || 0) + 1)));
      const sorted = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);
      setTrendingHashtags(sorted.map(([name, count], i) => ({ id: i + 1, name, use_count: count, is_trending: count >= 3 })));
    } catch {
      setTrendingHashtags([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRanking = async () => {
    setLoading(true);
    try {
      const session = useAuthStore.getState().session;
      const headers: Record<string, string> = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl('/api/profiles'), { credentials: 'include', headers });
      if (!res.ok) throw new Error('Failed');
      const allProfiles = (await res.json()).profiles || [];
      const ranked = allProfiles
        .map((p: any, i: number) => ({ rank: i + 1, user_id: p.user_id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, score: p.followers_count || 0 }))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 50);
      setRankings(ranked);
    } catch {
      setRankings([]);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) return;
    setLoading(true);
    trackEvent('search_query', { query: searchQuery });
    try {
      const session = useAuthStore.getState().session;
      const headers: Record<string, string> = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const [videosRes, profilesRes] = await Promise.all([
        fetch(apiUrl('/api/videos'), { credentials: 'include', headers }),
        fetch(apiUrl('/api/profiles'), { credentials: 'include', headers }),
      ]);
      const allVids = videosRes.ok ? ((await videosRes.json()).videos || []) : [];
      const allProfiles = profilesRes.ok ? ((await profilesRes.json()).profiles || []) : [];
      const q = searchQuery.toLowerCase();
      const matchedVids = allVids.filter((v: any) => (v.description || '').toLowerCase().includes(q)).slice(0, 20);
      const matchedUsers = allProfiles.filter((p: any) => (p.username || '').toLowerCase().includes(q) || (p.display_name || '').toLowerCase().includes(q)).slice(0, 20);

      const profileMap: Record<string, { username: string; avatar_url: string | null }> = {};
      allProfiles.forEach((p: any) => { profileMap[p.user_id] = { username: p.username || 'User', avatar_url: p.avatar_url ?? null }; });
      setSearchResults({
        videos: matchedVids.map((v: any) => ({
          id: v.id, user_id: v.userId || v.user_id, thumbnail_url: v.thumbnail || '', url: v.url || '',
          description: v.description || '', views: v.views || 0, likes: v.likes || 0, engagement_score: 0,
          creator: profileMap[v.userId || v.user_id] || { username: v.username || 'User', avatar_url: v.avatar || null },
        })),
        users: matchedUsers,
      });
    } catch {
      setSearchResults({ videos: [], users: [] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#13151A] text-white flex justify-center">
      <div
        className="w-full max-w-[480px] flex flex-col overflow-hidden h-above-bottom-nav"
        style={{ marginTop: 0 }}
      >

        {/* ═══ HEADER (like before) ═══ */}
        <div className="mx-2 mt-2 rounded-t-2xl bg-[#13151A] z-10 shrink-0">
          <div className="px-3 pt-[calc(env(safe-area-inset-top,8px)+4px)] pb-1 flex items-center justify-between relative">
            <button onClick={() => document.getElementById('discover-search')?.focus()} className="p-1 z-10" title="Search">
              <Search className="w-4 h-4 text-[#C9A96E]" />
            </button>
            <h1 className="text-sm font-bold text-gold-metallic absolute left-1/2 transform -translate-x-1/2">Explore</h1>
            <button onClick={() => navigate(-1)} className="p-1 z-10" title="Back">
              <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="mx-3 mb-2 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
            <Search className="w-3.5 h-3.5 text-[#C9A96E]/50 shrink-0" />
            <input
              id="discover-search"
              type="text"
              placeholder="Search videos, users, hashtags..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (e.target.value.length >= 2) setActiveTab('search');
              }}
              className="flex-1 bg-transparent outline-none text-[13px] text-gold-metallic placeholder-[#C9A96E]/30"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-0.5 rounded-full bg-[#13151A] border border-white/15" title="Clear">
                <span className="text-white/50 text-xs leading-none px-1">✕</span>
              </button>
            )}
          </div>

          {/* Tabs */}
          {searchQuery.length < 2 && (
            <div className="flex gap-1.5 px-3 pb-2 no-scrollbar overflow-x-auto">
              <TabButton active={activeTab === 'trending'} onClick={() => setActiveTab('trending')} icon={<Flame className="w-3 h-3" />} label="Trending" />
              <TabButton active={activeTab === 'ranking'} onClick={() => setActiveTab('ranking')} icon={<Trophy className="w-3 h-3" />} label="Top 99" />
              <TabButton active={activeTab === 'hashtags'} onClick={() => setActiveTab('hashtags')} icon={<Hash className="w-3 h-3" />} label="Tags" />
              <TabButton active={false} onClick={() => { setSearchQuery('music'); setActiveTab('search'); }} icon={<Music className="w-3 h-3" />} label="Music" />
              <TabButton active={false} onClick={() => { setSearchQuery('comedy'); setActiveTab('search'); }} icon={<Sparkles className="w-3 h-3" />} label="Comedy" />
              <TabButton active={false} onClick={() => { setSearchQuery('gaming'); setActiveTab('search'); }} icon={<Zap className="w-3 h-3" />} label="Gaming" />
              <TabButton active={false} onClick={() => { setSearchQuery('dance'); setActiveTab('search'); }} icon={<Star className="w-3 h-3" />} label="Dance" />
            </div>
          )}
        </div>

        {/* ═══ CONTENT (unchanged) ═══ */}
        <div className="flex-1 overflow-y-auto mx-2 rounded-b-2xl bg-[#13151A] pb-24">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-7 h-7 border-2 border-[#C9A96E]/20 border-t-[#C9A96E] rounded-full animate-spin" />
              <p className="text-white/30 text-xs">Loading...</p>
            </div>
          )}

          {/* TRENDING */}
          {!loading && activeTab === 'trending' && (
            <div className="px-3 pt-3">
              {/* Following & Friends */}
              {friendsLoading ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <div className="w-7 h-7 border-2 border-[#C9A96E]/20 border-t-[#C9A96E] rounded-full animate-spin" />
                  <p className="text-white/30 text-xs">Loading friends & followers...</p>
                </div>
              ) : followingVideosForUi.length > 0 ? (
                <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-white/10 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#C9A96E] shrink-0" />
                    <div className="min-w-0">
                      <h2 className="text-[13px] font-bold text-gold-metallic leading-tight">Friends & followers</h2>
                      <p className="text-[9px] text-white/35 leading-tight mt-0.5">
                        Following + followers, one vertical feed (like For You)
                      </p>
                    </div>
                  </div>
                  <div className="p-3 w-full">
                    <DiscoverSnapStack videos={followingVideosForUi} />
                  </div>
                </div>
              ) : (
                <div className="mb-5">
                  <EmptyState
                    icon={<Users className="w-10 h-10" />}
                    text="No friends or followers videos yet"
                    sub="Follow creators or get followers who post — their videos will show here"
                  />
                </div>
              )}

              {trendingVideos.length > 0 ? (
                <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-white/10 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#C9A96E] shrink-0" />
                    <div className="min-w-0">
                      <h2 className="text-[13px] font-bold text-gold-metallic leading-tight">Indecent (Explore)</h2>
                      <p className="text-[9px] text-white/35 leading-tight mt-0.5">
                        Only videos whose caption or hashtags match indecent-style tags (e.g. nsfw, sexy, 18+). Sorted by views.
                      </p>
                    </div>
                  </div>
                  <div className="p-3 w-full">
                    <DiscoverSnapStack videos={trendingVideos} />
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<TrendingUp className="w-10 h-10" />}
                  text="No indecent-tagged videos yet"
                  sub="Creators add words like nsfw, sexy, or 18+ in the caption or hashtags to appear here."
                />
              )}
            </div>
          )}

          {/* SEARCH RESULTS */}
          {!loading && activeTab === 'search' && (
            <div className="px-3 pt-3">
              {searchResults.users.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Users className="w-4 h-4 text-[#C9A96E]" />
                    <h2 className="text-[14px] font-bold text-gold-metallic">Users</h2>
                  </div>
                  <div className="space-y-1">
                    {searchResults.users.map(user => (
                      <UserSearchResult key={user.user_id} user={user} />
                    ))}
                  </div>
                </div>
              )}

              {searchResults.videos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <VideoIcon className="w-4 h-4 text-[#C9A96E]" />
                    <h2 className="text-[14px] font-bold text-gold-metallic">Videos</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {searchResults.videos.map(video => (
                      <VideoThumbnail key={video.id} video={video} />
                    ))}
                  </div>
                </div>
              )}

              {searchResults.videos.length === 0 && searchResults.users.length === 0 && (
                <EmptyState icon={<Search className="w-10 h-10" />} text="No results found" sub="Try different keywords" />
              )}
            </div>
          )}

          {/* HASHTAGS */}
          {!loading && activeTab === 'hashtags' && (
            <div className="px-3 pt-2">
              {trendingHashtags.length > 0 ? (
                <div className="space-y-0.5">
                  {trendingHashtags.map((hashtag, i) => (
                    <HashtagItem key={hashtag.tag} hashtag={hashtag} index={i} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={<Hash className="w-10 h-10" />} text="No hashtags yet" />
              )}
            </div>
          )}

          {/* RANKING */}
          {!loading && activeTab === 'ranking' && (
            <div className="px-3 pt-3">
              {/* Banner */}
              <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 rounded-2xl mb-3 border border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-white/80" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-extrabold text-gold-metallic">Weekly Ranking</h2>
                    <p className="text-[11px] text-white/40">Top creators by coins this week</p>
                  </div>
                </div>
              </div>

              {rankings.length > 0 ? (
                <div className="space-y-1.5">
                  {rankings.map((creator) => (
                    <button 
                      key={creator.user_id}
                      onClick={() => navigate(`/profile/${creator.user_id}`)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition text-left ${
                        creator.rank <= 3
                          ? 'bg-white/5'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Rank */}
                      <div className={`w-7 text-center font-extrabold text-[14px] shrink-0 ${
                        creator.rank === 1 ? 'text-white' :
                        creator.rank === 2 ? 'text-white' :
                        creator.rank === 3 ? 'text-white' :
                        'text-white/25'
                      }`}>
                        {creator.rank}
                      </div>
                      
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <AvatarRing 
                          src={creator.avatar_url || `https://ui-avatars.com/api/?name=${creator.username}&background=222&color=C9A96E`} 
                          alt={creator.username}
                          size={40}
                        />
                        {creator.rank === 1 && (
                          <div className="absolute -top-1.5 -right-1 text-sm">👑</div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[13px] truncate text-white">
                          {creator.display_name || creator.username}
                        </h3>
                        <p className="text-[11px] text-white/35 truncate">@{creator.username}</p>
                      </div>

                      {/* Diamonds */}
                      <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg shrink-0">
                        <span className="text-[11px]">🪙</span>
                        <span className="font-bold text-[12px] text-white/80">{formatNumber(creator.total_coins)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<Trophy className="w-10 h-10" />} text="No rankings yet this week" sub="Be the first to earn diamonds!" />
              )}
            </div>
          )}

          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}

/** One full-width portrait slide at a time (snap scroll), not a narrow stack of small tiles. */
function DiscoverSnapStack({ videos }: { videos: Video[] }) {
  if (videos.length === 0) return null;
  const slideH = 'min(72dvh,calc(100vw*16/9))';
  return (
    <div
      className="w-full max-h-[min(78dvh,calc(100dvh-10.5rem))] overflow-y-auto snap-y snap-mandatory flex flex-col gap-2 pb-1 no-scrollbar"
      style={{ overscrollBehavior: 'contain' }}
    >
      {videos.map((video) => (
        <div
          key={video.id}
          className="snap-start shrink-0 w-full rounded-xl overflow-hidden"
          style={{ height: slideH, maxHeight: '78dvh' }}
        >
          <VideoThumbnail video={video} variant="feed" />
        </div>
      ))}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border ${
        active
          ? 'bg-[#C9A96E]/15 text-[#C9A96E] border-[#C9A96E]/30'
          : 'text-white/40 hover:text-white/60 border-transparent'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function VideoThumbnail({ video, variant = 'grid' }: { video: Video; variant?: 'grid' | 'feed' }) {
  const navigate = useNavigate();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || !video.url) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoRef.current?.play().catch(() => {});
        } else {
          if (videoRef.current) { videoRef.current.pause(); }
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [video.url]);

  const feed = variant === 'feed';

  return (
    <div
      ref={containerRef}
      className={`relative bg-[#1C1E24] overflow-hidden w-full border border-white/10 ${
        feed ? 'h-full min-h-0 rounded-none border-0' : 'aspect-[9/16] rounded-xl'
      }`}
    >
      <div className="absolute inset-0 cursor-pointer" onClick={() => navigate(`/video/${video.id}`)}>
        {video.url ? (
          <video
            ref={videoRef}
            src={video.url}
            poster={video.thumbnail_url || getVideoPosterUrl(video.url) || undefined}
            muted
            loop
            playsInline
            preload="metadata"
            className="video-media-fill absolute inset-0 size-full"
          />
        ) : (
          <img
            src={video.thumbnail_url || getVideoPosterUrl(video.url) || `https://ui-avatars.com/api/?name=Video&background=1C1E24&color=C9A96E&size=200`}
            alt="Video"
            className="absolute inset-0 size-full object-cover"
          />
        )}
      </div>

      {/* 3 Dots Menu — top right */}
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/video/${video.id}`); }}
        className="absolute top-1.5 right-1.5 z-10"
        title="More"
      >
        <img src="/Icons/3 Dots Buton.png" alt="More" className="w-6 h-6 object-contain drop-shadow-lg" />
      </button>

      {/* Action icons — right side */}
      <div className="absolute right-1 bottom-10 flex flex-col items-center gap-2 z-10">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/video/${video.id}`); }} title="Like">
          <img src="/Icons/Like Icon.png" alt="Like" className="w-7 h-7 object-contain drop-shadow-lg" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); navigate(`/video/${video.id}`); }} title="Comment">
          <img src="/Icons/Coment Icon.png" alt="Comment" className="w-7 h-7 object-contain drop-shadow-lg" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); navigate(`/video/${video.id}`); }} title="Save">
          <img src="/Icons/Save Icon.png" alt="Save" className="w-7 h-7 object-contain drop-shadow-lg" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); navigate(`/video/${video.id}`); }} title="Share">
          <img src="/Icons/Share Icon.png" alt="Share" className="w-7 h-7 object-contain drop-shadow-lg" />
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
      <div className="absolute bottom-2 left-2 right-10">
        {video.creator?.username && (
          <div className="flex items-center gap-1.5 mb-1">
            {video.creator.avatar_url && (
              <img src={video.creator.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
            )}
            <span className="text-white text-[10px] font-bold drop-shadow-md">@{video.creator.username}</span>
          </div>
        )}
        {video.description && (
          <p className="text-white/80 text-[9px] line-clamp-2 drop-shadow-md">{video.description}</p>
        )}
      </div>
    </div>
  );
}

function UserSearchResult({ user }: { user: User }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/profile/${user.user_id}`)}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition text-left"
    >
      <img
        src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=222&color=C9A96E`}
        alt={user.username}
        className="w-11 h-11 object-cover rounded-full"
      />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[13px] truncate">{user.username}</p>
        <p className="text-[11px] text-white/40">{formatNumber(user.followers_count || 0)} followers</p>
      </div>
      <span className="px-3.5 py-1.5 bg-[#C9A96E] text-black rounded-lg font-bold text-[11px]">
        Follow
      </span>
    </button>
  );
}

function HashtagItem({ hashtag, index }: { hashtag: Hashtag; index: number }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => { trackEvent('hashtag_click', { hashtag: hashtag.tag }); navigate(`/hashtag/${hashtag.tag}`); }}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition text-left"
    >
      <div className="w-9 h-9 bg-[#C9A96E]/10 rounded-xl flex items-center justify-center shrink-0">
        <Hash className="w-4 h-4 text-[#C9A96E]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[13px] truncate">#{hashtag.tag}</p>
        <p className="text-[11px] text-white/35">{formatNumber(hashtag.use_count)} videos</p>
      </div>
      <div className="flex items-center gap-1 text-white">
        <TrendingUp className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold">#{index + 1}</span>
      </div>
    </button>
  );
}

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="text-white/10">{icon}</div>
      <p className="text-white/30 text-[13px] font-medium">{text}</p>
      {sub && <p className="text-white/20 text-[11px]">{sub}</p>}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
    </svg>
  );
}
