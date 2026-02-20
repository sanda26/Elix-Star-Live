import React, { useEffect, useState } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const TRENDING_SEARCHES = [
  'Dance challenge',
  'Funny cats',
  'Cooking hacks',
  'Travel vlog',
  'Gaming highlights',
  'Fitness tips'
];

export default function SearchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [matchedUsers, setMatchedUsers] = useState<{ id: string; username: string; name: string; avatar: string }[]>([]);
  const [matchedVideos, setMatchedVideos] = useState<{ id: string; description: string; thumbnail: string; username: string; hashtags: string[] }[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const next = query.trim();
    const params = new URLSearchParams(location.search);
    if (next) {
      params.set('q', next);
    } else {
      params.delete('q');
    }
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q') ?? '';
    setQuery(q);
  }, [location.search]);

  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    if (!normalizedQuery) {
      setMatchedUsers([]);
      setMatchedVideos([]);
      return;
    }

    let cancelled = false;
    setSearching(true);

    (async () => {
      try {
        const [usersRes, videosRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_url')
            .or(`username.ilike.%${normalizedQuery}%,display_name.ilike.%${normalizedQuery}%`)
            .limit(20),
          supabase
            .from('videos')
            .select('id, description, thumbnail_url, user_id, hashtags')
            .eq('is_public', true)
            .or(`description.ilike.%${normalizedQuery}%`)
            .order('created_at', { ascending: false })
            .limit(30),
        ]);

        if (cancelled) return;

        if (usersRes.data) {
          setMatchedUsers(usersRes.data.map((p: any) => ({
            id: p.user_id,
            username: p.username || 'user',
            name: p.display_name || p.username || '',
            avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.username || 'U')}&background=121212&color=C9A96E`,
          })));
        }

        if (videosRes.data) {
          const userIds = [...new Set(videosRes.data.map((v: any) => v.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username')
            .in('user_id', userIds);
          const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.username || 'user']));

          if (!cancelled) {
            setMatchedVideos(videosRes.data.map((v: any) => ({
              id: v.id,
              description: v.description || '',
              thumbnail: v.thumbnail_url || '',
              username: profileMap.get(v.user_id) || 'user',
              hashtags: v.hashtags || [],
            })));
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setSearching(false);
    })();

    return () => { cancelled = true; };
  }, [normalizedQuery]);

  return (
    <div className="min-h-[100dvh] bg-[#13151A] text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] rounded-3xl overflow-hidden bg-[#13151A] flex flex-col pt-[calc(var(--safe-top)+14mm)] pb-[calc(var(--safe-bottom)+18mm)] overflow-y-auto">
      {/* Content */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => navigate('/feed')} className="p-1">
            <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
          </button>
          <form onSubmit={handleSearch} className="flex-1 relative">
            <input 
              type="text" 
              placeholder="Search" 
              className="w-full bg-[#1C1E24] text-white rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:bg-[#2A2D35]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
            {query && (
              <button 
                type="button" 
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60"
              >
                <X size={14} />
              </button>
            )}
          </form>
          <button className="text-white font-semibold text-sm" onClick={handleSearch}>Search</button>
        </div>
        {!normalizedQuery ? (
          <>
            <h2 className="font-bold mb-4">You may like</h2>
            <div className="flex flex-wrap gap-2">
              {TRENDING_SEARCHES.map((tag) => (
                <button 
                  key={tag}
                  onClick={() => {
                    const params = new URLSearchParams(location.search);
                    params.set('q', tag);
                    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
                  }}
                  className="bg-[#1C1E24] px-3 py-1.5 rounded-full text-sm hover:bg-[#2A2D35] transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            {searching && <div className="text-sm text-white/40 text-center py-4">Searching...</div>}

            {matchedUsers.length > 0 && (
              <div>
                <h2 className="font-bold mb-3">Users</h2>
                <div className="space-y-2">
                  {matchedUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => navigate(`/profile/${u.id}`)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition"
                    >
                      <img src={u.avatar} alt={u.username} className="w-10 h-10 rounded-full object-cover bg-[#1C1E24]" />
                      <div className="text-left">
                        <div className="text-sm font-semibold">@{u.username}</div>
                        <div className="text-xs text-white/60">{u.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="font-bold mb-3">Videos</h2>
              {!searching && matchedVideos.length === 0 ? (
                <div className="text-sm text-white/60">No videos found.</div>
              ) : (
                <div className="space-y-2">
                  {matchedVideos.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => navigate(`/video/${v.id}`)}
                      className="w-full flex gap-3 p-2 rounded-lg hover:bg-white/5 transition"
                    >
                      <img
                        src={v.thumbnail || ''}
                        alt={v.description}
                        className="w-20 h-28 rounded-md object-cover bg-[#13151A]"
                      />
                      <div className="text-left flex-1">
                        <div className="text-sm font-semibold line-clamp-2">{v.description}</div>
                        <div className="text-xs text-white/60 mt-1">@{v.username}</div>
                        <div className="text-xs text-white/40 mt-2 line-clamp-1">
                          {v.hashtags.map((h: string) => `#${h}`).join(' ')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
