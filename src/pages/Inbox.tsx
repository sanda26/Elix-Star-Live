import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { apiStub } from '../lib/apiStub';
import { useAuthStore } from '../store/useAuthStore';
import { nativeConfirm } from '../components/NativeDialog';
import { Heart, UserPlus, Search, ShoppingBag, Archive, MicOff, Plus, Sword, X, ChevronRight, Trash2 } from 'lucide-react';
import { AvatarRing } from '../components/AvatarRing';
import { showToast } from '../lib/toast';
import { apiUrl } from '../lib/api';

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
  otherUser?: { username: string; display_name: string | null; avatar_url: string | null };
  lastMessage?: string;
  hasUnread?: boolean;
}

interface FollowerProfile {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface SuggestedUser {
  id: string;
  username: string;
  name: string;
  avatar_url?: string;
  is_live?: boolean;
}






export default function Inbox() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [followers, setFollowers] = useState<FollowerProfile[]>([]);
  const [followersTotalCount, setFollowersTotalCount] = useState(0);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'main' | 'requests' | 'unread' | 'starred' | 'activity'>('main');
  const [showNewFollowersPanel, setShowNewFollowersPanel] = useState(false);
  const deletedThreadIdsRef = useRef<Set<string>>(new Set());

  const INBOX_DELETED_KEY = () => `elix_inbox_deleted_${currentUserId || ''}`;
  const getDeletedThreadIds = (): Set<string> => {
    if (typeof localStorage === 'undefined' || !currentUserId) return new Set();
    try {
      const raw = localStorage.getItem(INBOX_DELETED_KEY());
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as string[];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  };
  const addDeletedThreadId = (id: string) => {
    const set = getDeletedThreadIds();
    set.add(id);
    deletedThreadIdsRef.current = set;
    try { localStorage.setItem(INBOX_DELETED_KEY(), JSON.stringify([...set])); } catch {}
  };
  const isThreadDeleted = (id: string): boolean => deletedThreadIdsRef.current.has(id) || getDeletedThreadIds().has(id);

  const loadCurrentUser = async () => {
    const { data } = await apiStub.auth.getUser();
    setCurrentUserId(data.user?.id || null);
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    deletedThreadIdsRef.current = getDeletedThreadIds();
    const fetchNotifications = async () => {
      try {
        const { data } = await apiStub
          .from('notifications')
          .select('*')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (data) setNotifications(data
          .filter((n: any) => n.type !== 'battle_invite' && n.type !== 'cohost_invite' && n.type !== 'battle_accepted' && n.type !== 'cohost_accepted')
          .map((n: any) => ({
          id: n.id,
          type: n.type || 'system',
          actor_id: n.data?.actor_id || '',
          title: n.title || 'Notification',
          body: n.body,
          image_url: n.data?.image_url || n.data?.host_avatar || n.data?.avatar_url || null,
          action_url: n.data?.action_url || null,
          is_read: n.is_read ?? false,
          created_at: n.created_at,
          rawData: n.data || {},
        })));
      } catch { /* ignore */ }
    };
    const fetchConversations = async () => {
      try {
        const { data } = await apiStub
          .from('chat_threads')
          .select('*')
          .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
          .order('last_at', { ascending: false })
          .limit(50);
        if (data) {
          const mapped = await Promise.all(data.map(async (t: any) => {
            const otherId = t.user1_id === currentUserId ? t.user2_id : t.user1_id;
            const { data: profile } = await apiStub
              .from('profiles')
              .select('username, display_name, avatar_url')
              .eq('user_id', otherId)
              .single();
            const otherUser = profile ? { username: profile.username || 'User', display_name: profile.display_name || null, avatar_url: profile.avatar_url } : { username: 'User', display_name: null, avatar_url: null };
            const { count } = await apiStub
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('thread_id', t.id)
              .neq('sender_id', currentUserId)
              .eq('read', false);
            return {
              id: t.id,
              user1_id: t.user1_id,
              user2_id: t.user2_id,
              last_at: t.last_at || t.created_at,
              otherUser,
              lastMessage: t.last_message || '',
              hasUnread: (count ?? 0) > 0,
            };
          }));
          const filtered = mapped.filter((c: any) => {
            const name = (c.otherUser?.display_name || c.otherUser?.username || '').trim().toLowerCase();
            if (name === 'user' || name === '') return false;
            if (getDeletedThreadIds().has(c.id)) return false;
            return true;
          });
          setConversations(filtered);
        }
      } catch { /* ignore */ }
    };
    const fetchFollowers = async () => {
      try {
        // Source A: backend profile followers count (authoritative)
        const backendFollowersRes = await fetch(apiUrl(`/api/profiles/${encodeURIComponent(currentUserId)}/followers`), {
          credentials: 'include',
        }).catch(() => null as any);
        if (backendFollowersRes?.ok) {
          const backendBody = await backendFollowersRes.json().catch(() => ({ count: 0 }));
          const count = Number(backendBody?.count || 0);
          setFollowersTotalCount(Number.isFinite(count) ? count : 0);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'inbox-followers-debug',hypothesisId:'F0',location:'src/pages/Inbox.tsx:175',message:'backend followers count loaded',data:{currentUserId,count},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'inbox-followers-debug',hypothesisId:'F0',location:'src/pages/Inbox.tsx:180',message:'backend followers count request failed',data:{currentUserId,status:backendFollowersRes?.status||0},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        }

        const { data } = await apiStub
          .from('followers')
          .select('follower_id')
          .eq('following_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(200);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'inbox-followers-debug',hypothesisId:'F1',location:'src/pages/Inbox.tsx:173',message:'followers table loaded',data:{currentUserId,rows:Array.isArray(data)?data.length:0},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (data && data.length > 0) {
          const ids = data.map((f: any) => f.follower_id).filter((id: string) => id !== currentUserId);
          if (ids.length === 0) { setFollowers([]); return; }
          const { data: profiles } = await apiStub
            .from('profiles')
            .select('user_id, username, display_name, avatar_url')
            .in('user_id', ids);
          if (profiles) {
            const list = (profiles as FollowerProfile[]).filter((p) => p.user_id !== currentUserId);
            setFollowers(list);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'inbox-followers-debug',hypothesisId:'F2',location:'src/pages/Inbox.tsx:187',message:'followers profiles mapped',data:{idsCount:ids.length,profilesCount:profiles.length,finalCount:list.length},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
          }
        } else {
          setFollowers([]);
        }
      } catch { /* ignore */ }
    };
    const fetchSuggestedUsers = async () => {
      try {
        const [profilesRes, liveRes] = await Promise.all([
          fetch(apiUrl('/api/profiles'), { credentials: 'include' }),
          fetch(apiUrl('/api/live/streams'), { credentials: 'include' }).catch(() => null as any),
        ]);
        const profilesBody = await profilesRes.json().catch(() => ({ profiles: [] }));
        const liveBody = liveRes ? await liveRes.json().catch(() => ({ streams: [] })) : { streams: [] };
        const liveSet = new Set((liveBody?.streams || []).map((s: any) => s.userId || s.user_id).filter(Boolean));

        const rows = Array.isArray(profilesBody?.profiles) ? profilesBody.profiles : [];
        const blocklist = ['', 'user', 'demo', 'test', 'unknown', 'anonymous', 'guest'];
        const mapped: SuggestedUser[] = rows
          .map((p: any) => ({
            id: p.user_id || p.userId,
            username: p.username || 'user',
            name: p.display_name || p.displayName || p.username || 'User',
            avatar_url: p.avatar_url || p.avatarUrl,
            is_live: liveSet.has(p.user_id || p.userId),
          }))
          .filter((p) => !!p.id && p.id !== currentUserId)
          .filter((p) => {
            const name = (p.name || p.username || '').trim().toLowerCase();
            return name !== '' && !blocklist.includes(name) && name.length >= 2;
          });

        mapped.sort((a, b) => (a.is_live === b.is_live ? 0 : a.is_live ? -1 : 1));
        setSuggestedUsers(mapped);
      } catch {}
    };
    fetchNotifications();
    fetchConversations();
    fetchFollowers();
    fetchSuggestedUsers();
  }, [currentUserId]);

