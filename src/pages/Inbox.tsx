import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Heart, UserPlus, Search, Camera, ShoppingBag, Archive, MicOff, Plus } from 'lucide-react';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'gift' | 'battle_invite' | 'system' | 'shop';
  actor_id: string;
  actor?: { username: string; avatar_url: string | null };
  title: string;
  body: string | null;
  image_url: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_at: string;
  otherUser?: { username: string; avatar_url: string | null };
  lastMessage?: string;
}






export default function Inbox() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'main' | 'requests' | 'unread' | 'starred'>('main');

  const loadCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    setCurrentUserId(data.user?.id || null);
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const fetchNotifications = async () => {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (data) setNotifications(data.map((n: any) => ({
          id: n.id,
          type: n.type || 'system',
          actor_id: n.actor_id || '',
          title: n.title || 'Notification',
          body: n.body,
          image_url: n.image_url,
          action_url: n.action_url,
          is_read: n.is_read ?? n.read ?? false,
          created_at: n.created_at,
        })));
      } catch { /* ignore */ }
    };
    const fetchConversations = async () => {
      try {
        const { data } = await supabase
          .from('chat_threads')
          .select('*')
          .or(`participant_1.eq.${currentUserId},participant_2.eq.${currentUserId}`)
          .order('last_message_at', { ascending: false })
          .limit(50);
        if (data) {
          const mapped = await Promise.all(data.map(async (t: any) => {
            const otherId = t.participant_1 === currentUserId ? t.participant_2 : t.participant_1;
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('user_id', otherId)
              .single();
            return {
              id: t.id,
              participant_1: t.participant_1,
              participant_2: t.participant_2,
              last_message_at: t.last_message_at || t.created_at,
              otherUser: profile ? { username: profile.username || 'User', avatar_url: profile.avatar_url } : { username: 'User', avatar_url: null },
              lastMessage: t.last_message_preview || '',
            };
          }));
          setConversations(mapped);
        }
      } catch { /* ignore */ }
    };
    fetchNotifications();
    fetchConversations();
  }, [currentUserId]);

  return (
    <div className="min-h-[100dvh] bg-[#13151A] text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] rounded-3xl overflow-hidden bg-[#13151A] flex flex-col pt-[calc(var(--safe-top)+46px)] pb-[calc(var(--safe-bottom)+110px)]">
        
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between sticky top-0 z-10 bg-[#13151A] relative">
            <button 
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-full flex items-center justify-center -ml-2 z-10"
            >
                 <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
            </button>
            
            <button className="absolute inset-0 flex items-center justify-center gap-1 font-bold text-lg pointer-events-none">
                <span className="pointer-events-auto">Inbox</span>
                <div className="bg-[#C9A96E] rounded px-1 py-0.5 ml-1">
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
            </button>

            <div className="flex items-center gap-4 z-10">
                <button onClick={() => navigate('/search')} title="Search"><Search size={24} className="text-white" /></button>
                <button onClick={() => navigate('/search')} title="New message" className="w-8 h-8 rounded-full flex items-center justify-center">
                     <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                        <Plus size={16} className="text-white stroke-[4px]" />
                     </div>
                </button>
            </div>
        </div>

        {/* Stories/Circles */}
        <div className="px-4 py-2">
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {/* Create - Blue Circle */}
                <button onClick={() => navigate('/create')} className="flex flex-col items-center gap-1 min-w-[64px]">
                    <div className="relative w-16 h-16">
                        <div className="w-full h-full rounded-full p-[2px] bg-gradient-to-tr from-[#C9A96E] to-[#C9A96E]">
                            <div className="w-full h-full rounded-full border-2 border-[#13151A] overflow-hidden">
                                 <img src="https://ui-avatars.com/api/?name=Me&background=333&color=fff" alt="Create" className="w-full h-full object-cover opacity-80" />
                            </div>
                        </div>
                        <div className="absolute bottom-0 right-0 bg-[#C9A96E] rounded-full p-0.5 border-2 border-[#13151A] w-5 h-5 flex items-center justify-center">
                            <span className="text-white font-bold text-xs leading-none">+</span>
                        </div>
                    </div>
                    <span className="text-xs text-white font-semibold mt-1">Create</span>
                </button>

                {conversations.slice(0, 6).map(c => (
                    <button key={c.id} onClick={() => navigate(`/inbox/${c.id}`)} className="flex flex-col items-center gap-1 min-w-[64px]">
                        <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[#C9A96E] to-[#C9A96E]">
                            <div className="w-full h-full rounded-full border-2 border-[#13151A] overflow-hidden bg-[#1C1E24]">
                                <img src={c.otherUser?.avatar_url || ''} alt={c.otherUser?.username || 'User'} className="w-full h-full object-cover" />
                            </div>
                        </div>
                        <span className="text-xs text-white font-semibold mt-1 truncate w-16 text-center">{c.otherUser?.username || 'User'}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* Filters */}
        <div className="pl-[calc(1rem+22mm)] pr-4 py-2 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar mb-2">
            <button onClick={() => setActiveFilter('main')} className={`px-4 py-1.5 rounded text-white text-xs font-bold whitespace-nowrap ${activeFilter === 'main' ? 'bg-[#C9A96E]/20' : 'bg-[#2F2F2F] hover:bg-[#3F3F3F]'}`}>Main</button>
            <button onClick={() => setActiveFilter('requests')} className={`px-4 py-1.5 rounded text-white text-xs font-bold whitespace-nowrap ${activeFilter === 'requests' ? 'bg-[#C9A96E]/20' : 'bg-[#2F2F2F] hover:bg-[#3F3F3F]'}`}>Requests</button>
            <button onClick={() => setActiveFilter('unread')} className={`px-4 py-1.5 rounded text-white text-xs font-bold whitespace-nowrap ${activeFilter === 'unread' ? 'bg-[#C9A96E]/20' : 'bg-[#2F2F2F] hover:bg-[#3F3F3F]'}`}>Unread</button>
            <button onClick={() => setActiveFilter('starred')} className={`px-4 py-1.5 rounded text-white text-xs font-bold whitespace-nowrap ${activeFilter === 'starred' ? 'bg-[#C9A96E]/20' : 'bg-[#2F2F2F] hover:bg-[#3F3F3F]'}`}>Starred</button>
            <div className="ml-auto text-white">
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
            </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto px-4 py-1 space-y-4">
            
            {/* New Followers */}
            <button onClick={() => navigate('/profile')} className="flex items-center gap-3 w-full text-left">
                <div className="w-12 h-12 rounded-full bg-[#C9A96E] flex items-center justify-center">
                    <UserPlus className="w-6 h-6 text-white" fill="white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm">New followers</h3>
                    <p className="text-white/60 text-xs truncate">
                      {notifications.find(n => n.type === 'follow')?.body || 'No new followers'}
                    </p>
                </div>
            </button>

            {/* Activity */}
            <button onClick={() => navigate('/profile')} className="flex items-center gap-3 w-full text-left">
                <div className="w-12 h-12 rounded-full bg-[#C9A96E] flex items-center justify-center">
                    <Heart className="w-6 h-6 text-white" fill="white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm">Activity</h3>
                    <p className="text-white/60 text-xs truncate">
                      {notifications.find(n => n.type === 'like' || n.type === 'comment')?.body || 'No recent activity'}
                    </p>
                </div>
            </button>

            {/* Message Items (Mixed) */}
            {conversations.map((conv, i) => (
                <div key={conv.id} className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/inbox/${conv.id}`)}>
                    <div className={`w-12 h-12 rounded-full p-[2px] ${i === 0 ? 'bg-gradient-to-tr from-[#C9A96E] to-[#C9A96E]' : 'bg-transparent'}`}>
                        <div className="w-full h-full rounded-full border-2 border-[#13151A] overflow-hidden">
                             <img src={conv.otherUser?.avatar_url || ''} alt={conv.otherUser?.username || 'User'} className="w-full h-full object-cover" />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm truncate">{conv.otherUser?.username}</h3>
                        <p className={`text-xs truncate ${i === 0 ? 'text-white' : 'text-white/60'}`}>{conv.lastMessage}</p>
                    </div>
                    <div className="flex items-center gap-2">
                         {i > 0 && <MicOff size={14} className="text-white/40" />}
                        <Camera size={20} className="text-white/60" />
                    </div>
                </div>
            ))}

            {/* System Notification */}
            {notifications.filter(n => n.type === 'system').map(notif => (
                <button key={notif.id} onClick={() => notif.action_url ? navigate(notif.action_url) : null} className="flex items-center gap-3 w-full text-left">
                    <div className="w-12 h-12 rounded-full bg-[#1C1E24] border border-white/10 flex items-center justify-center">
                        <Archive className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm">{notif.title}</h3>
                        <p className="text-white/60 text-xs truncate">{notif.body}</p>
                    </div>
                    <span className="text-[10px] text-white/40">21h</span>
                </button>
            ))}

             {/* Shop Notification */}
             {notifications.filter(n => n.type === 'shop').map(notif => (
                <button key={notif.id} onClick={() => navigate('/purchase-coins')} className="flex items-center gap-3 w-full text-left">
                    <div className="w-12 h-12 rounded-full bg-[#C9A96E] flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-white" fill="white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm">{notif.title}</h3>
                        <p className="text-white/60 text-xs truncate">{notif.body}</p>
                    </div>
                    <span className="text-[10px] text-white/40">1d</span>
                </button>
            ))}
             
        </div>
      </div>
    </div>
  );
}