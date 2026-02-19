import React, { useEffect, useState } from 'react';
import { Heart, MessageCircle, Search, Share2, Plus } from 'lucide-react';
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
  { id: 'demo-5', username: 'vadva', name: 'VÄƒduva', avatar_url: 'https://ui-avatars.com/api/?name=Vaduva&background=121212&color=E6B36A' },
];

export default function FriendsFeed() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);

  // Fetch suggested users from Supabase
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data: usersData, error } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_url')
          .neq('user_id', user?.id || '')
          .limit(50);

        if (error) throw error;
        
        if (usersData) {
          setSuggestedUsers(usersData.map((p: any) => ({
            id: p.user_id,
            username: p.username || 'user',
            name: p.display_name || p.username || 'User',
            avatar_url: p.avatar_url,
          })));
        }
      } catch (err) {
        console.error("Error fetching friends:", err);
      }
    };
    fetchUsers();
  }, [user?.id]);

  const displayedUsers = suggestedUsers.length > 0 ? suggestedUsers : (import.meta.env.DEV ? DEMO_SUGGESTED_USERS : []);

  return (
    <div className="min-h-[100dvh] bg-black text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] rounded-3xl overflow-hidden bg-[#121212] pt-[var(--safe-top)] pb-[calc(var(--safe-bottom)+12mm)] overflow-y-auto">
        <div className="p-4 flex items-center justify-between relative">
          <button onClick={() => navigate(-1)} className="p-1 z-10" title="Back">
             <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
          </button>
          
          <h1 className="text-lg font-bold absolute left-1/2 transform -translate-x-1/2">Friends</h1>

          <div className="flex items-center gap-4 z-10">
             <button onClick={() => navigate('/search')} aria-label="Search"><Search size={24} /></button>
             <button className="w-8 h-8 rounded-full flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                     <Plus size={16} className="text-white stroke-[4px]" />
                  </div>
             </button>
          </div>
        </div>

        {/* Circles Section (Like Inbox) */}
        <div className="px-4 pb-4">
          <div className="flex gap-4 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => navigate('/create')}
              className="flex-shrink-0 w-[72px] flex flex-col items-center gap-2"
            >
              <div className="relative w-16 h-16 rounded-full bg-black">
                <div className="absolute inset-0 rounded-full ring-2 ring-[#00f2ea]" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#00f2ea] flex items-center justify-center text-black font-bold leading-none">+</div>
                <img
                  src="https://ui-avatars.com/api/?name=Create&background=121212&color=00f2ea"
                  alt="Create"
                  className="w-full h-full rounded-full object-cover"
                  draggable={false}
                />
              </div>
              <div className="text-xs text-white/80 truncate w-full text-center">Create</div>
            </button>
            
            {displayedUsers.slice(0, 10).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  if (u.id.startsWith('demo-')) return;
                  navigate(`/profile/${u.id}`);
                }}
                className="flex-shrink-0 w-[72px] flex flex-col items-center gap-2"
              >
                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[#00f2ea] to-[#00f2ea]">
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

        <div className="px-2 pb-6">
          <div className="w-full rounded-3xl overflow-hidden bg-black relative aspect-[9/16]">
            {import.meta.env.DEV ? (
              <video
                src="/gifts/romantic_jet.mp4"
                className="absolute inset-0 w-full h-full object-cover"
                muted
                playsInline
                loop
                autoPlay
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">
                No friends videos yet
              </div>
            )}

            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.55) 100%)' }} />

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
      </div>
    </div>
  );
}