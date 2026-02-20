import React, { useEffect, useState } from 'react';
import { Heart, MessageCircle, Search, Share2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { AvatarRing } from '../components/AvatarRing';

interface SuggestedUser {
  id: string;
  username: string;
  name: string;
  avatar_url?: string;
}


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

      }
    };
    fetchUsers();
  }, [user?.id]);

  const displayedUsers = suggestedUsers;

  return (
    <div className="bg-[#13151A] text-white flex justify-center px-2">
      <div className="w-full max-w-[480px]">
        <div className="px-3 py-2 flex items-center justify-between relative">
          <button onClick={() => navigate(-1)} className="p-1 z-10" title="Back">
             <img src="/Icons/Gold power buton.png" alt="Back" className="w-4 h-4" />
          </button>
          
          <h1 className="text-sm font-bold absolute left-1/2 transform -translate-x-1/2">Friends</h1>

          <div className="flex items-center gap-3 z-10">
             <button onClick={() => navigate('/search')} aria-label="Search"><Search size={18} /></button>
             <button onClick={() => navigate('/search')} title="Add friends" className="w-6 h-6 rounded-full flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
                     <Plus size={12} className="text-white stroke-[4px]" />
                  </div>
             </button>
          </div>
        </div>

        <div className="px-3 pb-2">
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => navigate('/create')}
              className="flex-shrink-0 w-[52px] flex flex-col items-center gap-1"
            >
              <div className="relative w-11 h-11 rounded-full bg-[#13151A]">
                <div className="absolute inset-0 rounded-full ring-2 ring-[#C9A96E]" />
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#C9A96E] flex items-center justify-center text-black text-[10px] font-bold leading-none">+</div>
                <img
                  src="https://ui-avatars.com/api/?name=Create&background=121212&color=C9A96E"
                  alt="Create"
                  className="w-full h-full rounded-full object-cover"
                  draggable={false}
                />
              </div>
              <div className="text-[10px] text-white/80 truncate w-full text-center">Create</div>
            </button>
            
            {displayedUsers.slice(0, 10).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => navigate(`/profile/${u.id}`)}
                className="flex-shrink-0 w-[52px] flex flex-col items-center gap-1"
              >
                <AvatarRing src={u.avatar_url || ''} alt={u.username} size={44} />
                <div className="text-[10px] text-white/80 truncate w-full text-center">{u.username}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 pb-2">
          <div className="w-full rounded-xl overflow-hidden bg-[#1C1E24] relative" style={{height:'1.5cm'}}>
            <div className="absolute inset-0 flex items-center justify-center text-white/50 text-xs">
              No friends videos yet
            </div>

            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-auto">
              <button type="button" onClick={() => navigate('/discover')} title="Discover" className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <Heart className="w-3 h-3 text-white" />
              </button>
              <button type="button" onClick={() => navigate('/inbox')} title="Messages" className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <MessageCircle className="w-3 h-3 text-white" />
              </button>
              <button type="button" onClick={() => { if (navigator.share) navigator.share({ title: 'Elix', url: window.location.href }); }} title="Share" className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <Share2 className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}