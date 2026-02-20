import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, TrendingUp, Hash, Users, Video as VideoIcon, Trophy, Music, Flame, Sparkles, Star, Zap } from 'lucide-react';
import { trackEvent } from '../lib/analytics';

interface Video {
  id: string;
  user_id: string;
  thumbnail_url: string;
  video_url: string;
  description: string;
  views_count: number;
  likes_count: number;
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
  trending_score: number;
}

interface CreatorRanking {
  rank: number;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_diamonds: number;
}

export default function Discover() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'trending' | 'search' | 'hashtags' | 'ranking'>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [searchResults, setSearchResults] = useState<{ videos: Video[]; users: User[] }>({
    videos: [],
    users: [],
  });
  const [trendingHashtags, setTrendingHashtags] = useState<Hashtag[]>([]);
  const [rankings, setRankings] = useState<CreatorRanking[]>([]);
  const [loading, setLoading] = useState(false);

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

  const loadTrending = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*, creator:profiles!user_id(username, avatar_url), trending:trending_scores(score)')
        .order('trending.score', { ascending: false })
        .limit(30);

      if (error) throw error;
      setTrendingVideos(data || []);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const loadHashtags = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hashtags')
        .select('*')
        .order('trending_score', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTrendingHashtags(data || []);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const loadRanking = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_weekly_creator_ranking', { p_limit: 99 });

      if (error) throw error;
      setRankings(data || []);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const performSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) return;

    setLoading(true);
    trackEvent('search_query', { query: searchQuery });

    try {
      const [videosRes, usersRes] = await Promise.all([
        supabase
          .from('videos')
          .select('*, creator:profiles!user_id(username, avatar_url)')
          .ilike('description', `%${searchQuery}%`)
          .limit(20),
        supabase
          .from('profiles')
          .select('user_id, username, avatar_url, followers_count')
          .ilike('username', `%${searchQuery}%`)
          .limit(20),
      ]);

      setSearchResults({
        videos: videosRes.data || [],
        users: usersRes.data || [],
      });
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#13151A] text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] rounded-3xl overflow-hidden bg-[#13151A] flex flex-col pt-[calc(var(--safe-top)+14mm)] pb-[calc(var(--safe-bottom)+18mm)]">

        {/* ═══ HEADER ═══ */}
        <div className="shrink-0 px-4 pt-3 pb-2 bg-[#13151A] relative">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate('/feed')} className="p-1.5 rounded-full hover:bg-white/5 transition" title="Back">
              <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
            </button>
            <h1 className="text-[18px] font-extrabold tracking-tight flex-1">Discover</h1>
            <button onClick={() => document.getElementById('discover-search')?.focus()} className="p-1.5 rounded-full hover:bg-white/5 transition" title="Search">
              <Search className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2.5 bg-white/8 rounded-xl px-3.5 py-2.5">
            <Search className="w-4 h-4 text-white/40 shrink-0" />
            <input
              id="discover-search"
              type="text"
              placeholder="Search videos, users, hashtags..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (e.target.value.length >= 2) setActiveTab('search');
              }}
              className="flex-1 bg-transparent outline-none text-[13px] text-white placeholder-white/40/30"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-0.5 rounded-full bg-white/10" title="Clear">
                <span className="text-white/50 text-xs leading-none px-1">✕</span>
              </button>
            )}
          </div>

          {/* Tabs */}
          {searchQuery.length < 2 && (
            <div className="flex gap-1.5 mt-3 no-scrollbar overflow-x-auto pb-0.5">
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

        <div className="w-full h-px bg-transparent shrink-0" />

        {/* ═══ CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto">

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
              <div className="flex items-center gap-2 mb-3 px-1">
                <TrendingUp className="w-4 h-4 text-white" />
                <h2 className="text-[14px] font-bold">Trending Now</h2>
              </div>
              {trendingVideos.length > 0 ? (
                <div className="grid grid-cols-3 gap-[3px]">
                  {trendingVideos.map(video => (
                    <VideoThumbnail key={video.id} video={video} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={<TrendingUp className="w-10 h-10" />} text="No trending videos yet" />
              )}
            </div>
          )}

          {/* SEARCH RESULTS */}
          {!loading && activeTab === 'search' && (
            <div className="px-3 pt-3">
              {searchResults.users.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Users className="w-4 h-4 text-white" />
                    <h2 className="text-[14px] font-bold">Users</h2>
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
                    <VideoIcon className="w-4 h-4 text-white" />
                    <h2 className="text-[14px] font-bold">Videos</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-[3px]">
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
              <div className="bg-gradient-to-br from-[#C9A96E]/10 to-[#B8943F]/5 p-4 rounded-2xl mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#C9A96E]/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-extrabold text-white">Weekly Ranking</h2>
                    <p className="text-[11px] text-white/40">Top creators by diamonds this week</p>
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
                        <img 
                          src={creator.avatar_url || `https://ui-avatars.com/api/?name=${creator.username}&background=222&color=C9A96E`} 
                          alt={creator.username}
                          className={`w-10 h-10 rounded-full object-cover ${
                            creator.rank === 1 ? 'ring-2 ring-[#C9A96E]/40' :
                            creator.rank === 2 ? 'ring-2 ring-gray-300/30' :
                            creator.rank === 3 ? 'ring-2 ring-[#C9A96E]/30' :
                            ''
                          }`}
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
                        <span className="text-[11px]">💎</span>
                        <span className="font-bold text-[12px] text-white/80">{formatNumber(creator.total_diamonds)}</span>
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

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
        active
          ? 'bg-[#C9A96E]/15 text-white'
          : 'text-white/40 hover:text-white/60'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function VideoThumbnail({ video }: { video: Video }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(`/video/${video.id}`)} className="relative aspect-[3/4] bg-[#1C1E24] rounded-lg overflow-hidden w-full group">
      <img
        src={video.thumbnail_url || '/placeholder-video.png'}
        alt="Video"
        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition"
      />
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-white text-[11px] font-bold drop-shadow-md">
        <HeartIcon className="w-3 h-3" />
        {formatNumber(video.views_count)}
      </div>
    </button>
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
        <Hash className="w-4 h-4 text-white" />
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