  const isRealUser = (f: FollowerProfile) => {
    const name = (f.display_name || f.username || '').trim().toLowerCase();
    const blocklist = ['', 'user', 'demo', 'test', 'unknown', 'anonymous', 'guest'];
    return name !== '' && !blocklist.includes(name) && name.length >= 2;
  };

  const myNewFollowers = followers.filter(
    (f) =>
      f.user_id !== user?.id &&
      f.user_id !== currentUserId &&
      !!f.user_id
  );
  const followersCount = Math.max(followersTotalCount, myNewFollowers.length);

  const followersForCircles: FollowerProfile[] = (() => {
    const map = new Map<string, FollowerProfile>();
    for (const f of myNewFollowers) {
      map.set(f.user_id, f);
    }
    for (const u of suggestedUsers) {
      if (!u.id || map.has(u.id)) continue;
      map.set(u.id, {
        user_id: u.id,
        username: u.username || 'user',
        display_name: u.name || u.username || 'User',
        avatar_url: u.avatar_url || null,
      });
    }
    return Array.from(map.values());
  })();

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'inbox-followers-debug',hypothesisId:'F3',location:'src/pages/Inbox.tsx:263',message:'inbox followers counts',data:{currentUserId,followersCount,circlesCount:followersForCircles.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [currentUserId, followersCount, followersForCircles.length]);

