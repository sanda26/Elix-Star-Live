import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, TrendingUp, Hash, Users, Video as VideoIcon, Trophy } from 'lucide-react';
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
      console.error('Failed to load trending:', error);
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
      console.error('Failed to load hashtags:', error);
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
      console.error('Failed to load ranking:', error);
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
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-black z-10 px-4 py-4 border-b border-transparent">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/feed')} className="p-1 hover:brightness-125 transition" title="Back to For You">
            <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Discover</h1>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-3 rounded-full px-4 py-3">
          <Search className="w-5 h-5 text-white/60" />
          <input
            type="text"
            placeholder="Search videos, users, hashtags..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              if (e.target.value.length >= 2) {
                setActiveTab('search');
              }
            }}
            className="flex-1 bg-transparent outline-none text-white placeholder-white/40"
          />
        </div>

        {/* Tabs */}
        {searchQuery.length < 2 && (
          <div className="flex gap-4 mt-4 overflow-x-auto pb-2 scrollbar-hide">
            <TabButton
              active={activeTab === 'trending'}
              onClick={() => setActiveTab('trending')}
              icon={<TrendingUp className="w-5 h-5" />}
              label="Trending"
            />
            <TabButton
              active={activeTab === 'ranking'}
              onClick={() => setActiveTab('ranking')}
              icon={<Trophy className="w-5 h-5" />}
              label="Weekly Top 99"
            />
            <TabButton
              active={activeTab === 'hashtags'}
              onClick={() => setActiveTab('hashtags')}
              icon={<Hash className="w-5 h-5" />}
              label="Hashtags"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {activeTab === 'trending' && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-[#00f2ea]" />
              <h2 className="text-lg font-bold">Trending Now</h2>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {trendingVideos.map(video => (
                <VideoThumbnail key={video.id} video={video} />
              ))}
              {trendingVideos.length === 0 && !loading && (
                <div className="col-span-3 text-center py-12 text-white/40">No trending videos</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div>
            {/* Users */}
            {searchResults.users.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Users
                </h2>
                <div className="space-y-2">
                  {searchResults.users.map(user => (
                    <UserSearchResult key={user.user_id} user={user} />
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {searchResults.videos.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <VideoIcon className="w-5 h-5" />
                  Videos
                </h2>
                <div className="grid grid-cols-3 gap-1">
                  {searchResults.videos.map(video => (
                    <VideoThumbnail key={video.id} video={video} />
                  ))}
                </div>
              </div>
            )}

            {searchResults.videos.length === 0 && searchResults.users.length === 0 && !loading && (
              <div className="text-center py-12 text-white/40">No results found</div>
            )}
          </div>
        )}

        {activeTab === 'hashtags' && (
          <div className="space-y-2">
            {trendingHashtags.map(hashtag => (
              <HashtagItem key={hashtag.tag} hashtag={hashtag} />
            ))}
            {trendingHashtags.length === 0 && !loading && (
              <div className="text-center py-12 text-white/40">No hashtags found</div>
            )}
          </div>
        )}

        {activeTab === 'ranking' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-[#E6B36A]/20 to-[#B8935C]/20 p-4 rounded-xl border border-[#E6B36A]/30 mb-6">
              <h2 className="text-xl font-bold text-[#E6B36A] flex items-center gap-2 mb-1">
                <Trophy className="w-6 h-6" />
                Weekly Creator Ranking
              </h2>
              <p className="text-sm text-white/60">Top 99 creators based on diamonds earned this week</p>
            </div>

            <div className="space-y-2">
              {rankings.map((creator) => (
                <div 
                  key={creator.user_id}
                  onClick={() => navigate(`/profile/${creator.user_id}`)}
                  className={`flex items-center gap-4 p-3 rounded-xl transition cursor-pointer ${
                    creator.rank === 1 ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30' :
                    creator.rank === 2 ? 'bg-gradient-to-r from-gray-300/20 to-gray-400/10 border border-gray-400/30' :
                    creator.rank === 3 ? 'bg-gradient-to-r from-orange-700/20 to-orange-800/10 border border-orange-700/30' :
                    'bg-gray-900/50 hover:bg-gray-800'
                  }`}
                >
                  <div className={`w-8 text-center font-bold text-lg ${
                    creator.rank === 1 ? 'text-yellow-400 text-2xl' :
                    creator.rank === 2 ? 'text-gray-300 text-xl' :
                    creator.rank === 3 ? 'text-orange-400 text-xl' :
                    'text-white/40'
                  }`}>
                    {creator.rank}
                  </div>
                  
                  <div className="relative">
                    <img 
                      src={creator.avatar_url || `https://ui-avatars.com/api/?name=${creator.username}`} 
                      alt={creator.username}
                      className={`w-12 h-12 rounded-full object-cover ${
                        creator.rank <= 3 ? 'border-2' : ''
                      } ${
                        creator.rank === 1 ? 'border-yellow-400' :
                        creator.rank === 2 ? 'border-gray-300' :
                        creator.rank === 3 ? 'border-orange-400' :
                        ''
                      }`}
                    />
                    {creator.rank === 1 && (
                      <div className="absolute -top-2 -right-1 text-xl">👑</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate text-white">
                      {creator.display_name || creator.username}
                    </h3>
                    <p className="text-xs text-white/50 truncate">@{creator.username}</p>
                  </div>

                  <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full">
                    <span className="text-blue-400 text-xs">💎</span>
                    <span className="font-bold text-sm">{formatNumber(creator.total_diamonds)}</span>
                  </div>
                </div>
              ))}
              
              {rankings.length === 0 && !loading && (
                <div className="text-center py-12 text-white/40 flex flex-col items-center">
                  <Trophy className="w-12 h-12 mb-4 opacity-20" />
                  <p>No rankings yet this week</p>
                  <p className="text-sm mt-2">Be the first to earn diamonds!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-12 text-white/40">Loading...</div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
        active ? 'bg-[#E6B36A] text-black' : 'bg-transparent text-white'
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
    <button onClick={() => navigate(`/video/${video.id}`)} className="relative aspect-[9/16] bg-gray-800 rounded overflow-hidden w-full">
      <img
        src={video.thumbnail_url || '/placeholder-video.png'}
        alt="Video"
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs">
        <Heart className="w-3 h-3" />
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
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:brightness-125 transition text-left"
    >
      <img
        src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`}
        alt={user.username}
        className="w-12 h-12 object-cover rounded-full"
      />
      <div className="flex-1">
        <p className="font-semibold">{user.username}</p>
        <p className="text-sm text-white/60">{formatNumber(user.followers_count || 0)} followers</p>
      </div>
      <span className="px-4 py-2 bg-[#E6B36A] text-black rounded-full font-semibold text-sm">
        Follow
      </span>
    </button>
  );
}

function HashtagItem({ hashtag }: { hashtag: Hashtag }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => { trackEvent('hashtag_click', { hashtag: hashtag.tag }); navigate(`/hashtag/${hashtag.tag}`); }}
      className="w-full flex items-center justify-between p-4 rounded-lg hover:brightness-125 transition text-left"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-[#E6B36A] to-[#B8935C] rounded-full flex items-center justify-center">
          <Hash className="w-5 h-5 text-black" />
        </div>
        <div>
          <p className="font-semibold">#{hashtag.tag}</p>
          <p className="text-sm text-white/60">{formatNumber(hashtag.use_count)} videos</p>
        </div>
      </div>
      <TrendingUp className="w-5 h-5 text-[#E6B36A]" />
    </button>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

function Heart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
    </svg>
  );
}
