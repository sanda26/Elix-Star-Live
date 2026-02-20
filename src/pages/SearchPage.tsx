import React, { useEffect, useState, useRef } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AvatarRing } from '../components/AvatarRing';

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
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const closePanel = () => {
    setVisible(false);
    setTimeout(() => navigate(-1), 250);
  };

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
    <div className="fixed inset-0 z-[99999] flex justify-center">
      {/* Backdrop — tap to close */}
      <div
        className="absolute inset-0 transition-opacity duration-250"
        style={{ backgroundColor: visible ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)' }}
        onClick={closePanel}
      />

      {/* Panel slides up from bottom */}
      <div
        ref={panelRef}
        className="absolute bottom-0 left-0 right-0 flex justify-center transition-transform duration-250 ease-out"
        style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="w-full max-w-[480px] bg-[#13151A] rounded-t-3xl border-2 border-[#C9A96E] max-h-[40dvh] flex flex-col overflow-hidden mb-[90px]" style={{ boxShadow: '0 -8px 30px rgba(0,0,0,0.5), 0 0 15px rgba(212,175,55,0.3)' }}>
          
          {/* Top drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-[#C9A96E]/30" />
          </div>

          {/* Search bar */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2">
              <form onSubmit={handleSearch} className="flex-1 relative">
                <input 
                  type="text" 
                  placeholder="Search" 
                  className="w-full bg-[#1C1E24] text-gold-metallic placeholder-[#C9A96E]/40 rounded-full py-2 pl-9 pr-9 text-sm focus:outline-none border-2 border-[#C9A96E] focus:border-[#C9A96E]"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
                <SearchIcon size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C9A96E]" />
                {query && (
                  <button 
                    type="button" 
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C9A96E]/60"
                  >
                    <X size={10} />
                  </button>
                )}
              </form>
              <button className="text-gold-metallic font-semibold text-xs" onClick={closePanel}>Cancel</button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {!normalizedQuery ? (
              <>
                <h2 className="font-bold mb-3 text-gold-metallic text-sm">You may like</h2>
                <div className="flex flex-wrap gap-2">
                  {TRENDING_SEARCHES.map((tag) => (
                    <button 
                      key={tag}
                      onClick={() => {
                        const params = new URLSearchParams(location.search);
                        params.set('q', tag);
                        navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
                      }}
                      className="bg-[#1C1E24] px-3 py-1.5 rounded-full text-xs border border-[#C9A96E]/30 text-gold-metallic hover:border-[#C9A96E] transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {searching && <div className="text-xs text-[#C9A96E]/60 text-center py-3">Searching...</div>}

                {matchedUsers.length > 0 && (
                  <div>
                    <h2 className="font-bold mb-2 text-gold-metallic text-sm">Users</h2>
                    <div className="space-y-1">
                      {matchedUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => navigate(`/profile/${u.id}`)}
                          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition"
                        >
                          <AvatarRing src={u.avatar} alt={u.username} size={32} />
                          <div className="text-left">
                            <div className="text-xs font-semibold text-gold-metallic">@{u.username}</div>
                            <div className="text-[10px] text-white/50">{u.name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="font-bold mb-2 text-gold-metallic text-sm">Videos</h2>
                  {!searching && matchedVideos.length === 0 ? (
                    <div className="text-xs text-white/40">No videos found.</div>
                  ) : (
                    <div className="space-y-2">
                      {matchedVideos.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => navigate(`/video/${v.id}`)}
                          className="w-full flex gap-3 p-2 rounded-xl hover:bg-white/5 transition"
                        >
                          <img
                            src={v.thumbnail || ''}
                            alt={v.description}
                            className="w-16 h-22 rounded-lg object-cover bg-[#1C1E24] border border-[#C9A96E]/20"
                          />
                          <div className="text-left flex-1">
                            <div className="text-xs font-semibold line-clamp-2">{v.description}</div>
                            <div className="text-[10px] text-[#C9A96E] mt-1">@{v.username}</div>
                            <div className="text-[10px] text-white/40 mt-1 line-clamp-1">
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
    </div>
  );
}
