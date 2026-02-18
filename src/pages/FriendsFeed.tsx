import React, { useEffect, useMemo, useState } from 'react';
import { Heart, MessageCircle, Search, Share2, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

interface SuggestedUser {
  id: string;
  username: string;
  name: string;
  avatar_url?: string;
}

const DEMO_SUGGESTED_USERS: SuggestedUser[] = [
  { id: 'demo-1', username: 'sandraa', name: 'Sandra', avatar_url: 'https://ui-avatars.com/api/?name=Sandra&background=121212&color=E6B36A' },
  { id: 'demo-2', username: 'haiduco', name: 'Haiducu', avatar_url: 'https://ui-avatars.com/api/?name=Haiducu&background=121212&color=E6B36A' },
  { id: 'demo-3', username: 'raluca', name: 'Raluca', avatar_url: 'https://ui-avatars.com/api/?name=Raluca&background=121212&color=E6B36A' },
  { id: 'demo-4', username: 'albertgashi', name: 'Albert', avatar_url: 'https://ui-avatars.com/api/?name=Albert&background=121212&color=E6B36A' },
  { id: 'demo-5', username: 'vadva', name: 'Văduva', avatar_url: 'https://ui-avatars.com/api/?name=Vaduva&background=121212&color=E6B36A' },
];

export default function FriendsFeed() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch suggested users from Supabase
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        // 1. Fetch potential friends
        const { data: usersData, error } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_url')
          .neq('user_id', user?.id || '')
          .limit(50);

        if (error) throw error;
        
        // 2. Check who we are already following
        let followingMap: Record<string, boolean> = {};
        if (user?.id && usersData && usersData.length > 0) {
            const targetIds = usersData.map((u: any) => u.user_id);
            const { data: followData } = await supabase
                .from('followers')
                .select('following_id')
                .eq('follower_id', user.id)
                .in('following_id', targetIds);
            
            if (followData) {
                followData.forEach((f: any) => {
                    followingMap[f.following_id] = true;
                });
            }
        }
        setFollowing(followingMap);

        if (usersData) {
          setSuggestedUsers(usersData.map((p: { user_id: string; username?: string; display_name?: string; avatar_url?: string }) => ({
            id: p.user_id,
            username: p.username || 'user',
            name: p.display_name || p.username || 'User',
            avatar_url: p.avatar_url,
          })));
        }
      } catch (err) {
        console.error("Error fetching friends:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [user?.id]);

  const handleToggleFollow = async (targetUserId: string) => {
      if (targetUserId.startsWith('demo-')) return;
      if (!user?.id) return;
      const isCurrentlyFollowing = !!following[targetUserId];

      // Optimistic update
      setFollowing(prev => ({ ...prev, [targetUserId]: !isCurrentlyFollowing }));

      try {
          if (isCurrentlyFollowing) {
              // Unfollow
              await supabase
                  .from('followers')
                  .delete()
                  .eq('follower_id', user.id)
                  .eq('following_id', targetUserId);
          } else {
              // Follow
              await supabase
                  .from('followers')
                  .insert({ follower_id: user.id, following_id: targetUserId });
              
              // Insert notification manually to ensure Inbox visibility
              try {
                const { data: currentUser } = await supabase.auth.getUser();
                const username = currentUser.user?.user_metadata?.username || 'Someone';
                
                await supabase.from('notifications').insert({
                    user_id: targetUserId,
                    type: 'follow',
                    actor_id: user.id,
                    title: 'New Follower',
                    body: `${username} started following you`,
                    is_read: false
                });
              } catch (err) {
                 console.error("Failed to send notification", err);
              }
          }
      } catch (error) {
          console.error("Toggle follow failed:", error);
          // Revert on error
          setFollowing(prev => ({ ...prev, [targetUserId]: isCurrentlyFollowing }));
      }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source =
      suggestedUsers.length > 0 ? suggestedUsers : import.meta.env.DEV ? DEMO_SUGGESTED_USERS : [];
    if (!q) return source;
    return source.filter(
      (u) => u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    );
  }, [query, suggestedUsers]);

  return (
    <div className="min-h-[100dvh] bg-black text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] rounded-3xl overflow-hidden bg-[#121212] pt-[var(--safe-top)] pb-[calc(var(--safe-bottom)+12mm)] overflow-y-auto">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-1" title="Back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h1 className="text-lg font-bold">Friends</h1>
          </div>
          <button onClick={() => navigate('/search')} aria-label="Search"><Search size={24} /></button>
        </div>

        {import.meta.env.DEV && (
          <div className="px-4 pb-4">
            <div className="flex gap-4 overflow-x-auto">
              <button
                type="button"
                onClick={() => navigate('/create')}
                className="flex-shrink-0 w-[72px] flex flex-col items-center gap-2"
              >
                <div className="relative w-16 h-16 rounded-full bg-black">
                  <div className="absolute inset-0 rounded-full ring-2 ring-[#00f5ff]" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#00f5ff] flex items-center justify-center text-black font-bold leading-none">
                    +
                  </div>
                  <img
                    src="https://ui-avatars.com/api/?name=Create&background=121212&color=E6B36A"
                    alt="Create"
                    className="w-full h-full rounded-full object-cover"
                    draggable={false}
                  />
                </div>
                <div className="text-xs text-white/80 truncate w-full text-center">Create</div>
              </button>
              {(suggestedUsers.length > 0 ? suggestedUsers : DEMO_SUGGESTED_USERS).slice(0, 8).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    if (u.id.startsWith('demo-')) return;
                    navigate(`/profile/${u.id}`);
                  }}
                  className="flex-shrink-0 w-[72px] flex flex-col items-center gap-2"
                >
                  <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[#00f5ff] via-[#00f5ff] to-[#E6B36A]">
                    <div className="w-full h-full rounded-full bg-[#121212] p-[2px]">
                      <img
                        src={u.avatar_url || ''}
                        alt={u.username}
                        className="w-full h-full rounded-full object-cover"
                        draggable={false}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-white/80 truncate w-full text-center">{u.username}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {import.meta.env.DEV && (
          <div className="px-2 pb-6">
            <div className="w-full rounded-3xl overflow-hidden bg-black relative aspect-[9/16]">
              <video
                src="/gifts/romantic_jet.mp4"
                className="absolute inset-0 w-full h-full object-cover"
                muted
                playsInline
                loop
                autoPlay
              />
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.55) 100%)' }} />
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1a1a1a] flex-shrink-0">
                    <img
                      src="https://ui-avatars.com/api/?name=Friends&background=121212&color=E6B36A"
                      alt="User"
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">friend_user</div>
                    <div className="text-xs text-white/70 truncate">12.3k followers</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold pointer-events-auto"
                >
                  Follow
                </button>
              </div>

              <div className="absolute bottom-4 left-4 right-16">
                <div className="text-sm font-semibold">Demo Friends Video</div>
                <div className="text-xs text-white/70 mt-1">#friends #foryou</div>
              </div>

              <div className="absolute right-3 bottom-4 flex flex-col items-center gap-4 pointer-events-auto">
                <button type="button" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" />
                </button>
                <button type="button" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </button>
                <button type="button" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="px-4">
          <div className="flex items-center gap-2 bg-transparent border border-transparent rounded-2xl px-3 py-2">
            <Search size={18} className="text-white/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              placeholder="Search friends"
              aria-label="Search friends"
            />
          </div>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-[40vh]">
              <div className="w-8 h-8 border-2 border-[#E6B36A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[55vh] text-center p-8 opacity-60">
              <UserPlus size={48} className="mb-4" />
              <h2 className="text-xl font-bold mb-2">No results</h2>
              <p>Try a different search.</p>
            </div>
          ) : (
            filtered.map((u) => {
              const isFollowing = !!following[u.id];
              return (
                <div key={u.id} className="flex items-center justify-between bg-transparent border border-transparent rounded-2xl p-3">
                  <button
                    type="button"
                    className="flex items-center gap-3 text-left"
                    onClick={() => navigate(`/profile/${u.id}`)}
                  >
                    <div className="w-11 h-11 bg-gray-700 rounded-full overflow-hidden">
                      <img
                        src={u.avatar_url || ''}
                        alt={u.username}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{u.username}</div>
                      <div className="text-xs text-white/60">{u.name}</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`px-4 py-2 rounded-xl text-xs font-bold border ${
                      isFollowing
                        ? 'bg-transparent border-transparent text-white'
                        : 'bg-[#E6B36A] border-[#E6B36A] text-black'
                    }`}
                    onClick={() => handleToggleFollow(u.id)}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
