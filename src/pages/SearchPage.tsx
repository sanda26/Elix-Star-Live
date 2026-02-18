import React, { useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useVideoStore } from '../store/useVideoStore';

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
  const videos = useVideoStore((s) => s.videos);
  const [query, setQuery] = useState('');

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

  const matchedUsers = useMemo(() => {
    if (!normalizedQuery) return [];
    const map = new Map<string, { id: string; username: string; name: string; avatar: string }>();
    for (const v of videos) {
      const u = v.user;
      const hay = `${u.username} ${u.name}`.toLowerCase();
      if (hay.includes(normalizedQuery)) {
        map.set(u.id, { id: u.id, username: u.username, name: u.name, avatar: u.avatar });
      }
    }
    return Array.from(map.values());
  }, [normalizedQuery, videos]);

  const matchedVideos = useMemo(() => {
    if (!normalizedQuery) return [];
    return videos.filter((v) => {
      const hay = `${v.description} ${v.user.username} ${v.user.name} ${v.hashtags.join(' ')}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [normalizedQuery, videos]);

  return (
    <div className="min-h-screen bg-black text-white flex justify-center">
      <div className="w-full">
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
              className="w-full bg-gray-800 text-white rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:bg-gray-700"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            {query && (
              <button 
                type="button" 
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <X size={14} />
              </button>
            )}
          </form>
          <button className="text-[#FE2C55] font-semibold text-sm" onClick={handleSearch}>Search</button>
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
                  className="bg-gray-800 px-3 py-1.5 rounded-full text-sm hover:bg-gray-700 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            {matchedUsers.length > 0 && (
              <div>
                <h2 className="font-bold mb-3">Users</h2>
                <div className="space-y-2">
                  {matchedUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => navigate(`/profile/${u.id}`)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg bg-transparent5 hover:bg-transparent10 transition"
                    >
                      <img src={u.avatar} alt={u.username} className="w-10 h-10 rounded-full" />
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
              {matchedVideos.length === 0 ? (
                <div className="text-sm text-white/60">No videos found.</div>
              ) : (
                <div className="space-y-2">
                  {matchedVideos.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => navigate(`/video/${v.id}`)}
                      className="w-full flex gap-3 p-2 rounded-lg bg-transparent5 hover:bg-transparent10 transition"
                    >
                      <img
                        src={v.thumbnail ?? 'https://picsum.photos/120/160'}
                        alt={v.description}
                        className="w-20 h-28 rounded-md object-cover bg-black"
                      />
                      <div className="text-left flex-1">
                        <div className="text-sm font-semibold line-clamp-2">{v.description}</div>
                        <div className="text-xs text-white/60 mt-1">@{v.user.username}</div>
                        <div className="text-xs text-white/40 mt-2 line-clamp-1">
                          {v.hashtags.map((h) => `#${h}`).join(' ')}
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