  return (
    <div className="fixed inset-0 bg-[#13151A] flex justify-center">
      <div
        className="w-full max-w-[480px] flex flex-col overflow-hidden"
        style={{ height: 'calc(100vh - 3.6cm)', marginTop: 0 }}
      >

        {/* Header + Circles with gold frame — same as Friends */}
        <div className="mx-2 mt-2 bg-[#13151A] z-10">
        <div className="px-3 pt-[env(safe-area-inset-top,8px)] pb-1 flex items-center justify-between relative">
          <div className="flex items-center gap-3 z-10">
            <button onClick={() => navigate('/search')} aria-label="Search"><Search size={18} className="text-white" /></button>
          </div>
          <h1 className="text-sm font-bold text-white absolute left-1/2 transform -translate-x-1/2">Inbox</h1>
          <button onClick={() => navigate(-1)} className="p-1 z-10" title="Close">
            <img src="/Icons/Gold power buton.png" alt="Close" className="w-5 h-5" />
          </button>
        </div>

        {/* Circles — Create first, then followers (same as Friends) */}
        <div className="px-3 py-2">
            <div className="flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                <button
                    type="button"
                    onClick={() => setShowNewFollowersPanel(true)}
                    className="flex-shrink-0 flex flex-col items-center gap-1" style={{ width: 95, minWidth: 95 }}
                >
                    <div className="relative" style={{ width: 85, height: 85 }} data-avatar-circle="followers">
                        <img src="/Icons/Profile icon.png" alt="" className="w-full h-full object-contain" style={{ position: 'relative', zIndex: 1 }} />
                        <img
                            src={followersForCircles[0]?.avatar_url || user?.avatar || (user?.id && typeof localStorage !== 'undefined' ? localStorage.getItem('elix_avatar_' + user.id) : null) || '/Icons/Profile icon.png'}
                            alt="Followers"
                            className="absolute rounded-full object-cover"
                            style={{ width: 52, height: 52, top: '45%', left: '51%', transform: 'translate(-50%, -50%)', zIndex: 0 }}
                        />
                    </div>
                    <div className="text-[11px] text-white/80 truncate w-full text-center">Followers</div>
                    <div className="text-[10px] text-[#C9A96E]/90 truncate w-full text-center">{followersCount}</div>
                </button>

                {followersForCircles.map((f) => (
                    <button
                        key={f.user_id}
                        type="button"
                        onClick={() => navigate(`/profile/${f.user_id}`)}
                        className="flex-shrink-0 flex flex-col items-center gap-1" style={{ width: 95, minWidth: 95 }}
                    >
                        <div className="relative" style={{ width: 85, height: 85 }}>
                            <img src="/Icons/Profile icon.png" alt="" className="w-full h-full object-contain" style={{ position: 'relative', zIndex: 1 }} />
                            <img
                                src={f.avatar_url || '/Icons/Profile icon.png'}
                                alt={f.display_name || f.username || 'User'}
                                className="absolute rounded-full object-cover"
                                style={{ width: 52, height: 52, top: '45%', left: '51%', transform: 'translate(-50%, -50%)', zIndex: 0 }}
                            />
                        </div>
                        <div className="text-[11px] text-white/80 truncate w-full text-center">{f.display_name || f.username || 'User'}</div>
                    </button>
                ))}

                {/* All Elix users (always visible) */}
                {suggestedUsers.map((u) => (
                    <button
                        key={u.id}
                        type="button"
                        onClick={() => u.is_live ? navigate(`/watch/${u.id}`) : navigate(`/profile/${u.id}`)}
                        className="flex-shrink-0 flex flex-col items-center gap-1" style={{ width: 95, minWidth: 95 }}
                    >
                        <div className="relative flex items-center justify-center" style={{ width: 85, height: 85 }}>
                            {u.is_live ? (
                                <>
                                    <div className="relative" style={{ width: 85, height: 85 }} data-avatar-circle="live">
                                        <img
                                            src="/Icons/Profile icon.png"
                                            alt=""
                                            className="w-full h-full object-contain"
                                            style={{ position: 'absolute', inset: 0, zIndex: 0 }}
                                        />
                                        <div
                                            className="absolute inset-0 rounded-full"
                                            style={{
                                                background: 'conic-gradient(#ff0040, #ff6a00, #ff0040, #ff6a00, #ff0040)',
                                                WebkitMask:
                                                  'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
                                                mask:
                                                  'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
                                                zIndex: 1,
                                            }}
                                        />
                                        <img
                                            src={u.avatar_url || '/Icons/Profile icon.png'}
                                            alt={u.name || u.username}
                                            className="absolute rounded-full object-cover"
                                            style={{
                                                width: 52,
                                                height: 52,
                                                top: '45%',
                                                left: '51%',
                                                transform: 'translate(-50%, -50%)',
                                                zIndex: 2,
                                            }}
                                        />
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded z-20 whitespace-nowrap">
                                          LIVE
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="relative" style={{ width: 85, height: 85 }}>
                                        <img src="/Icons/Profile icon.png" alt="" className="w-full h-full object-contain" style={{ position: 'relative', zIndex: 1 }} />
                                        <img
                                            src={u.avatar_url || '/Icons/Profile icon.png'}
                                            alt={u.name || u.username}
                                            className="absolute rounded-full object-cover"
                                            style={{ width: 52, height: 52, top: '45%', left: '51%', transform: 'translate(-50%, -50%)', zIndex: 0 }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="text-[11px] text-white/80 truncate w-full text-center">{u.name || u.username}</div>
                    </button>
                ))}
            </div>
        </div>
        </div>

        {/* Filters */}
        <div className="pl-[calc(1rem+22mm)] pr-4 py-2 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar mb-2" style={{ marginLeft: '-20mm' }}>
            <button onClick={() => setActiveFilter('main')} className={`px-4 py-1.5 rounded text-xs font-bold whitespace-nowrap border text-white ${activeFilter === 'main' ? 'bg-[#13151A] border-gold-metallic' : 'bg-[#13151A] border-[#d4af37]/30'}`}>Main</button>
            <button onClick={() => setActiveFilter('requests')} className={`px-4 py-1.5 rounded text-xs font-bold whitespace-nowrap border text-white ${activeFilter === 'requests' ? 'bg-[#13151A] border-gold-metallic' : 'bg-[#13151A] border-[#d4af37]/30'}`}>Requests</button>
            <button onClick={() => setActiveFilter('unread')} className={`px-4 py-1.5 rounded text-xs font-bold whitespace-nowrap border text-white ${activeFilter === 'unread' ? 'bg-[#13151A] border-gold-metallic' : 'bg-[#13151A] border-[#d4af37]/30'}`}>Unread</button>
            <button onClick={() => setActiveFilter('starred')} className={`px-4 py-1.5 rounded text-xs font-bold whitespace-nowrap border text-white ${activeFilter === 'starred' ? 'bg-[#13151A] border-gold-metallic' : 'bg-[#13151A] border-[#d4af37]/30'}`}>Starred</button>
            <button onClick={() => setActiveFilter('activity')} className={`px-4 py-1.5 rounded text-xs font-bold whitespace-nowrap border text-white ${activeFilter === 'activity' ? 'bg-[#13151A] border-gold-metallic' : 'bg-[#13151A] border-[#d4af37]/30'}`}>Activity</button>
            <div className="ml-auto stroke-gold-metallic">
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
            </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto px-4 py-1 space-y-4">
            
            {activeFilter === 'main' && (
            <>
            {/* New followers — tap to open panel with all people who follow you */}
            <button
                type="button"
                onClick={() => setShowNewFollowersPanel(true)}
                className="flex items-center gap-3 w-full text-left py-2 px-2 rounded-lg hover:bg-white/5 active:bg-white/10"
            >
                <div className="relative w-12 h-12 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img src="/Icons/Profile icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                    <UserPlus className="w-6 h-6 text-[#C9A96E] relative z-10" strokeWidth={2} style={{ transform: 'translate(0.5mm, -0.5mm)' }} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-gold-metallic">New followers</h3>
                    <p className="text-white/70 text-xs truncate">
                        {followersCount === 0
                            ? 'No new followers yet'
                            : `${followersCount} people follow you`}
                    </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#C9A96E]/70 flex-shrink-0" />
            </button>

            {/* Activity - golden circle from Music Icon (likes, comments) */}
            <button onClick={() => setActiveFilter('activity')} className="flex items-center gap-3 w-full text-left py-2 px-2 rounded-lg hover:bg-white/5 active:bg-white/10">
                <div className="relative w-12 h-12 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                    <Heart className="w-6 h-6 text-[#C9A96E] relative z-10" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-gold-metallic">Activity</h3>
                    <p className="text-white text-xs truncate">
                      {notifications.filter(n => n.type === 'like' || n.type === 'comment').length
                        ? `${notifications.filter(n => n.type === 'like' || n.type === 'comment').length} likes & comments`
                        : 'No recent activity'}
                    </p>
                </div>
            </button>

            {/* Messages (Inbox) — show right after Activity so inbox = messages */}
            <div className="space-y-1 pt-2">
                <h3 className="font-bold text-sm text-gold-metallic px-1 pb-2">Messages</h3>
                {conversations.length === 0 ? (
                    <p className="text-white/50 text-xs px-1 py-2">No messages yet</p>
                ) : (
                    conversations.map((conv) => (
                        <div key={conv.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/5 active:bg-white/10 group">
                            <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/inbox/${conv.id}`)}>
                                <AvatarRing src={conv.otherUser?.avatar_url || ''} alt={conv.otherUser?.display_name || conv.otherUser?.username || 'User'} size={48} />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-white truncate">{conv.otherUser?.display_name || conv.otherUser?.username || 'User'}</p>
                                    <p className="text-white/60 text-xs truncate">{conv.lastMessage || 'No messages yet'}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    const ok = await nativeConfirm('Delete this conversation? Messages will be removed.', 'Delete Conversation');
                                    if (!ok) return;
                                    apiStub.from('chat_threads').delete().eq('id', conv.id).then(({ error }) => {
                                        if (error) showToast('Could not delete');
                                        else {
                                          addDeletedThreadId(conv.id);
                                          setConversations((prev) => prev.filter((c) => c.id !== conv.id));
                                        }
                                    });
                                }}
                                className="w-10 h-10 rounded-full bg-[#13151A] border border-[#C9A96E]/40 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform hover:border-red-500/50 hover:bg-red-500/10"
                                title="Delete conversation"
                                aria-label="Delete conversation"
                            >
                                <Trash2 size={18} className="text-[#C9A96E]/90 hover:text-red-400" />
                            </button>
                        </div>
                    ))
                )}
            </div>
            </>
            )}

            {/* Unread — only conversations with unread messages */}
            {activeFilter === 'unread' && (
            <div className="space-y-1 pt-2">
                <h3 className="font-bold text-sm text-gold-metallic px-1 pb-2">Unread messages</h3>
                {conversations.filter((c) => c.hasUnread).length === 0 ? (
                    <p className="text-white/50 text-xs px-1 py-2">No unread messages</p>
                ) : (
                    conversations.filter((c) => c.hasUnread).map((conv) => (
                        <div key={conv.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/5 active:bg-white/10 group">
                            <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/inbox/${conv.id}`)}>
                                <AvatarRing src={conv.otherUser?.avatar_url || ''} alt={conv.otherUser?.display_name || conv.otherUser?.username || 'User'} size={48} />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-white truncate">{conv.otherUser?.display_name || conv.otherUser?.username || 'User'}</p>
                                    <p className="text-white/60 text-xs truncate">{conv.lastMessage || 'No messages yet'}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    const ok = await nativeConfirm('Delete this conversation? Messages will be removed.', 'Delete Conversation');
                                    if (!ok) return;
                                    apiStub.from('chat_threads').delete().eq('id', conv.id).then(({ error }) => {
                                        if (error) showToast('Could not delete');
                                        else {
                                          addDeletedThreadId(conv.id);
                                          setConversations((prev) => prev.filter((c) => c.id !== conv.id));
                                        }
                                    });
                                }}
                                className="w-10 h-10 rounded-full bg-[#13151A] border border-[#C9A96E]/40 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform hover:border-red-500/50 hover:bg-red-500/10"
                                title="Delete conversation"
                                aria-label="Delete conversation"
                            >
                                <Trash2 size={18} className="text-[#C9A96E]/90 hover:text-red-400" />
                            </button>
                        </div>
                    ))
                )}
            </div>
            )}

            {/* Activity list — people who liked or commented on your videos; tap opens that video */}
            {activeFilter === 'activity' && (
              <>
                {notifications.filter(n => n.type === 'like' || n.type === 'comment').length === 0 ? (
                  <div className="py-8 text-center text-white/50 text-sm">No likes or comments yet. When someone likes or comments on your video, they’ll show here.</div>
                ) : (
                  <div className="space-y-1 pb-4">
                    {notifications.filter(n => n.type === 'like' || n.type === 'comment').map(notif => {
                      const actorName = notif.rawData?.actor_display_name || (notif.rawData?.actor_username ? `@${notif.rawData.actor_username}` : null) || notif.title || 'Someone';
                      const actionUrl = notif.action_url || notif.rawData?.action_url;
                      return (
                        <button
                          key={notif.id}
                          onClick={() => { if (actionUrl) navigate(actionUrl); }}
                          className="flex items-center gap-3 w-full text-left py-2.5 px-2 rounded-lg hover:bg-white/5 active:bg-white/10"
                        >
                          <div className="w-12 h-12 rounded-full bg-[#13151A] border border-[#C9A96E]/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {(notif.image_url || notif.rawData?.avatar_url) ? (
                              <img src={notif.image_url || notif.rawData?.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[#C9A96E] font-bold text-lg">{(actorName || '?').replace('@', '').charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-white truncate">{actorName}</p>
                            <p className="text-white/70 text-xs truncate">
                              {notif.type === 'like' ? 'liked your video' : 'commented on your video'}
                              {actionUrl && ' · Tap to view'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Battle / Co-host invites: not shown in Inbox — use banner on live page only */}

            {/* System Notification — hide "check out this profile" / profile promo so inbox shows messages, not profile */}
            {(activeFilter === 'main') && notifications
                .filter(n => n.type === 'system' && !(n.body?.toLowerCase?.().includes('check out this profile') || n.action_url?.includes('/profile/' + currentUserId)))
                .map(notif => (
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

             {/* Starred empty state */}
             {activeFilter === 'starred' && (
               <div className="py-8 text-center text-white/50 text-sm">No starred messages yet.</div>
             )}

             {/* Shop Notification */}
             {notifications.filter(n => n.type === 'shop').map(notif => (
                <button key={notif.id} onClick={() => navigate('/shop')} className="flex items-center gap-3 w-full text-left">
                    <div className="w-12 h-12 rounded-full bg-[#13151A] border border-[#C9A96E]/40 flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-[#C9A96E]" strokeWidth={2} />
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

      {/* New followers panel — rendered on top of everything via portal */}
      {showNewFollowersPanel && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/50 pointer-events-auto z-[100]"
            onClick={() => setShowNewFollowersPanel(false)}
            aria-hidden
          />
          <div className="fixed left-0 right-0 pointer-events-auto max-w-[480px] mx-auto z-[101]" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--nav-height))' }}>
            <div className="bg-background/95 backdrop-blur-md rounded-t-2xl p-3 pb-4 overflow-y-scroll shadow-2xl w-full border-t border-[#C9A96E]/20 new-followers-panel-scroll" style={{ minHeight: 'calc(55dvh - 3cm)', maxHeight: 'calc(min(85dvh, 700px) - 3cm)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gold-metallic">Followers ({followersCount})</h2>
                <button type="button" onClick={() => setShowNewFollowersPanel(false)} className="p-2 rounded-full hover:bg-white/10" title="Close" aria-label="Close">
                  <X size={22} className="text-white" />
                </button>
              </div>
              {followersForCircles.length === 0 ? (
              <p className="text-white/50 text-sm py-6 text-center">No one follows you yet. When they do, they’ll show here.</p>
            ) : (
              <div className="space-y-0.5 pb-2">
                {followersForCircles.map((f) => (
                    <button
                      key={f.user_id}
                      type="button"
                      onClick={() => { setShowNewFollowersPanel(false); navigate(`/profile/${f.user_id}`); }}
                      className="flex items-center gap-3 w-full text-left py-2.5 px-2 rounded-lg hover:bg-white/5 active:bg-white/10"
                    >
                      <div className="relative w-11 h-11 rounded-full bg-[#13151A] flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#C9A96E]/30">
                        {f.avatar_url ? (
                          <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[#C9A96E] font-bold text-lg">{(f.display_name || f.username || 'U').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-white truncate">{f.display_name || f.username || 'User'}</p>
                        <p className="text-white/60 text-xs truncate">@{f.username}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#C9A96E]/70 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}