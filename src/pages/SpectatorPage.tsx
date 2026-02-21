import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { showToast } from '../lib/toast';
import {
  Send,
  Search,
  Heart,
  Share2,
  Gift,
  MoreVertical,
  Copy,
  AlertTriangle,
  Github,
  Check,
  UserPlus,
  X,
  Eye,
  MessageCircle,
  Flag,
} from 'lucide-react';
import { GiftPanel } from '../components/GiftPanel';
import { GIFTS } from '../lib/gifts';
import { GiftOverlay } from '../components/GiftOverlay';
import GiftAnimationOverlay from '../components/GiftAnimationOverlay';
import { ChatOverlay } from '../components/ChatOverlay';
import { AvatarRing } from '../components/AvatarRing';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import ReportModal from '../components/ReportModal';
import { websocket } from '../lib/websocket';

type LiveMessage = {
  id: string;
  username: string;
  text: string;
  level?: number;
  isGift?: boolean;
  avatar?: string;
  isSystem?: boolean;
  membershipIcon?: string;
  isMod?: boolean;
};

export default function SpectatorPage() {
  const { streamId } = useParams<{ streamId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const effectiveStreamId = streamId || '';

  const [hostName, setHostName] = useState('Creator');
  const [hostAvatar, setHostAvatar] = useState('');
  const [hostUserId, setHostUserId] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [activeLikes, setActiveLikes] = useState(0);

  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [coinBalance, setCoinBalance] = useState(0);

  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [currentGift, setCurrentGift] = useState<string | null>(null);
  const [giftQueue, setGiftQueue] = useState<string[]>([]);
  const [shareQuery, setShareQuery] = useState('');
  const [shareContacts, setShareContacts] = useState<{ id: string; name: string; avatar: string }[]>([]);

  const [joinRequestSent, setJoinRequestSent] = useState(false);

  const [userLevel, setUserLevel] = useState(user?.level || 1);
  const [userXP, setUserXP] = useState(0);

  const viewerName = user?.username || user?.name || 'Viewer';
  const viewerAvatar = user?.avatar || '';

  const [moderators, setModerators] = useState<Set<string>>(new Set());
  const isModerator = moderators.has(user?.id || '');

  const [hasJoinedToday, setHasJoinedToday] = useState(false);
  const [myHeartCount, setMyHeartCount] = useState(0);

  // Fetch host profile
  useEffect(() => {
    if (!effectiveStreamId) return;
    (async () => {
      const { data: stream } = await supabase
        .from('live_streams')
        .select('user_id, title, viewer_count')
        .eq('stream_key', effectiveStreamId)
        .maybeSingle();
      if (stream?.user_id) {
        setHostUserId(stream.user_id);
        setViewerCount(stream.viewer_count || 0);
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url')
          .eq('user_id', stream.user_id)
          .maybeSingle();
        if (profile) {
          setHostName(profile.display_name || profile.username || stream.title || 'Creator');
          setHostAvatar(profile.avatar_url || '');
        } else if (stream.title) {
          setHostName(stream.title);
        }
      }
    })();
  }, [effectiveStreamId]);

  // Fetch user profile (level, xp, coins)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('level, xp, coins')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        if (data.level) setUserLevel(Number(data.level));
        if (data.xp) setUserXP(Number(data.xp));
        if (data.coins != null) setCoinBalance(Number(data.coins));
      }
    })();
  }, [user?.id]);

  // Refresh coins when gift panel opens
  useEffect(() => {
    if (showGiftPanel && user?.id) {
      supabase
        .from('profiles')
        .select('coins')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.coins != null) setCoinBalance(Number(data.coins));
        });
    }
  }, [showGiftPanel, user?.id]);

  // Join tracking
  useEffect(() => {
    if (user?.id && effectiveStreamId) {
      const today = new Date().toISOString().split('T')[0];
      const storageKey = `joined_stream_${effectiveStreamId}_${user.id}_${today}`;
      if (localStorage.getItem(storageKey)) setHasJoinedToday(true);
      const heartKey = `my_heart_count_${effectiveStreamId}_${user.id}`;
      const saved = localStorage.getItem(heartKey);
      if (saved) setMyHeartCount(parseInt(saved, 10));
    }
  }, [user?.id, effectiveStreamId]);

  // Viewer count realtime
  useEffect(() => {
    if (!effectiveStreamId) return;
    const chan = supabase
      .channel(`spectator_viewers_${effectiveStreamId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams',
        filter: `stream_key=eq.${effectiveStreamId}`,
      }, (payload: any) => {
        if (payload.new?.viewer_count != null) setViewerCount(payload.new.viewer_count);
        if (payload.new?.is_live === false) {
          showToast('Stream ended');
          setTimeout(() => navigate('/feed', { replace: true }), 2000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [effectiveStreamId, navigate]);

  // Fetch share contacts
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url')
        .neq('user_id', user.id)
        .limit(50);
      if (data) {
        setShareContacts(data.map((p: any) => ({
          id: p.user_id,
          name: p.display_name || p.username || 'User',
          avatar: p.avatar_url || '',
        })));
      }
    })();
  }, [user?.id]);

  // Gift queue processor
  useEffect(() => {
    if (giftQueue.length > 0 && !currentGift) {
      setCurrentGift(giftQueue[0]);
      setGiftQueue(prev => prev.slice(1));
    }
  }, [giftQueue, currentGift]);

  const handleGiftEnded = useCallback(() => {
    setCurrentGift(null);
  }, []);

  // Send chat message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const newMsg: LiveMessage = {
      id: Date.now().toString(),
      username: viewerName,
      text: inputValue,
      level: userLevel,
      avatar: viewerAvatar,
      isMod: isModerator,
    };
    setMessages(prev => [...prev, newMsg]);
    websocket.send('chat_message', {
      text: inputValue,
      level: userLevel,
      avatar: viewerAvatar,
    });
    setInputValue('');
  };

  // Send gift
  const handleSendGift = async (gift: typeof GIFTS[0]) => {
    if (!gift) return;
    if (coinBalance < gift.coins) {
      setShowGiftPanel(false);
      return;
    }
    let newLevel = userLevel;
    if (user?.id) {
      try {
        const { data, error } = await supabase.rpc('send_stream_gift', {
          p_stream_key: effectiveStreamId,
          p_gift_id: gift.id,
        });
        if (error) {
          const msg = typeof error.message === 'string' ? error.message : '';
          if (msg.includes('insufficient_funds')) { setShowGiftPanel(false); return; }
          setCoinBalance(prev => Math.max(0, prev - gift.coins));
        } else {
          const row = Array.isArray(data) ? data[0] : data;
          if (row?.new_balance != null) setCoinBalance(Number(row.new_balance));
          if (row?.new_level != null) {
            const updatedLevel = Number(row.new_level);
            setUserLevel(updatedLevel);
            updateUser({ level: updatedLevel });
            newLevel = updatedLevel;
          }
          if (row?.new_xp != null) setUserXP(Number(row.new_xp));
        }
      } catch {
        setCoinBalance(prev => Math.max(0, prev - gift.coins));
      }

      const xpGained = gift.coins;
      let currentXP = userXP + xpGained;
      let currentLevel = userLevel;
      while (true) {
        const xpNeeded = currentLevel * 1000;
        if (currentXP >= xpNeeded && currentLevel < 150) {
          currentLevel++;
          currentXP -= xpNeeded;
        } else break;
      }
      setUserLevel(currentLevel);
      setUserXP(currentXP);
      updateUser({ level: currentLevel });
      newLevel = currentLevel;
      supabase.from('profiles').update({ level: currentLevel, xp: currentXP }).eq('user_id', user.id).then(() => {});
    } else {
      setCoinBalance(prev => Math.max(0, prev - gift.coins));
    }

    setShowGiftPanel(false);
    if (gift.video) setGiftQueue(prev => [...prev, gift.video]);

    const giftMsg: LiveMessage = {
      id: Date.now().toString(),
      username: viewerName,
      text: `Sent a ${gift.name}`,
      isGift: true,
      level: newLevel,
      avatar: viewerAvatar,
    };
    setMessages(prev => [...prev, giftMsg]);
    websocket.send('gift_sent', {
      giftId: gift.id,
      giftName: gift.name,
      level: newLevel,
      avatar: viewerAvatar,
      video: gift.video || null,
      transactionId: `${user?.id || 'anon'}-${Date.now()}`,
    });
  };

  // Send join request
  const sendJoinRequest = async (type: 'cohost' | 'battle') => {
    if (!user?.id || !effectiveStreamId) return;
    const { data: stream } = await supabase
      .from('live_streams')
      .select('user_id')
      .eq('stream_key', effectiveStreamId)
      .maybeSingle();
    if (!stream?.user_id) { showToast('Stream not found'); return; }
    const myName = user.username || user.name || 'User';
    await supabase.from('notifications').insert({
      user_id: stream.user_id,
      type: 'join_request',
      title: type === 'cohost' ? 'Co-Host Request' : 'Battle Request',
      body: `@${myName} wants to ${type === 'cohost' ? 'co-host' : 'battle'}!`,
      data: {
        actor_id: user.id,
        requester_name: myName,
        requester_avatar: user.avatar || '',
        stream_key: effectiveStreamId,
        request_type: type,
      },
    });
    setJoinRequestSent(true);
    showToast('Request sent!');
  };

  // Heart tap handler
  const handleLikeTap = () => {
    setActiveLikes(prev => prev + 1);
  };

  return (
    <div className="fixed inset-0 bg-[#0A0B0E] flex justify-center">
      <div className="relative w-full max-w-[480px] h-full bg-[#13151A] overflow-hidden flex flex-col">

        {/* FULL SCREEN VIDEO AREA — black background, this is where the live stream renders */}
        <div className="absolute inset-0 z-0 bg-[#13151A]">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-24 h-24 rounded-full border-[3px] border-red-500/40 overflow-hidden">
              {hostAvatar ? (
                <img src={hostAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#C9A96E]/20 flex items-center justify-center">
                  <span className="text-[#C9A96E] font-bold text-3xl">{hostName.slice(0, 1).toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TOP BAR */}
        <div className="relative z-[110] pointer-events-none">
          <div className="px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}>
            <div className="flex items-start justify-between gap-2">
              {/* Left: Creator info */}
              <div className="pointer-events-auto flex flex-col gap-2">
                <div className="flex items-center gap-0 -ml-1">
                  <div
                    className="relative z-10 flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                    onClick={() => navigate(`/profile/${hostUserId}`)}
                  >
                    <AvatarRing src={hostAvatar} alt={hostName} size={56} />
                  </div>
                  <div
                    className="flex flex-col justify-center -ml-4 pl-6 pr-4 h-9 rounded-full border border-[#C9A96E]/60 bg-[#13151A]/80 min-w-[120px]"
                    style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, boxShadow: '0 0 8px rgba(201,169,110,0.25)' }}
                  >
                    <span className="text-white text-[10px] font-bold truncate max-w-[140px] leading-tight">{hostName}</span>
                    <div className="flex items-center gap-1 -mt-0.5">
                      <Heart className="w-2 h-2 text-[#FF2D55]" strokeWidth={2.5} fill="#FF2D55" />
                      <span className="text-white/70 text-[8px] font-bold tabular-nums">{activeLikes.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Viewer count */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#13151A]/60 border border-white/10 w-fit">
                  <Eye size={10} className="text-white/50" />
                  <span className="text-white/60 text-[9px] font-semibold">{viewerCount}</span>
                </div>
              </div>

              {/* Right: Close / Leave button */}
              <div className="pointer-events-auto flex items-center gap-2 mt-1">
                <button
                  type="button"
                  title="Leave stream"
                  onClick={() => navigate('/feed', { replace: true })}
                  className="w-8 h-8 rounded-full bg-[#13151A]/60 border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <X size={16} className="text-white/80" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CHAT OVERLAY */}
        <div className="flex-1 relative z-10 pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 max-h-[40vh] pointer-events-auto px-3 pb-2">
            <ChatOverlay
              messages={messages}
              variant="overlay"
              compact
              isModerator={isModerator}
              onDeleteMessage={(msgId) => {
                setMessages(prev => prev.filter(m => m.id !== msgId));
              }}
              onBlockUser={(username) => {
                setMessages(prev => prev.filter(m => m.username !== username));
                showToast(`@${username} blocked from chat`);
              }}
            />
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="flex-none pointer-events-auto bg-transparent px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 min-h-[50px] relative z-[90]">
          <div className="flex items-center gap-3 translate-y-[4px]">
            {/* Chat input */}
            {!currentGift ? (
              <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2 bg-[#13151A]/40 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 h-10 min-w-0">
                <input
                  type="text"
                  inputMode="text"
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCorrect="off"
                  placeholder="Say something..."
                  className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-white/40 min-w-0"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <button type="submit" className="text-white hover:text-white/80 transition flex-shrink-0" title="Send">
                  <Send size={18} />
                </button>
              </form>
            ) : (
              <div className="flex-1" />
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 flex-shrink-0">
              {/* Request co-host */}
              {!joinRequestSent ? (
                <button
                  type="button"
                  title="Request co-host"
                  onClick={() => sendJoinRequest('cohost')}
                  className="w-10 h-10 rounded-full bg-[#C9A96E] flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  <UserPlus size={20} className="text-black" />
                </button>
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#13151A] border border-green-500/40 flex items-center justify-center">
                  <Check size={20} className="text-green-400" />
                </div>
              )}
              <button
                type="button"
                title="Send gift"
                onClick={() => setShowGiftPanel(true)}
                className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg"
              >
                <Gift size={20} className="text-[#C9A96E]" />
              </button>
              <button
                type="button"
                title="Share"
                onClick={() => setShowSharePanel(true)}
                className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <Share2 size={20} className="text-[#C9A96E]" />
              </button>
              <button
                type="button"
                title="More options"
                onClick={() => setIsMoreMenuOpen(true)}
                className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg"
              >
                <MoreVertical size={20} className="text-[#C9A96E]" />
              </button>
            </div>
          </div>
        </div>

        {/* GIFT ANIMATION OVERLAY */}
        <GiftAnimationOverlay streamId={effectiveStreamId} />

        {/* GIFT VIDEO OVERLAY */}
        <GiftOverlay videoSrc={currentGift} onEnded={handleGiftEnded} isBattleMode={false} />

        {/* GIFT PANEL */}
        {showGiftPanel && (
          <>
            <div
              className="fixed inset-0 bg-[#13151A]/40 pointer-events-auto"
              style={{ zIndex: 99998 }}
              onClick={() => setShowGiftPanel(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 h-[40vh] z-[999999] pointer-events-auto max-w-[480px] mx-auto">
              <GiftPanel
                onSelectGift={handleSendGift}
                userCoins={coinBalance}
                onRechargeSuccess={(newBalance) => setCoinBalance(newBalance)}
              />
            </div>
          </>
        )}

        {/* SHARE PANEL */}
        {showSharePanel && (
          <>
            <div
              className="fixed inset-0 bg-black/40 pointer-events-auto"
              style={{ zIndex: 99998 }}
              onClick={() => setShowSharePanel(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-[99999] pointer-events-auto max-w-[480px] mx-auto">
              <div className="bg-[#1C1E24]/95 rounded-t-2xl p-4 pb-safe flex flex-col gap-1 shadow-2xl w-full max-h-[40vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-center mb-2">
                  <div className="w-10 h-1 bg-white/20 rounded-full" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-white font-bold whitespace-nowrap">Share to</h3>
                  <div className="flex-none w-[120px] bg-white/5 rounded-lg px-2 py-1.5 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-white/30" />
                    <input
                      value={shareQuery}
                      onChange={(e) => setShareQuery(e.target.value)}
                      placeholder="Search..."
                      className="bg-transparent text-white text-xs outline-none w-full placeholder:text-white/20"
                    />
                  </div>
                </div>
                <div className="w-full overflow-hidden shrink-0">
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar items-center">
                    {shareContacts.filter(c => c.name.toLowerCase().includes(shareQuery.toLowerCase())).map((u) => (
                      <button
                        key={u.id}
                        className="flex flex-col items-center gap-1 min-w-[56px] active:scale-95 transition-transform"
                        onClick={() => setShowSharePanel(false)}
                      >
                        <div className="relative">
                          <AvatarRing src={u.avatar} alt={u.name} size={48} />
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#FF2D55] rounded-full flex items-center justify-center border-2 border-[#1a1a1a]">
                            <Send size={7} className="text-white" />
                          </div>
                        </div>
                        <span className="text-white text-[9px] font-bold truncate max-w-[56px]">{u.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar shrink-0">
                  {[
                    { name: 'WhatsApp', color: '#25D366', icon: <MessageCircle size={24} /> },
                    { name: 'Facebook', color: '#1877F2', icon: <Share2 size={24} /> },
                    { name: 'Instagram', color: '#E4405F', icon: <Share2 size={24} /> },
                    { name: 'GitHub', color: '#333333', icon: <Github size={24} /> },
                    { name: 'Copy Link', color: '#C9A96E', icon: <Copy size={24} /> },
                    { name: 'Message', color: '#00C853', icon: <MessageCircle size={24} /> },
                  ].map((item) => (
                    <button
                      key={item.name}
                      onClick={() => {
                        if (item.name === 'Copy Link') {
                          navigator.clipboard.writeText(`${window.location.origin}/watch/${effectiveStreamId}`);
                          showToast('Link copied!');
                        }
                        setShowSharePanel(false);
                      }}
                      className="flex flex-col items-center gap-1 min-w-[60px]"
                    >
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg"
                        style={{ backgroundColor: item.color }}
                      >
                        {item.icon}
                      </div>
                      <span className="text-white/70 text-[10px]">{item.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar shrink-0">
                  {[
                    { name: 'Report', color: '#EF4444', icon: <AlertTriangle size={24} className="text-white" />, action: () => setIsReportModalOpen(true) },
                  ].map((item) => (
                    <button
                      key={item.name}
                      onClick={() => { item.action(); setShowSharePanel(false); }}
                      className="flex flex-col items-center gap-1 min-w-[60px]"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#13151A] flex items-center justify-center border border-[#C9A96E]/40">
                        {item.icon}
                      </div>
                      <span className="text-white/70 text-[10px]">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* MORE MENU */}
        {isMoreMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 pointer-events-auto"
              style={{ zIndex: 99998 }}
              onClick={() => setIsMoreMenuOpen(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-[99999] pointer-events-auto max-w-[480px] mx-auto">
              <div className="bg-[#1C1E24]/95 rounded-t-2xl p-4 pb-safe shadow-2xl w-full">
                <div className="flex justify-center mb-3">
                  <div className="w-10 h-1 bg-white/20 rounded-full" />
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => { setIsReportModalOpen(true); setIsMoreMenuOpen(false); }}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-colors w-full"
                  >
                    <Flag size={18} className="text-red-400" />
                    <span className="text-white text-sm font-medium">Report</span>
                  </button>
                  <button
                    onClick={() => { setShowSharePanel(true); setIsMoreMenuOpen(false); }}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-colors w-full"
                  >
                    <Share2 size={18} className="text-[#C9A96E]" />
                    <span className="text-white text-sm font-medium">Share</span>
                  </button>
                  <button
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-colors w-full"
                  >
                    <X size={18} className="text-white/50" />
                    <span className="text-white text-sm font-medium">Cancel</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* REPORT MODAL */}
        {isReportModalOpen && (
          <ReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            targetId={hostUserId}
            targetType="user"
          />
        )}
      </div>
    </div>
  );
}
