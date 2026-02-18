import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Heart, MessageCircle, UserPlus, Gift, Bell, Mail } from 'lucide-react';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'gift' | 'battle_invite' | 'system';
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

const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: 'demo-notif-1',
    type: 'follow',
    actor_id: 'demo-actor-1',
    actor: { username: 'kashmir', avatar_url: 'https://ui-avatars.com/api/?name=Kashmir&background=121212&color=E6B36A' },
    title: 'started following you.',
    body: null,
    image_url: null,
    action_url: null,
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: 'demo-notif-2',
    type: 'like',
    actor_id: 'demo-actor-2',
    actor: { username: 'stefanuca', avatar_url: 'https://ui-avatars.com/api/?name=Stefanuca&background=121212&color=E6B36A' },
    title: 'liked your video.',
    body: null,
    image_url: null,
    action_url: null,
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: 'demo-notif-3',
    type: 'system',
    actor_id: 'demo-system',
    actor: undefined,
    title: 'System notifications',
    body: 'LIVE: Your viewers want to see more…',
    image_url: null,
    action_url: null,
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: 'demo-conv-1',
    participant_1: 'demo',
    participant_2: 'demo',
    last_message_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    otherUser: { username: 'sandraa', avatar_url: 'https://ui-avatars.com/api/?name=Sandra&background=121212&color=E6B36A' },
    lastMessage: '[28 messages] shared a LIVE',
  },
  {
    id: 'demo-conv-2',
    participant_1: 'demo',
    participant_2: 'demo',
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    otherUser: { username: 'vadva', avatar_url: 'https://ui-avatars.com/api/?name=Vaduva&background=121212&color=E6B36A' },
    lastMessage: '[24 messages] shared a LIVE',
  },
];

export default function Inbox() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'notifications' | 'messages'>('notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    setCurrentUserId(data.user?.id || null);
  };

  const loadNotifications = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, actor:profiles!actor_id(username, avatar_url)')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, [currentUserId]);

  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${currentUserId},participant_2.eq.${currentUserId}`)
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      if (activeTab === 'notifications') {
        loadNotifications();
      } else {
        loadConversations();
      }
    }
  }, [activeTab, currentUserId, loadNotifications, loadConversations]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-5 h-5 text-red-500" />;
      case 'comment':
        return <MessageCircle className="w-5 h-5 text-blue-500" />;
      case 'follow':
        return <UserPlus className="w-5 h-5 text-green-500" />;
      case 'gift':
        return <Gift className="w-5 h-5 text-purple-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  const displayedNotifications =
    notifications.length > 0 ? notifications : import.meta.env.DEV ? DEMO_NOTIFICATIONS : [];
  const displayedConversations =
    conversations.length > 0 ? conversations : import.meta.env.DEV ? DEMO_CONVERSATIONS : [];

  const storyUsers = (() => {
    const items: Array<{ key: string; username: string; avatarUrl: string }> = [];
    const push = (username: string, avatarUrl?: string | null) => {
      const key = username.toLowerCase();
      if (items.some((i) => i.key === key)) return;
      const resolved =
        avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=121212&color=E6B36A`;
      items.push({ key, username, avatarUrl: resolved });
    };
    displayedConversations.forEach((c) => {
      if (c.otherUser?.username) push(c.otherUser.username, c.otherUser.avatar_url);
    });
    displayedNotifications.forEach((n) => {
      if (n.actor?.username) push(n.actor.username, n.actor.avatar_url);
    });
    return items.slice(0, 10);
  })();

  return (
    <div className="min-h-[100dvh] bg-black text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] rounded-3xl overflow-hidden bg-[#121212] pt-[var(--safe-top)] pb-[calc(var(--safe-bottom)+12mm)] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#121212] z-10 px-4 py-4 border-b border-transparent">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => navigate('/feed')} className="p-1 hover:brightness-125 transition" title="Back to For You">
              <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">Inbox</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 py-1.5 rounded-lg font-semibold text-sm transition ${
                activeTab === 'notifications'
                  ? 'bg-[#E6B36A] text-black'
                  : 'text-white'
              }`}
            >
              <Bell className="w-4 h-4 inline mr-1.5" />
              Notifications
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className={`flex-1 py-1.5 rounded-lg font-semibold text-sm transition ${
                activeTab === 'messages'
                  ? 'bg-[#E6B36A] text-black'
                  : 'text-white'
              }`}
            >
              <Mail className="w-4 h-4 inline mr-1.5" />
              Messages
            </button>
          </div>

          {(import.meta.env.DEV || storyUsers.length > 0) && (
            <div className="mt-4">
              <div className="flex gap-4 overflow-x-auto pb-1">
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
                {storyUsers.map((u) => (
                  <button
                    key={u.key}
                    type="button"
                    className="flex-shrink-0 w-[72px] flex flex-col items-center gap-2"
                  >
                    <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[#00f5ff] via-[#00f5ff] to-[#E6B36A]">
                      <div className="w-full h-full rounded-full bg-[#121212] p-[2px]">
                        <img
                          src={u.avatarUrl}
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
        </div>

        {/* Content */}
        <div className="px-4 pt-[8mm] pb-4">
          {activeTab === 'notifications' ? (
            <div className="space-y-3">
              {displayedNotifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (notif.id.startsWith('demo-')) return;
                    markAsRead(notif.id);
                    if (notif.action_url) {
                      navigate(notif.action_url);
                    }
                  }}
                  className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition ${
                    notif.is_read ? 'bg-transparent' : 'bg-[#E6B36A]/10'
                  }`}
                >
                  <div className="mt-1">{getNotificationIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {notif.actor && (
                        <img
                          src={notif.actor.avatar_url || `https://ui-avatars.com/api/?name=${notif.actor.username}`}
                          alt={notif.actor.username}
                          className="w-8 h-8 object-cover"
                        />
                      )}
                      <span className="font-semibold">{notif.actor?.username || 'System'}</span>
                      <span className="text-white/60">{notif.title}</span>
                    </div>
                    {notif.body && <p className="text-sm text-white/70">{notif.body}</p>}
                    <p className="text-xs text-white/40 mt-1">{formatTime(notif.created_at)}</p>
                  </div>
                  {!notif.is_read && <div className="w-2 h-2 bg-[#E6B36A] rounded-full mt-2"></div>}
                </div>
              ))}

              {displayedNotifications.length === 0 && (
                <div className="text-center py-12 text-white/40">No notifications yet</div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedConversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => {
                    if (conv.id.startsWith('demo-')) return;
                    navigate(`/inbox/${conv.id}`);
                  }}
                  className="flex items-center gap-3 p-4 rounded-lg cursor-pointer hover:brightness-125 transition"
                >
                  <img
                    src={conv.otherUser?.avatar_url || `https://ui-avatars.com/api/?name=User`}
                    alt="User"
                    className="w-12 h-12 object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{conv.otherUser?.username || 'User'}</p>
                    <p className="text-sm text-white/60 truncate">{conv.lastMessage || 'No messages yet'}</p>
                  </div>
                  <span className="text-xs text-white/40">{formatTime(conv.last_message_at)}</span>
                </div>
              ))}

              {displayedConversations.length === 0 && (
                <div className="text-center py-12 text-white/40">No messages yet</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}
