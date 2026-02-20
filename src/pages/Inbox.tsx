import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Heart, UserPlus, Search, Camera, ShoppingBag, Archive, MicOff, Plus, Sword } from 'lucide-react';
import { AvatarRing } from '../components/AvatarRing';
import { showToast } from '../lib/toast';

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
  rawData?: any;
}

interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_at: string;
  otherUser?: { username: string; avatar_url: string | null };
  lastMessage?: string;
}

interface FollowerProfile {
  user_id: string;
  username: string;
  avatar_url: string | null;
}






export default function Inbox() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [followers, setFollowers] = useState<FollowerProfile[]>([]);
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
          actor_id: n.data?.actor_id || '',
          title: n.title || 'Notification',
          body: n.body,
          image_url: n.data?.image_url || n.data?.host_avatar || null,
          action_url: n.data?.action_url || null,
          is_read: n.is_read ?? false,
          created_at: n.created_at,
          rawData: n.data || {},
        })));
      } catch { /* ignore */ }
    };
    const fetchConversations = async () => {
      try {
        const { data } = await supabase
          .from('chat_threads')
          .select('*')
          .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
          .order('last_at', { ascending: false })
          .limit(50);
        if (data) {
          const mapped = await Promise.all(data.map(async (t: any) => {
            const otherId = t.user1_id === currentUserId ? t.user2_id : t.user1_id;
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('user_id', otherId)
              .single();
            return {
              id: t.id,
              user1_id: t.user1_id,
              user2_id: t.user2_id,
              last_at: t.last_at || t.created_at,
              otherUser: profile ? { username: profile.username || 'User', avatar_url: profile.avatar_url } : { username: 'User', avatar_url: null },
              lastMessage: t.last_message || '',
            };
          }));
          setConversations(mapped);
        }
      } catch { /* ignore */ }
    };
    const fetchFollowers = async () => {
      try {
        const { data } = await supabase
          .from('followers')
          .select('follower_id')
          .eq('following_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(100);
        if (data && data.length > 0) {
          const ids = data.map((f: any) => f.follower_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, avatar_url')
            .in('user_id', ids);
          if (profiles) setFollowers(profiles);
        }
      } catch { /* ignore */ }
    };
    fetchNotifications();
    fetchConversations();
    fetchFollowers();
  }, [currentUserId]);

  return (
    <div className="fixed inset-0 bg-[#13151A] flex justify-center" style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="w-full max-w-[480px] overflow-hidden bg-[#13151A] flex flex-col h-full">
        
        {/* Header */}
        <div className="px-4 pt-[env(safe-area-inset-top,8px)] pb-2 flex items-center justify-between z-10 bg-[#13151A] relative">
            <button 
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-full flex items-center justify-center -ml-2 z-10"
            >
                 <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
            </button>
            
            <button className="absolute inset-0 flex items-center justify-center gap-1 font-bold text-lg pointer-events-none">
                <span className="pointer-events-auto text-gold-metallic">Inbox</span>
                <div className="bg-gradient-to-b from-[#f5e6a3] to-[#b8922e] rounded px-1 py-0.5 ml-1">
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
            </button>

            <div className="flex items-center gap-4 z-10">
                <button onClick={() => navigate('/search')} title="Search"><Search size={24} className="stroke-gold-metallic" /></button>
            </div>
        </div>

        {/* Followers Circles - scrollable */}
        <div className="px-4 py-2">
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {/* Create - Profile Circle */}
                <button onClick={() => navigate('/friends')} className="flex flex-col items-center gap-1" style={{ width: 90, minWidth: 90 }}>
                    <div className="relative" style={{ width: 90, height: 90 }}>
                        <img src="/Icons/Profile icon.png" alt="Friends" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-xs text-gold-metallic font-semibold mt-1">Friends</span>
                </button>

                {followers.map(f => (
                    <button key={f.user_id} onClick={() => navigate(`/profile/${f.user_id}`)} className="flex flex-col items-center gap-1" style={{ width: 90, minWidth: 90 }}>
                        <div className="relative" style={{ width: 90, height: 90 }}>
                            <img src="/Icons/Profile icon.png" alt="" className="w-full h-full object-contain" />
                            {f.avatar_url && (
                                <img
                                    src={f.avatar_url}
                                    alt={f.username || 'User'}
                                    className="absolute rounded-full object-cover"
                                    style={{ width: 54, height: 54, top: '45%', left: '51%', transform: 'translate(-50%, -50%)', zIndex: -1 }}
                                />
                            )}
                        </div>
                        <span className="text-xs text-gold-metallic font-semibold mt-1 truncate w-[90px] text-center">{f.username || 'User'}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* Filters */}
        <div className="pl-[calc(1rem+22mm)] pr-4 py-2 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar mb-2">
            <button onClick={() => setActiveFilter('main')} className={`px-4 py-1.5 rounded text-xs font-bold whitespace-nowrap border text-white ${activeFilter === 'main' ? 'bg-[#13151A] border-gold-metallic' : 'bg-[#13151A] border-[#d4af37]/30'}`}>Main</button>
            <button onClick={() => setActiveFilter('requests')} className={`px-4 py-1.5 rounded text-xs font-bold whitespace-nowrap border text-white ${activeFilter === 'requests' ? 'bg-[#13151A] border-gold-metallic' : 'bg-[#13151A] border-[#d4af37]/30'}`}>Requests</button>
            <button onClick={() => setActiveFilter('unread')} className={`px-4 py-1.5 rounded text-xs font-bold whitespace-nowrap border text-white ${activeFilter === 'unread' ? 'bg-[#13151A] border-gold-metallic' : 'bg-[#13151A] border-[#d4af37]/30'}`}>Unread</button>
            <button onClick={() => setActiveFilter('starred')} className={`px-4 py-1.5 rounded text-xs font-bold whitespace-nowrap border text-white ${activeFilter === 'starred' ? 'bg-[#13151A] border-gold-metallic' : 'bg-[#13151A] border-[#d4af37]/30'}`}>Starred</button>
            <div className="ml-auto stroke-gold-metallic">
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
            </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto px-4 py-1 space-y-4">
            
            {/* New Followers */}
            <button onClick={() => navigate('/profile')} className="flex items-center gap-3 w-full text-left">
                <div className="w-12 h-12 rounded-full bg-gradient-to-b from-[#f5e6a3] to-[#b8922e] flex items-center justify-center">
                    <UserPlus className="w-6 h-6 text-[#13151A]" fill="#13151A" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-gold-metallic">New followers</h3>
                    <p className="text-white text-xs truncate">
                      {notifications.find(n => n.type === 'follow')?.body || 'No new followers'}
                    </p>
                </div>
            </button>

            {/* Activity */}
            <button onClick={() => navigate('/profile')} className="flex items-center gap-3 w-full text-left">
                <div className="w-12 h-12 rounded-full bg-gradient-to-b from-[#f5e6a3] to-[#b8922e] flex items-center justify-center">
                    <Heart className="w-6 h-6 text-[#13151A]" fill="#13151A" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-gold-metallic">Activity</h3>
                    <p className="text-white text-xs truncate">
                      {notifications.find(n => n.type === 'like' || n.type === 'comment')?.body || 'No recent activity'}
                    </p>
                </div>
            </button>

            {/* Battle Invites */}
            {notifications.filter(n => n.type === 'battle_invite' && !n.is_read).map(notif => (
                <div key={notif.id} className="flex items-center gap-3 w-full">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {(notif.rawData?.host_avatar || notif.image_url) ? (
                            <img src={notif.rawData?.host_avatar || notif.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <Sword className="w-5 h-5 text-red-400" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-gold-metallic">Battle Invite</h3>
                        <p className="text-white text-xs truncate">{notif.body || 'Someone invited you to battle!'}</p>
                        <div className="flex gap-2 mt-1.5">
                            <button
                                onClick={async () => {
                                    try {
                                        await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
                                        setNotifications(prev => prev.filter(n => n.id !== notif.id));
                                    } catch { /* ignore */ }
                                }}
                                className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 text-[10px] font-bold active:scale-95 transition-all"
                            >
                                Decline
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
                                        const hostUserId = notif.rawData?.actor_id || notif.actor_id;
                                        const streamKey = notif.rawData?.stream_key;
                                        if (currentUserId) {
                                            const { data: myProfile } = await supabase.from('profiles').select('username, avatar_url').eq('user_id', currentUserId).single();
                                            await supabase.from('notifications').insert({
                                                user_id: hostUserId,
                                                type: 'battle_accepted',
                                                title: 'Battle Accepted',
                                                body: `@${myProfile?.username || 'User'} accepted your battle invite!`,
                                                data: {
                                                    actor_id: currentUserId,
                                                    accepted_name: myProfile?.username || 'User',
                                                    accepted_avatar: myProfile?.avatar_url || '',
                                                    stream_key: streamKey,
                                                },
                                            });
                                        }
                                        setNotifications(prev => prev.filter(n => n.id !== notif.id));
                                        if (streamKey) navigate(`/live/${streamKey}`);
                                    } catch {
                                        showToast('Failed to accept');
                                    }
                                }}
                                className="px-3 py-1 rounded-lg bg-[#C9A96E] text-black text-[10px] font-bold active:scale-95 transition-all"
                            >
                                Accept & Join
                            </button>
                        </div>
                    </div>
                </div>
            ))}

            {/* Message Items (Mixed) */}
            {conversations.map((conv, i) => (
                <div key={conv.id} className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/inbox/${conv.id}`)}>
                    <AvatarRing src={conv.otherUser?.avatar_url || ''} alt={conv.otherUser?.username || 'User'} size={48} />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm truncate text-gold-metallic">{conv.otherUser?.username}</h3>
                        <p className="text-xs truncate text-white">{conv.lastMessage}</p>
                    </div>
                    <div className="flex items-center gap-2">
                         {i > 0 && <MicOff size={14} className="text-[#d4af37]/40" />}
                        <Camera size={20} className="stroke-gold-metallic" />
                    </div>
                </div>
            ))}

            {/* System Notification */}
            {notifications.filter(n => n.type === 'system').map(notif => (
                <button key={notif.id} onClick={() => notif.action_url ? navigate(notif.action_url) : null} className="flex items-center gap-3 w-full text-left">
                    <div className="w-12 h-12 rounded-full bg-[#13151A] border border-[#C9A96E]/40 flex items-center justify-center">
                        <Archive className="w-6 h-6 stroke-gold-metallic" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-gold-metallic">{notif.title}</h3>
                        <p className="text-white text-xs truncate">{notif.body}</p>
                    </div>
                    <span className="text-[10px] text-white">21h</span>
                </button>
            ))}

             {/* Shop Notification */}
             {notifications.filter(n => n.type === 'shop').map(notif => (
                <button key={notif.id} onClick={() => navigate('/shop')} className="flex items-center gap-3 w-full text-left">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-b from-[#f5e6a3] to-[#b8922e] flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-[#13151A]" fill="#13151A" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-gold-metallic">{notif.title}</h3>
                        <p className="text-white text-xs truncate">{notif.body}</p>
                    </div>
                    <span className="text-[10px] text-white">1d</span>
                </button>
            ))}
             
        </div>
      </div>
    </div>
  );
}