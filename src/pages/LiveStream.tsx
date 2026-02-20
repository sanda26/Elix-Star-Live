import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { showToast } from '../lib/toast';
import {
  Send,
  Search,
  Heart,
  Flame,
  MessageCircle,
  Share2,
  RefreshCw,
  Mic,
  MicOff,
  Settings2,
  LogOut,
  Volume2,
  VolumeX,
  Gift,
  MoreVertical,
  Users,
  Zap,
  Trophy,
  Copy,
  AlertTriangle,
  PlusCircle,
  TrendingUp,
  Github,
  Plus,
  Check,
  Smile,
  UserPlus,
  X,
  Crown,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { GiftPanel } from '../components/GiftPanel';
import { GIFTS } from '../lib/gifts';
import { GiftOverlay } from '../components/GiftOverlay';
import GiftAnimationOverlay from '../components/GiftAnimationOverlay';
import { ChatOverlay } from '../components/ChatOverlay';
import { FaceARGift } from '../components/FaceARGift';
import { useLivePromoStore } from '../store/useLivePromoStore';
import { AvatarRing } from '../components/AvatarRing';
import { useAuthStore } from '../store/useAuthStore';
import { clearCachedCameraStream, getCachedCameraStream } from '../lib/cameraStream';
import { supabase } from '../lib/supabase';
import { LevelBadge } from '../components/LevelBadge';
import ReportModal from '../components/ReportModal';
import { RankingPanel } from '../components/RankingPanel';
import LiveAIFilters from '../components/LiveAIFilters';


type LiveMessage = {
  id: string;
  username: string;
  text: string;
  level?: number;
  isGift?: boolean;
  avatar?: string;
  isSystem?: boolean;
  membershipIcon?: string;
};

type UniverseTickerMessage = {
  id: string;
  sender: string;
  receiver: string;
};



const EMOJI_LIST = ['😀','😂','🥰','😍','🔥','💯','👏','🎉','❤️','💜','💙','⭐','🌟','✨','🙌','👑','💎','🚀','🎵','💃','🕺','😎','🤩','💪','🫶','💖'];
type LiveViewer = {
  id: string;
  username: string;
  displayName: string;
  level: number;
  avatar: string;
  country: string;
  joinedAt: number;
  isActive: boolean;
  chatFrequency: number;
  supportDays: number;
  lastVisitDaysAgo: number;
};






export default function LiveStream() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const opponentVideoRef = useRef<HTMLVideoElement>(null);
  const player3VideoRef = useRef<HTMLVideoElement>(null);
  const player4VideoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const setPromo = useLivePromoStore((s) => s.setPromo);
  const updateUser = useAuthStore((s) => s.updateUser);
  const _rawStreamId = streamId;
  const PROMOTE_LIKES_THRESHOLD_LIVE = 100;
  const _PROMOTE_LIKES_THRESHOLD_BATTLE = 50;
  
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [showRankingPanel, setShowRankingPanel] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const giftPanelOpenedAtRef = useRef(0);
  const _openGiftPanel = useCallback(() => {
    giftPanelOpenedAtRef.current = Date.now();
    setShowGiftPanel(true);
  }, []);
  const _closeGiftPanel = useCallback(() => {
    setShowGiftPanel(false);
  }, []);
  const [currentGift, setCurrentGift] = useState<string | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const isBroadcast = streamId === 'broadcast' || location.pathname === '/live/broadcast';
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [showViewerList, setShowViewerList] = useState(false);


  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isLiveSettingsOpen, setIsLiveSettingsOpen] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const user = useAuthStore((s) => s.user);
  const isBroadcaster = _rawStreamId === 'broadcast' || location.pathname === '/live/broadcast';
  const effectiveStreamId = isBroadcaster ? (user?.id || 'broadcast') : (_rawStreamId || 'broadcast');
  const formatStreamName = (id: string) =>
    id
      .split(/[-_]/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  const [hostName, setHostName] = useState('');
  const [hostAvatar, setHostAvatar] = useState('');
  const creatorName = isBroadcast
    ? user?.name || user?.username || 'Creator'
    : hostName || 'Creator';
  const myCreatorName = creatorName;
  const myAvatar = isBroadcast
    ? user?.avatar || ''
    : hostAvatar || '';
  const [opponentCreatorName, setOpponentCreatorName] = useState('');
  const viewerName = user?.username || user?.name || 'viewer_123';
  const viewerAvatar =
    user?.avatar || `https://ui-avatars.com/api/?name=&background=121212&color=C9A96E`;
  const universeGiftLabel = 'Universe';

  // FaceAR State
  const faceARCanvasRef = useRef<HTMLCanvasElement>(null);
  const [_faceARVideoEl, setFaceARVideoEl] = useState<HTMLVideoElement | null>(null);
  const [_faceARCanvasEl, setFaceARCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [_battleGiftIconFailed, _setBattleGiftIconFailed] = useState(false);

  // Handle keyboard/viewport resizing for Viewer List
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        // Calculate the part of the height covered by keyboard (or other UI)
        // This handles both iOS (keyboard overlay) and Android (resize) nuances
        const height = window.innerHeight - window.visualViewport.height;
        // Only apply if significant (keyboard likely open)
        const offset = height > 0 ? height : 0;
        document.documentElement.style.setProperty('--kb-height', `${offset}px`);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      handleResize(); // Initial check
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  // Auto-close Viewer List after 10 seconds of inactivity
  useEffect(() => {
    if (showViewerList) {
      const timer = setTimeout(() => {
        setShowViewerList(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showViewerList]);

  useEffect(() => {
    if (videoRef.current) setFaceARVideoEl(videoRef.current);
    if (faceARCanvasRef.current) setFaceARCanvasEl(faceARCanvasRef.current);
  }, [isBroadcast]);

  useEffect(() => {
    if (isBroadcast || !effectiveStreamId) return;
    (async () => {
      const { data: stream } = await supabase
        .from('live_streams')
        .select('user_id, title')
        .eq('stream_key', effectiveStreamId)
        .maybeSingle();
      if (stream?.user_id) {
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
  }, [isBroadcast, effectiveStreamId]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const run = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('coins,level,xp')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cancelled && data?.coins != null) {
        setCoinBalance(Number(data.coins));
        if (data.level != null) setUserLevel(Number(data.level));
        if (data.xp != null) setUserXP(Number(data.xp));
        if (data.level != null) updateUser({ level: Number(data.level) });
      }

      if (error) {
        return;
      }

      const { error: insertError } = await supabase
        .from('profiles')
        .insert({ user_id: user.id, coins: 0, level: 1, xp: 0 });

      if (insertError) {
        const code = (insertError as unknown as { code?: string }).code;
        const msg = insertError.message.toLowerCase();
        if (code !== '23505' && !msg.includes('duplicate') && !msg.includes('already exists')) {
          return;
        }
      }
      const retry = await supabase
        .from('profiles')
        .select('coins,level,xp')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cancelled && retry.data?.coins != null) {
        setCoinBalance(Number(retry.data.coins));
        if (retry.data.level != null) setUserLevel(Number(retry.data.level));
        if (retry.data.xp != null) setUserXP(Number(retry.data.xp));
        if (retry.data.level != null) updateUser({ level: Number(retry.data.level) });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [updateUser, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const key = effectiveStreamId;
    if (!key) return;

    if (isBroadcast) {
      (async () => {
        await supabase.from('live_streams').upsert(
          {
            stream_key: key,
            user_id: user.id,
            title: creatorName,
            is_live: true,
            viewer_count: 0,
          },
          { onConflict: 'stream_key' }
        );
      })();

      const channel = supabase
        .channel(`live_viewers_${key}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams', filter: `stream_key=eq.${key}` }, (payload: any) => {
          if (payload.new?.viewer_count != null) {
            setViewerCount(Number(payload.new.viewer_count));
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase
          .from('live_streams')
          .update({ is_live: false, viewer_count: 0 })
          .eq('stream_key', key)
          .eq('user_id', user.id)
          .then(() => {});
      };
    } else {
      // Viewer joining: increment count via SECURITY DEFINER RPC
      supabase.rpc('increment_viewer_count', { p_stream_key: key }).catch(() => {});

      // Fetch initial stream data (viewer count + host info)
      supabase
        .from('live_streams')
        .select('viewer_count, user_id, title')
        .eq('stream_key', key)
        .maybeSingle()
        .then(({ data: streamData }) => {
          if (streamData?.viewer_count != null) {
            setViewerCount(Number(streamData.viewer_count));
          }
        });

      // Subscribe to realtime updates for this stream
      const channel = supabase
        .channel(`live_viewers_${key}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams', filter: `stream_key=eq.${key}` }, (payload: any) => {
          if (payload.new?.viewer_count != null) {
            setViewerCount(Number(payload.new.viewer_count));
          }
          if (payload.new?.is_live === false) {
            showToast('Stream ended');
            navigate('/live', { replace: true });
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.rpc('decrement_viewer_count', { p_stream_key: key }).catch(() => {});
      };
    }
  }, [creatorName, effectiveStreamId, isBroadcast, user?.id]);

  // Refresh coins when gift panel opens to ensure balance is up to date
  useEffect(() => {
    if (showGiftPanel && user?.id) {
      supabase
        .from('profiles')
        .select('coins')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.coins != null) {
            setCoinBalance(Number(data.coins));
          }
        });
    }
  }, [showGiftPanel, user?.id]);

  useEffect(() => {
    if (user?.id && effectiveStreamId) {
      const today = new Date().toISOString().split('T')[0];
      const storageKey = `joined_stream_${effectiveStreamId}_${user.id}_${today}`;
      const hasJoined = localStorage.getItem(storageKey);
      if (hasJoined) {
        setHasJoinedToday(true);
      }
      
      // Load total heart count
      const heartKey = `my_heart_count_${effectiveStreamId}_${user.id}`;
      const savedHearts = localStorage.getItem(heartKey);
      if (savedHearts) {
        setMyHeartCount(parseInt(savedHearts, 10));
      }
    }
  }, [user?.id, effectiveStreamId]);

  const [isFindCreatorsOpen, setIsFindCreatorsOpen] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [hasJoinedToday, setHasJoinedToday] = useState(false);
  const [myHeartCount, setMyHeartCount] = useState(0);
  const [creatorQuery, setCreatorQuery] = useState('');
  const [creators, setCreators] = useState<{ id: string; name: string; username: string; followers: string; avatar: string; isLive: boolean }[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const [profilesRes, liveRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_url, followers_count')
            .neq('user_id', user.id)
            .order('followers_count', { ascending: false })
            .limit(100),
          supabase
            .from('live_streams')
            .select('user_id')
            .eq('is_live', true),
        ]);
        const liveUserIds = new Set((liveRes.data || []).map((l: any) => l.user_id));
        if (profilesRes.data) {
          const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
          const mapped = profilesRes.data
            .filter((p: any) => p.username)
            .map((p: any) => ({
              id: p.user_id,
              name: p.display_name || p.username || 'User',
              username: p.username || 'user',
              followers: fmt(p.followers_count ?? 0),
              avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.username || 'U')}&background=121212&color=C9A96E`,
              isLive: liveUserIds.has(p.user_id),
            }));
          mapped.sort((a: any, b: any) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));
          setCreators(mapped);
        }
      } catch { /* ignore */ }
    })();
  }, [user?.id]);

  const filteredCreators = creators.filter((c) => {
    const q = creatorQuery.trim().toLowerCase();
    if (!q) return true;
    return c.username.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  });

  // Battle Player Slots (P1 = creator, P2-P4 = invited players)
  type BattleSlot = { userId: string; name: string; status: 'empty' | 'invited' | 'accepted'; avatar: string };
  const [battleSlots, setBattleSlots] = useState<BattleSlot[]>([
    { userId: '', name: '', status: 'empty', avatar: '' },
    { userId: '', name: '', status: 'empty', avatar: '' },
    { userId: '', name: '', status: 'empty', avatar: '' },
  ]);
  const inviteTimersRef = useRef<NodeJS.Timeout[]>([]);

  const inviteCreatorToSlot = async (creatorId: string) => {
    const slotIndex = battleSlots.findIndex(s => s.status === 'empty');
    if (slotIndex === -1) return;
    if (battleSlots.some(s => s.userId === creatorId && s.status !== 'empty')) return;

    const creator = creators.find(c => c.id === creatorId);
    if (!creator) return;
    const avatar = creator.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.username)}&background=121212&color=C9A96E`;
    setBattleSlots(prev => {
      const next = [...prev];
      next[slotIndex] = { userId: creatorId, name: creator.username, status: 'invited', avatar };
      return next;
    });

    if (!user?.id) return;
    try {
      await supabase.from('notifications').insert({
        user_id: creatorId,
        type: 'battle_invite',
        title: 'Battle Invite',
        body: `@${myCreatorName} invited you to a battle!`,
        data: {
          actor_id: user.id,
          host_name: myCreatorName,
          host_avatar: myAvatar,
          stream_key: effectiveStreamId,
          slot_index: slotIndex,
        },
      });
      showToast(`Invite sent to @${creator.username}!`);
    } catch {
      showToast('Failed to send invite');
    }
  };

  // ─── INCOMING INVITE (for viewers / other broadcasters) ─────
  type PendingInvite = {
    notifId: string;
    hostName: string;
    hostAvatar: string;
    streamKey: string;
    hostUserId: string;
  };
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const chan = supabase
      .channel(`battle_invite_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const row = payload.new;
          if (row?.type === 'battle_invite') {
            setPendingInvite({
              notifId: row.id,
              hostName: row.data?.host_name || 'Someone',
              hostAvatar: row.data?.host_avatar || '',
              streamKey: row.data?.stream_key || '',
              hostUserId: row.data?.actor_id || '',
            });
          }
          if (row?.type === 'battle_accepted' && isBroadcast) {
            const acceptedUserId = row.data?.actor_id || '';
            const acceptedName = row.data?.accepted_name || '';
            const acceptedAvatar = row.data?.accepted_avatar || '';
            setBattleSlots(prev => {
              const next = [...prev];
              const idx = next.findIndex(s => s.status === 'invited' && s.userId === acceptedUserId);
              if (idx !== -1) {
                next[idx] = { userId: acceptedUserId, name: acceptedName || next[idx].name, status: 'accepted', avatar: acceptedAvatar || next[idx].avatar };
              } else {
                const nameIdx = next.findIndex(s => s.status === 'invited' && s.name === acceptedName);
                if (nameIdx !== -1) {
                  next[nameIdx] = { userId: acceptedUserId, name: acceptedName, status: 'accepted', avatar: acceptedAvatar || next[nameIdx].avatar };
                } else {
                  const emptyIdx = next.findIndex(s => s.status === 'empty');
                  if (emptyIdx !== -1) {
                    next[emptyIdx] = { userId: acceptedUserId, name: acceptedName, status: 'accepted', avatar: acceptedAvatar };
                  }
                }
              }
              return next;
            });
            showToast(`@${acceptedName} joined the battle!`);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [user?.id, isBroadcast]);

  const acceptBattleInvite = async () => {
    if (!pendingInvite || !user?.id) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', pendingInvite.notifId);
      const myUsername = user?.username || user?.name || viewerName;
      await supabase.from('notifications').insert({
        user_id: pendingInvite.hostUserId,
        type: 'battle_accepted',
        title: 'Battle Accepted',
        body: `@${myUsername} accepted your battle invite!`,
        data: {
          actor_id: user.id,
          accepted_name: myUsername,
          accepted_avatar: viewerAvatar,
          stream_key: pendingInvite.streamKey,
        },
      });
      const streamKey = pendingInvite.streamKey;
      setPendingInvite(null);
      navigate(`/live/${streamKey}`);
    } catch {
      showToast('Failed to accept invite');
    }
  };

  const declineBattleInvite = async () => {
    if (!pendingInvite) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', pendingInvite.notifId);
    } catch { /* ignore */ }
    setPendingInvite(null);
  };

  // Mute state per player pane
  const [mutedPlayers, setMutedPlayers] = useState<Record<string, boolean>>({});
  const togglePlayerMute = (player: string) => {
    setMutedPlayers(prev => ({ ...prev, [player]: !prev[player] }));
  };

  const removePlayerFromSlot = (slotIndex: number) => {
    setBattleSlots(prev => {
      const next = [...prev];
      next[slotIndex] = { userId: '', name: '', status: 'empty', avatar: '' };
      return next;
    });
  };

  const filledSlots = battleSlots.filter(s => s.status !== 'empty');
  const allFilledAccepted = filledSlots.length > 0 && filledSlots.every(s => s.status === 'accepted');
  const anySlotFilled = filledSlots.length > 0;
  const _allSlotsAccepted = allFilledAccepted;

  // ═══════════════════════════════════════════════════════════════
  // MULTI-HOST (up to 12 co-hosts) — Normal Live only, NOT battle
  // ═══════════════════════════════════════════════════════════════
  type CoHost = {
    id: string;
    name: string;
    avatar: string;
    status: 'invited' | 'accepted' | 'live';
    isMuted: boolean;
  };
  const [coHosts, setCoHosts] = useState<CoHost[]>([]);
  const [isInviteHostOpen, setIsInviteHostOpen] = useState(false);
  const [hostSearchQuery, setHostSearchQuery] = useState('');
  const [featuredHostId, setFeaturedHostId] = useState<string | null>(null);
  const coHostTimersRef = useRef<NodeJS.Timeout[]>([]);
  const MAX_CO_HOSTS = 16;

  const inviteCoHost = (creator: { name: string; avatar?: string }) => {
    if (coHosts.length >= MAX_CO_HOSTS) return;
    if (coHosts.some(h => h.name === creator.name)) return;

    const newHost: CoHost = {
      id: `host-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: creator.name,
      avatar: creator.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.name)}&background=121212&color=C9A96E`,
      status: 'invited',
      isMuted: false,
    };
    setCoHosts(prev => [...prev, newHost]);
  };

  const removeCoHost = (hostId: string) => {
    const host = coHosts.find(h => h.id === hostId);
    setCoHosts(prev => prev.filter(h => h.id !== hostId));
    if (host) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        username: 'System',
        text: `${host.name} left the co-host`,
        isSystem: true,
      }]);
    }
  };

  const toggleCoHostMute = (hostId: string) => {
    setCoHosts(prev => prev.map(h =>
      h.id === hostId ? { ...h, isMuted: !h.isMuted } : h
    ));
  };

  const liveCoHosts = coHosts.filter(h => h.status === 'live');
  const featuredHost = featuredHostId ? liveCoHosts.find(h => h.id === featuredHostId) : null;
  const smallHosts = featuredHost ? liveCoHosts.filter(h => h.id !== featuredHostId) : liveCoHosts;
  const hostGridCols = smallHosts.length <= 1 ? 1 : smallHosts.length <= 4 ? 2 : smallHosts.length <= 9 ? 3 : 4;

  const toggleFeatured = (hostId: string) => {
    setFeaturedHostId(prev => prev === hostId ? null : hostId);
  };

  const filteredHostCreators = creators.filter(c =>
    c.name.toLowerCase().includes(hostSearchQuery.trim().toLowerCase()) &&
    !coHosts.some(h => h.name === c.name)
  );

  useEffect(() => {
    return () => {
      coHostTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // Battle Mode State
  const [isBattleMode, setIsBattleMode] = useState(false);
  const [liveFilterCss, setLiveFilterCss] = useState('none');
  const [battleTime, setBattleTime] = useState(300); // 5 minutes
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [player3Score, setPlayer3Score] = useState(0);
  const [player4Score, setPlayer4Score] = useState(0);
  const [battleWinner, setBattleWinner] = useState<'me' | 'opponent' | 'player3' | 'player4' | 'draw' | null>(null);
  const [giftTarget, setGiftTarget] = useState<'me' | 'opponent' | 'player3' | 'player4'>('me');
  const lastScreenTapRef = useRef<number>(0);
  const battleScoreTapWindowRef = useRef<{ windowStart: number; count: number }>({ windowStart: 0, count: 0 });
  const lastBattleTapTimeRef = useRef<number>(0);
  const battleFreeTapUsedRef = useRef<boolean>(false);
  const spectatorTapPointsRef = useRef<number>(0);
  const SPECTATOR_MAX_TAP_POINTS = 5;
  const [spectatorTapsUsed, setSpectatorTapsUsed] = useState(0);
  const battleTripleTapRef = useRef<{ target: 'me' | 'opponent' | null; lastTapAt: number; count: number }>({
    target: null,
    lastTapAt: 0,
    count: 0,
  });
  const [battleCountdown, setBattleCountdown] = useState<number | null>(null);
  const _battleKeyboardLikeArmedRef = useRef(true);
  const [liveLikes, setLiveLikes] = useState(0);
  const [battleReadiness, setBattleReadiness] = useState(0);

  // Speed Challenge State
  // SPEED CHALLENGE
  const SPEED_CHALLENGE_ENABLED = false;
  const [speedChallengeActive, setSpeedChallengeActive] = useState(false);
  const [speedChallengeCountdown, setSpeedChallengeCountdown] = useState<number | null>(null); // 3,2,1 before start
  const [speedChallengeTime, setSpeedChallengeTime] = useState(10); // 10 seconds
  const [speedChallengeTaps, setSpeedChallengeTaps] = useState<Record<string, number>>({ me: 0, opponent: 0, player3: 0, player4: 0 });
  const speedChallengeTapsRef = useRef<Record<string, number>>({ me: 0, opponent: 0, player3: 0, player4: 0 });
  const [speedChallengeResult, setSpeedChallengeResult] = useState<string | null>(null);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const speedChallengeActiveRef = useRef(false);
  const speedMultiplierRef = useRef(1);
  const roseCountRef = useRef(0);
  const [roseCount, setRoseCount] = useState(0);

  useEffect(() => { speedChallengeActiveRef.current = speedChallengeActive; }, [speedChallengeActive]);
  useEffect(() => { speedMultiplierRef.current = speedMultiplier; }, [speedMultiplier]);

  const speedChallengeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeedChallengeRef = useRef<number>(0);
  const reachedThresholdsRef = useRef<Set<number>>(new Set());
  const [_battleGifterCoins, setBattleGifterCoins] = useState<Record<string, number>>({});
  // Track top gifters per player: { 'me': { 'username': coins }, 'opponent': {...}, ... }
  const [playerGifters, setPlayerGifters] = useState<Record<string, Record<string, number>>>({});
  const [lastGifts, setLastGifts] = useState<{ opponent: string | null; player3: string | null; player4: string | null }>({ opponent: null, player3: null, player4: null });
  const [floatingHearts, setFloatingHearts] = useState<
    Array<{ id: string; x: number; y: number; dx: number; rot: number; size: number; color: string; username?: string; avatar?: string }>
  >([]);
  const [miniProfile, setMiniProfile] = useState<null | { id?: string; username: string; avatar: string; level: number | null; coins?: number; donated?: number }>(null);
  const [showMembershipBar, setShowMembershipBar] = useState(false);
  const [showTeamStatus, setShowTeamStatus] = useState(false);
  const [showJoinAnimation, setShowJoinAnimation] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [membershipHeartActive, setMembershipHeartActive] = useState(false);
  const membershipTimerRef = useRef<NodeJS.Timeout | null>(null);

  // FAN CLUB PANEL - removed top bar, now using Sheet
  const [showFanClub, setShowFanClub] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session?.access_token}` },
        body: JSON.stringify({ creatorId: streamId, amount: 300 }),
      });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
        else navigate('/shop');
      } else {
        navigate('/shop');
      }
    } catch {
      navigate('/shop');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Auto-close Fan Club after 10 seconds of inactivity
  useEffect(() => {
    if (showFanClub) {
      const timer = setTimeout(() => {
        setShowFanClub(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showFanClub]);

  const closeMembershipBar = useCallback(() => {
    // setMembershipBarClosing(true);
    // setTimeout(() => { setShowMembershipBar(false); setMembershipBarClosing(false); }, 200);
  }, []);

  const openMembershipBar = useCallback(() => {
    if (membershipTimerRef.current) clearTimeout(membershipTimerRef.current);
    // Instead of opening the top bar, we now open the bottom sheet Fan Club
    setShowFanClub(true);
  }, [closeMembershipBar]);
  const [sessionContribution, setSessionContribution] = useState(0); // total coins gifted this session
  const [universeQueue, setUniverseQueue] = useState<UniverseTickerMessage[]>([]);
  const [currentUniverse, setCurrentUniverse] = useState<UniverseTickerMessage | null>(null);

  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareQuery, setShareQuery] = useState('');

  // 2v2: Red Team (P1+P3) vs Blue Team (P2+P4)
  const determine4PlayerWinner = useCallback(() => {
    const red = myScore + player3Score;
    const blue = opponentScore + player4Score;
    if (red === blue) return 'draw';
    // 'me' = red team wins, 'opponent' = blue team wins
    return red > blue ? 'me' : 'opponent';
  }, [myScore, opponentScore, player3Score, player4Score]);

  useEffect(() => {
    if (!isBattleMode || battleTime <= 0) return;
    const interval = setInterval(() => {
      setBattleTime(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
      // Scores only change from real taps (max 5 per user per match)
    }, 1000);
    return () => clearInterval(interval);
  }, [isBattleMode, battleTime]);

  // Determine winner when battle time reaches 0
  useEffect(() => {
    if (isBattleMode && battleTime === 0 && !battleWinner && battleCountdown === null) {
      // Only determine winner if the battle was actually started (scores exist)
      const totalScore = myScore + opponentScore + player3Score + player4Score;
      if (totalScore > 0) {
        const winner = determine4PlayerWinner();
        setBattleWinner(winner);
      }
    }
  }, [isBattleMode, battleTime, battleWinner, battleCountdown, myScore, opponentScore, player3Score, player4Score, determine4PlayerWinner]);

  const toggleBattle = useCallback(() => {
    if (isBattleMode) {
      setIsBattleMode(false);
      setBattleTime(300);
      setBattleWinner(null);
      setBattleCountdown(null);
      reachedThresholdsRef.current.clear();
      battleFreeTapUsedRef.current = false;
      spectatorTapPointsRef.current = 0;
      setSpectatorTapsUsed(0);
      battleScoreTapWindowRef.current = { windowStart: 0, count: 0 };
      battleTripleTapRef.current = { target: null, lastTapAt: 0, count: 0 };
      setMiniProfile(null);
      // Reset speed challenge
      setSpeedChallengeActive(false);
      setSpeedChallengeCountdown(null);
      setSpeedChallengeTime(10);
      setSpeedChallengeTaps({ me: 0, opponent: 0, player3: 0, player4: 0 });
      setSpeedChallengeResult(null);
      setSpeedMultiplier(1);
      // Reset invite slots
      setBattleSlots([
        { userId: '', name: '', status: 'empty', avatar: '' },
        { userId: '', name: '', status: 'empty', avatar: '' },
        { userId: '', name: '', status: 'empty', avatar: '' },
      ]);
      inviteTimersRef.current.forEach(t => clearTimeout(t));
      inviteTimersRef.current = [];
      return;
    }
    // Enter battle mode but DON'T start countdown yet - wait for invites
    setIsBattleMode(true);
    setBattleTime(0);
    setMyScore(0);
    setOpponentScore(0);
    setPlayer3Score(0);
    setPlayer4Score(0);
    setBattleWinner(null);
    setGiftTarget('me');
    setShowGiftPanel(false);
    setBattleGifterCoins({});
    setPlayerGifters({});
    setBattleCountdown(null); // Don't start countdown until all accept
    battleFreeTapUsedRef.current = false;
    spectatorTapPointsRef.current = 0;
    setSpectatorTapsUsed(0);
    battleScoreTapWindowRef.current = { windowStart: 0, count: 0 };
    battleTripleTapRef.current = { target: null, lastTapAt: 0, count: 0 };
    // Open invite panel
    setIsFindCreatorsOpen(true);
  }, [isBattleMode]);

  // No auto-start - user must press Match to begin

  useEffect(() => {
    if (!isBattleMode) return;
    if (battleCountdown == null) return;

    const tick = window.setInterval(() => {
      setBattleCountdown((prev) => {
        if (prev == null) return null;
        if (prev <= 1) {
          window.clearInterval(tick);
          setBattleTime(300);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(tick);
  }, [isBattleMode, battleCountdown]);

  const _startBattleWithCreator = (creatorId: string, creatorName: string) => {
    setOpponentCreatorName(creatorName);
    if (!isBattleMode) {
      setIsBattleMode(true);
      setBattleTime(0);
      setMyScore(0);
      setOpponentScore(0);
      setPlayer3Score(0);
      setPlayer4Score(0);
      setBattleWinner(null);
      setGiftTarget('me');
      setShowGiftPanel(false);
      setBattleGifterCoins({});
      setBattleCountdown(null);
      const params = new URLSearchParams(location.search);
      params.set('battle', '1');
      navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
    }
    inviteCreatorToSlot(creatorId);
  };

  useEffect(() => {
    if (currentUniverse || universeQueue.length === 0) return;
    const next = universeQueue[0];
    setCurrentUniverse(next);
    setUniverseQueue((prev) => prev.slice(1));
  }, [currentUniverse, universeQueue]);

  // Auto-clear universe message after 8 seconds
  useEffect(() => {
    if (!currentUniverse) return;
    const timer = setTimeout(() => {
      setCurrentUniverse(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [currentUniverse]);

  const enqueueUniverse = (sender: string) => {
    const receiver = isBattleMode
      ? giftTarget === 'me'
      ? myCreatorName
      : opponentCreatorName
      : myCreatorName;

    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setUniverseQueue((prev) => {
      const next = [...prev, { id, sender, receiver }];
      return next.slice(-12);
    });
  };

  const maybeEnqueueUniverse = (giftName: string, sender: string) => {
    if (!/univ/i.test(giftName)) return;
    enqueueUniverse(sender);
  };

  const addLiveLikes = useCallback((delta: number) => {
    if (delta <= 0) return;

    setLiveLikes((prev) => {
      const next = prev + delta;
      if (prev < PROMOTE_LIKES_THRESHOLD_LIVE && next >= PROMOTE_LIKES_THRESHOLD_LIVE) {
        setPromo({
          type: isBattleMode ? 'battle' : 'live',
          streamId: effectiveStreamId,
          likes: next,
          createdAt: Date.now(),
        });
      }
      return next;
    });
  }, [isBattleMode, effectiveStreamId, setPromo]);

  const awardBattlePoints = useCallback((target: 'me' | 'opponent' | 'player3' | 'player4', points: number, isSpeedTap?: boolean) => {
    if (!isBattleMode || battleTime <= 0 || battleWinner) return;
    
    const finalPoints = isSpeedTap && speedChallengeActiveRef.current ? points * speedMultiplierRef.current : points;
    
    if (target === 'me') {
      setMyScore((prev) => prev + finalPoints);
    } else if (target === 'opponent') {
      setOpponentScore((prev) => prev + finalPoints);
    } else if (target === 'player3') {
      setPlayer3Score((prev) => prev + finalPoints);
    } else {
      setPlayer4Score((prev) => prev + finalPoints);
    }
  }, [isBattleMode, battleTime, battleWinner]);

  const addBattleGifterCoins = (username: string, coins: number, target?: string) => {
    if (!isBattleMode) return;
    if (!username || coins <= 0) return;
    setBattleGifterCoins((prev) => ({ ...prev, [username]: (prev[username] ?? 0) + coins }));
    // Track per-player gifters
    const playerTarget = target || giftTarget;
    setPlayerGifters(prev => {
      const playerRecord = { ...(prev[playerTarget] || {}) };
      playerRecord[username] = (playerRecord[username] ?? 0) + coins;
      return { ...prev, [playerTarget]: playerRecord };
    });
  };

  // Get top 3 gifters for a player
  const getTopGifters = (player: string) => {
    const gifters = playerGifters[player] || {};
    return Object.entries(gifters)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, coins]) => ({
        name,
        coins,
        avatar: `https://ui-avatars.com/api/?name=&background=121212&color=C9A96E`,
      }));
  };

  const formatCoinsShort = (coins: number) => {
    if (coins >= 1_000_000) {
      const m = Math.round((coins / 1_000_000) * 10) / 10;
      const label = Number.isInteger(m) ? String(Math.trunc(m)) : String(m);
      return `${label}M`;
    }
    if (coins >= 1000) {
      const k = Math.round((coins / 1000) * 10) / 10;
      const label = Number.isInteger(k) ? String(Math.trunc(k)) : String(k);
      return `${label}K`;
    }
    return coins.toLocaleString();
  };

  const formatCountShort = (count: number) => {
    if (count >= 1_000_000) {
      const m = Math.round((count / 1_000_000) * 10) / 10;
      const label = Number.isInteger(m) ? String(Math.trunc(m)) : String(m);
      return `${label}M`;
    }
    if (count >= 1000) {
      const k = Math.round((count / 1000) * 10) / 10;
      const label = Number.isInteger(k) ? String(Math.trunc(k)) : String(k);
      return `${label}K`;
    }
    return String(count);
  };

  const activeViewersRef = useRef<LiveViewer[]>([]);
  const spawnHeartAt = useCallback((x: number, y: number, colorOverride?: string, likerName?: string, likerAvatar?: string) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const dx = Math.round((Math.random() * 2 - 1) * 120);
    const rot = Math.round((Math.random() * 2 - 1) * 45);
    const size = Math.round(24 + Math.random() * 12);
    const colors = ['#FF0000', '#FF2D55', '#E60026', '#DC143C', '#FF1744', '#CC0000'];
    const color = colorOverride ?? colors[Math.floor(Math.random() * colors.length)];
    
    // Check if this is a membership heart (triggered by "Joined the team")
    const isMembership = likerName === 'You' && likerAvatar === '/Icons/elix-logo.png';

    // Pick a random viewer name if none provided
    let username = likerName;
    let avatar = likerAvatar;
    const viewers = activeViewersRef.current;
    if (!username && viewers.length > 0) {
      const randomViewer = viewers[Math.floor(Math.random() * viewers.length)];
      username = randomViewer.displayName;
      avatar = randomViewer.avatar;
    }

    setFloatingHearts((prev) => [...prev.slice(-40), { id, x, y, dx, rot, size, color, username, avatar, isMembership }]);
    window.setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
    }, isMembership ? 2000 : 500); // Increased timeout for membership hearts
  }, []);

  const spawnHeartFromClient = (clientX: number, clientY: number, colorOverride?: string, likerName?: string, likerAvatar?: string) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    spawnHeartAt(clientX - rect.left, clientY - rect.top, colorOverride, likerName, likerAvatar);
  };

  const spawnHeartAtSide = useCallback((target: 'me' | 'opponent') => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = rect.width * (target === 'me' ? 0.25 : 0.75);
    const y = rect.height * 0.62;
    spawnHeartAt(x, y, '#FF2D55');
  }, [spawnHeartAt]);

  // Battle Tap Logic: spectator taps broadcaster side → 5 points, once per match
  const handleBattleTap = useCallback((target: 'me' | 'opponent' | 'player3' | 'player4') => {
    if (!isBattleMode || battleWinner || battleTime <= 0) return;
    if (target !== 'me') return;
    if (spectatorTapPointsRef.current > 0) return;

    setGiftTarget(target);
    spectatorTapPointsRef.current = 1;
    setSpectatorTapsUsed(1);
    awardBattlePoints('me', 5, false);

  }, [battleWinner, battleTime, awardBattlePoints, isBattleMode]);

  // ─── SPEED CHALLENGE LOGIC ───
  const startSpeedChallenge = useCallback(() => {
    if (!SPEED_CHALLENGE_ENABLED) return; // Guard
    if (speedChallengeActive || speedChallengeCountdown !== null || !isBattleMode || battleWinner) return;
    setSpeedChallengeTaps({ me: 0, opponent: 0, player3: 0, player4: 0 });
    setSpeedChallengeResult(null);
    // Only reset multiplier to 1 if it's not already set (e.g. by score threshold)
    setSpeedMultiplier(prev => prev > 1 ? prev : 1);
    setSpeedChallengeCountdown(3); // 3, 2, 1 countdown
  }, [speedChallengeActive, speedChallengeCountdown, isBattleMode, battleWinner, SPEED_CHALLENGE_ENABLED]);

  // Auto-start speed challenge when 10+ viewers are active, at ~90s intervals
  useEffect(() => {
    if (!SPEED_CHALLENGE_ENABLED) return; // Guard
    if (!isBattleMode || battleWinner || battleTime <= 0) return;
    if (speedChallengeActive || speedChallengeCountdown !== null) return;
    const timeSinceLast = (300 - battleTime) - lastSpeedChallengeRef.current;
    const viewerCount = activeViewersRef.current.length;
    if (viewerCount >= 10 && timeSinceLast >= 60) {
      lastSpeedChallengeRef.current = 300 - battleTime;
      startSpeedChallenge();
    }
  }, [battleTime, isBattleMode, battleWinner, speedChallengeActive, speedChallengeCountdown, startSpeedChallenge, SPEED_CHALLENGE_ENABLED]);

  // Also trigger at fixed moments: 3:00 and 2:00
  useEffect(() => {
    if (!SPEED_CHALLENGE_ENABLED) return; // Guard
    if (!isBattleMode || battleWinner) return;
    if (battleTime === 300 || battleTime === 120) {
      startSpeedChallenge();
    }
  }, [battleTime, isBattleMode, battleWinner, startSpeedChallenge, SPEED_CHALLENGE_ENABLED]);

  // Speed challenge countdown: 3, 2, 1 → GO
  useEffect(() => {
    if (speedChallengeCountdown === null) return;
    if (speedChallengeCountdown <= 0) {
      // Start the challenge
      setSpeedChallengeActive(true);
      setSpeedChallengeTime(60);
      setSpeedChallengeCountdown(null);
      // Removed automatic closing of gift panel - let user decide
      return;
    }
    const t = setTimeout(() => setSpeedChallengeCountdown(prev => (prev ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [speedChallengeCountdown]);

  // Speed challenge timer: 10 → 0
  useEffect(() => {
    if (!speedChallengeActive) return;
    if (speedChallengeTime <= 0) {
      // Challenge ended - determine winner
      setSpeedChallengeActive(false);

      // Read taps from ref (avoids stale closure + avoids dependency on taps object)
      const finalTaps = speedChallengeTapsRef.current;
      const entries = Object.entries(finalTaps).filter(([k]) => {
        if (k === 'me') return true;
        if (k === 'opponent') return battleSlots[0].status === 'accepted';
        if (k === 'player3') return battleSlots[1].status === 'accepted';
        if (k === 'player4') return battleSlots[2].status === 'accepted';
        return false;
      });
      if (entries.length > 0) {
        const maxTaps = Math.max(...entries.map(([, v]) => v));
        const winners = entries.filter(([, v]) => v === maxTaps);
        if (winners.length > 1 || maxTaps === 0) {
          setSpeedChallengeResult('DRAW!');
        } else {
          const winnerKey = winners[0][0];
          const names: Record<string, string> = { me: myCreatorName, opponent: opponentCreatorName || 'P2', player3: battleSlots[1]?.name || 'P3', player4: battleSlots[2]?.name || 'P4' };
          setSpeedChallengeResult(`${names[winnerKey]} wins!`);
        }
        // Auto-clear result after 3s
        setTimeout(() => setSpeedChallengeResult(null), 3000);
      }
      setSpeedMultiplier(1);
      return;
    }
    const t = setTimeout(() => setSpeedChallengeTime(prev => prev - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedChallengeActive, speedChallengeTime]);


  // Auto-start speed challenge when score thresholds are reached
  useEffect(() => {
    if (!SPEED_CHALLENGE_ENABLED || !isBattleMode || battleWinner) return;
    
    const totalScore = myScore + opponentScore + player3Score + player4Score;
    
    // Check thresholds: 500 -> x2, 1000 -> x3, 2000 -> x5
    let targetMultiplier = 1;
    let threshold = 0;
    if (totalScore >= 2000) { targetMultiplier = 5; threshold = 2000; }
    else if (totalScore >= 1000) { targetMultiplier = 3; threshold = 1000; }
    else if (totalScore >= 500) { targetMultiplier = 2; threshold = 500; }
    
    if (targetMultiplier > 1 && !speedChallengeActive && speedChallengeCountdown === null) {
      // Only trigger if we haven't reached this specific threshold yet
      if (!reachedThresholdsRef.current.has(threshold)) {
        reachedThresholdsRef.current.add(threshold);
        setSpeedMultiplier(targetMultiplier);
        startSpeedChallenge();
      }
    }
  }, [myScore, opponentScore, player3Score, player4Score, isBattleMode, battleWinner, speedChallengeActive, speedChallengeCountdown, speedMultiplier, startSpeedChallenge]);

  // Rose trigger effect
  useEffect(() => {
    if (!SPEED_CHALLENGE_ENABLED || !isBattleMode || battleWinner) return;
    if (speedChallengeActive || speedChallengeCountdown !== null) return;

    // Trigger x2 challenge if 30 roses are reached, x3 if 60, x5 if 100
    let targetMultiplier = 1;
    let threshold = 0;
    if (roseCount >= 100) { targetMultiplier = 5; threshold = 10000; } // Using high threshold values to avoid conflict with score thresholds
    else if (roseCount >= 60) { targetMultiplier = 3; threshold = 6000; }
    else if (roseCount >= 30) { targetMultiplier = 2; threshold = 3000; }

    if (targetMultiplier > 1) {
      if (!reachedThresholdsRef.current.has(threshold)) {
        reachedThresholdsRef.current.add(threshold);
        setSpeedMultiplier(targetMultiplier);
        startSpeedChallenge();
      }
    }
  }, [roseCount, isBattleMode, battleWinner, speedChallengeActive, speedChallengeCountdown, startSpeedChallenge]);

  // Auto-cycle multiplier during speed challenge (changes every 2-3s) - DISABLED to follow user's score-based rule
  /*
  useEffect(() => {
    if (!speedChallengeActive) {
      setSpeedMultiplier(1);
      return;
    }
    const multipliers = [2, 3, 5];
    const cycle = () => {
      const next = multipliers[Math.floor(Math.random() * multipliers.length)];
      setSpeedMultiplier(next);
    };
    cycle(); // Start with a random multiplier
    const interval = setInterval(cycle, 2000 + Math.random() * 1000);
    return () => clearInterval(interval);
  }, [speedChallengeActive]);
  */

  useEffect(() => {
    if (!isBattleMode) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (battleWinner) return;

      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLElement) {
        const tag = activeEl.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || activeEl.isContentEditable) return;
      }

      const key = e.key;
      const code = e.code;

      if (key === 'ArrowLeft' || key === 'a' || key === 'A' || code === 'Numpad4') {
        e.preventDefault();
        handleBattleTap('me');
        spawnHeartAtSide('me');
        addLiveLikes(1);
        return;
      }

      if (key === 'ArrowRight' || key === 'd' || key === 'D' || code === 'Numpad6') {
        e.preventDefault();
        spawnHeartAtSide('opponent');
        addLiveLikes(1);
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBattleMode, battleWinner, handleBattleTap, spawnHeartAtSide, addLiveLikes]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldStartBattle = params.get('battle') === '1';
    if (shouldStartBattle && !isBattleMode) {
      toggleBattle();
    }
  }, [location.search, isBattleMode, toggleBattle]);

  useEffect(() => {
    if (!isBroadcast) return;

    let cancelled = false;

    let keepStreamAliveOnCleanup = false;

    const stop = () => {
      const current = cameraStreamRef.current;
      if (!current) return;
      current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    };

    const start = async () => {
      try {
        setCameraError(null);

        if (cameraFacing !== 'user') {
          clearCachedCameraStream();
        }

        const cached = getCachedCameraStream();
        if (cached) {
          keepStreamAliveOnCleanup = true;
          cameraStreamRef.current = cached;
          cached.getAudioTracks().forEach((t) => (t.enabled = !isMicMuted));
          if (videoRef.current) {
            videoRef.current.srcObject = cached;
            videoRef.current.play().catch(() => {});
          }
          return;
        }

        stop();

        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: cameraFacing,
            },
            audio: true,
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: cameraFacing,
              },
              audio: false,
            });
          } catch {
            setCameraError('Camera access denied');
            return;
          }
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        cameraStreamRef.current = stream;
        stream.getAudioTracks().forEach((t) => (t.enabled = !isMicMuted));

        // Set camera zoom to minimum for widest view
        try {
          const vTrack = stream.getVideoTracks()[0];
          const caps = vTrack?.getCapabilities?.() as Record<string, { min?: number; max?: number }>;
          if (caps?.zoom) {
            await vTrack.applyConstraints({ advanced: [{ zoom: caps.zoom.min } as MediaTrackConstraintSet] });
          }
        } catch { /* zoom not supported */ }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        setCameraError('Camera access denied');
      }
    };

    start();

    return () => {
      cancelled = true;
      if (!keepStreamAliveOnCleanup) stop();
    };
  }, [isBattleMode, isBroadcast, cameraFacing]);

  useEffect(() => {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !isMicMuted));
  }, [isMicMuted]);

  const [activeViewers, setActiveViewers] = useState<LiveViewer[]>([]);
  useEffect(() => { activeViewersRef.current = activeViewers; }, [activeViewers]);
  useEffect(() => { speedChallengeTapsRef.current = speedChallengeTaps; }, [speedChallengeTaps]);


  const [giftQueue, setGiftQueue] = useState<string[]>([]);
  const [isPlayingGift, setIsPlayingGift] = useState(false);
  const [lastSentGift, setLastSentGift] = useState<typeof GIFTS[0] | null>(null);
  const [userLevel, setUserLevel] = useState(1);


  const [userXP, setUserXP] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [showComboButton, setShowComboButton] = useState(false);
  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [activeFaceARGift, setActiveFaceARGift] = useState<
    | { type: 'crown' | 'glasses' | 'mask' | 'ears' | 'hearts' | 'stars'; color?: string }
    | null
  >(null);

  const maybeTriggerFaceARGift = (gift: typeof GIFTS[0]) => {
    const mapping: Record<string, { type: 'crown' | 'glasses' | 'mask' | 'ears' | 'hearts' | 'stars'; color?: string } | undefined> = {
      face_ar_crown: { type: 'crown', color: '#FFD700' },
      face_ar_glasses: { type: 'glasses', color: '#00D4FF' },
      face_ar_hearts: { type: 'hearts', color: '#FF3B7A' },
      face_ar_mask: { type: 'mask', color: '#7C3AED' },
      face_ar_ears: { type: 'ears', color: '#22C55E' },
      face_ar_stars: { type: 'stars', color: '#F59E0B' },
    };

    const next = mapping[gift.id];
    if (!next) return;
    setActiveFaceARGift(next);
  };

  // Queue Processing
  useEffect(() => {
    if (!isPlayingGift && giftQueue.length > 0) {
        const nextGift = giftQueue[0];
        setCurrentGift(nextGift);
        setIsPlayingGift(true);
        setGiftQueue(prev => prev.slice(1));
    }
  }, [giftQueue, isPlayingGift]);

  // Handle gift animation end
  const handleGiftEnded = () => {
      setCurrentGift(null);
      setIsPlayingGift(false);
  };

  const handleSendGift = async (gift: typeof GIFTS[0]) => {
    if (!gift) return;

    try {
      // Allow everyone to spend if they have coins locally (which we just set to max)
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
            if (msg.includes('insufficient_funds')) {
              setShowGiftPanel(false);
              return;
            }
            setCoinBalance(prev => Math.max(0, prev - gift.coins));
          } else {
            const row = Array.isArray(data) ? data[0] : data;
            if (row?.new_balance != null) {
              setCoinBalance(Number(row.new_balance));
            }
            if (row?.new_level != null) {
              const updatedLevel = Number(row.new_level);
              setUserLevel(updatedLevel);
              updateUser({ level: updatedLevel });
              newLevel = updatedLevel;
            }
            if (row?.new_xp != null) {
              setUserXP(Number(row.new_xp));
            }
          }
        } catch {
          // Fallback: deduct locally
          setCoinBalance(prev => Math.max(0, prev - gift.coins));
        }

        // Update level/XP locally
        const xpGained = gift.coins;
        let currentXP = userXP + xpGained;
        let currentLevel = userLevel;
        while (true) {
          const xpNeeded = currentLevel * 1000;
          if (currentXP >= xpNeeded && currentLevel < 150) {
            currentLevel++;
            currentXP -= xpNeeded;
          } else {
            break;
          }
        }
        setUserLevel(currentLevel);
        setUserXP(currentXP);
        updateUser({ level: currentLevel });
        newLevel = currentLevel;

        // Sync level/xp to DB
        supabase.from('profiles')
          .update({ level: currentLevel, xp: currentXP })
          .eq('user_id', user.id)
          .then(() => {});
      } else {
        setCoinBalance(prev => Math.max(0, prev - gift.coins));
      }

      // Track session contribution for membership
      setSessionContribution(prev => prev + gift.coins);

      maybeEnqueueUniverse(gift.name, viewerName);
      addBattleGifterCoins(viewerName, gift.coins);

      // Rose trigger for Speed Challenge
      if (gift.name.toLowerCase().includes('rose')) {
        roseCountRef.current += 1;
        setRoseCount(roseCountRef.current);
      }

      setShowGiftPanel(false);

      if (isBroadcast && !isBattleMode) {
        maybeTriggerFaceARGift(gift);
      }
      
      // Always queue the video animation for the sender/viewer to see immediate feedback
      if (gift.video) {
        setGiftQueue(prev => [...prev, gift.video]);
      }
      
      // Add to chat
      const giftMsg = {
          id: Date.now().toString(),
          username: viewerName,
          text: `Sent a ${gift.name}`,
          isGift: true,
          level: newLevel,
          avatar: viewerAvatar,
      };
      setMessages(prev => [...prev, giftMsg]);


      // Handle Combo Logic
      setLastSentGift(gift);
      setComboCount(1);
      setShowComboButton(true);
      resetComboTimer();
    } catch (error) {

    }
  };

  const handleShare = async () => {
    setShowSharePanel(true);
  };

  const toggleMic = () => {
    const next = !isMicMuted;
    setIsMicMuted(next);
    const stream = cameraStreamRef.current;
    if (stream) stream.getAudioTracks().forEach((t) => (t.enabled = !next));
  };

  const flipCamera = async () => {
    if (!isBroadcast) return;
    setCameraFacing((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const resetComboTimer = () => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => {
          setShowComboButton(false);
          setComboCount(0);
          setLastSentGift(null);
      }, 5000); // 5 seconds to combo
  };

  const handleComboClick = async () => {
      if (!lastSentGift) return;
      
      // Check balance
      if (coinBalance < lastSentGift.coins) {
        showToast("Not enough coins!");
        return;
      }

      let newLevel = userLevel;
      if (user?.id) {
        try {
          const { data, error } = await supabase.rpc('send_stream_gift', {
            p_stream_key: effectiveStreamId,
            p_gift_id: lastSentGift.id,
          });

          if (error) {
            const msg = typeof error.message === 'string' ? error.message : '';
            if (msg.includes('insufficient_funds')) {
              showToast('Not enough coins');
              return;
            }
            setCoinBalance(prev => Math.max(0, prev - lastSentGift.coins));
          } else {
            const row = Array.isArray(data) ? data[0] : data;
            if (row?.new_balance != null) setCoinBalance(Number(row.new_balance));
            if (row?.new_level != null) {
              newLevel = Number(row.new_level);
              setUserLevel(newLevel);
              updateUser({ level: newLevel });
            }
            if (row?.new_xp != null) setUserXP(Number(row.new_xp));
          }
        } catch {
          setCoinBalance(prev => Math.max(0, prev - lastSentGift.coins));
        }
      } else {
        setCoinBalance(prev => Math.max(0, prev - lastSentGift.coins));
      }

      // Track session contribution for membership
      setSessionContribution(prev => prev + lastSentGift.coins);

      maybeEnqueueUniverse(lastSentGift.name, viewerName);
      addBattleGifterCoins(viewerName, lastSentGift.coins);

      // Rose trigger for Speed Challenge
      if (lastSentGift.name.toLowerCase().includes('rose')) {
        roseCountRef.current += 1;
        setRoseCount(roseCountRef.current);
      }

      if (isBroadcast && !isBattleMode) {
        maybeTriggerFaceARGift(lastSentGift);
      }
      
      // Always queue the video animation for the sender/viewer to see immediate feedback
      if (lastSentGift.video) {
        setGiftQueue(prev => [...prev, lastSentGift.video]);
      }
      
      // Add to chat
      const giftMsg = {
          id: Date.now().toString(),
          username: viewerName,
          text: `Sent a ${lastSentGift.name}`,
          isGift: true,
          level: newLevel,
          avatar: viewerAvatar,
      };
      setMessages(prev => [...prev, giftMsg]);


      // Handle Combo Logic
      setComboCount(prev => prev + 1);
      resetComboTimer();
  };


  const handleSendMessage = (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim()) return;
      
      const newMsg = {
          id: Date.now().toString(),
          username: viewerName,
          text: inputValue,
          level: userLevel,
          avatar: viewerAvatar,
      };
      setMessages(prev => [...prev, newMsg]);
      setInputValue('');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const stopBroadcast = () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      clearCachedCameraStream();
      navigate('/feed', { replace: true });
  };

  const handleScreenTap = (e?: React.MouseEvent | React.TouchEvent) => {
    // 1. Spawn visual heart at tap location
    if (e) {
      let clientX, clientY;
      // Handle both mouse and touch events
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }

      if (clientX !== undefined && clientY !== undefined) {
        spawnHeartFromClient(clientX, clientY, undefined, myCreatorName, myAvatar);
      }
    } else {
      // Fallback for keyboard or other triggers
      spawnHeartAtSide('me');
    }

    // 2. Battle Logic: handled by handleBattleTap on individual player buttons
  };

  const handleLikeTap = (e?: React.MouseEvent | React.TouchEvent) => {
    // Only spawn heart and add like if NOT in battle mode (or explicit chat tap)
    if (e) {
      let clientX, clientY;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }
      if (clientX !== undefined && clientY !== undefined) {
        spawnHeartFromClient(clientX, clientY, undefined, myCreatorName, myAvatar);
      }
    }
    addLiveLikes(1);
  };

  const openMiniProfile = (username: string, coins?: number) => {
    const avatar = username === myCreatorName
      ? myAvatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=121212&color=C9A96E`;
    const level = username === myCreatorName ? userLevel : null;
    const donated = username === myCreatorName ? sessionContribution : 0;
    setMiniProfile({ username, avatar, level, coins, donated });
  };

  const closeMiniProfile = () => setMiniProfile(null);

  const _startBattleMatch = () => {
    if (!isBattleMode) return;
    setMyScore(0);
    setOpponentScore(0);
    setBattleWinner(null);
    setBattleGifterCoins({});
    battleFreeTapUsedRef.current = false;
    spectatorTapPointsRef.current = 0;
    setSpectatorTapsUsed(0);
    battleScoreTapWindowRef.current = { windowStart: 0, count: 0 };
    setBattleTime(0);
    setBattleCountdown(3);
  };

  const _closeBattleMatch = () => {
    if (!isBattleMode) return;
    setBattleCountdown(null);
    setBattleTime(0);
    const winner = determine4PlayerWinner();
    setBattleWinner(winner);
  };

  // 2v2 Team Scores: Red Team (P1 + P3) vs Blue Team (P2 + P4)
  const redTeamScore = myScore + player3Score;
  const blueTeamScore = opponentScore + player4Score;
  const totalScore = redTeamScore + blueTeamScore;
  const leftPctRaw = totalScore > 0 ? (redTeamScore / totalScore) * 100 : 50;
  const leftPct = Math.max(3, Math.min(97, leftPctRaw));
  const universeText = currentUniverse
    ? `${currentUniverse.sender} sent ${universeGiftLabel} to ${currentUniverse.receiver}`
    : '';
  const _universeDurationSeconds = Math.max(6, Math.min(16, universeText.length * 0.12));
  const _isLiveNormal = isBroadcast && !isBattleMode;
  const activeLikes = liveLikes;

  return (
    <div className="flex items-start justify-center min-h-[100dvh] h-[100dvh] bg-[#13151A]">
      <div className="relative w-full h-full bg-[#13151A] overflow-hidden border-none">
        <div className="h-full w-full relative">
        {/* BACKGROUND: VIDEO AREA (Unified frame) */}
        <div className="absolute inset-0 z-0 bg-[#13151A] overflow-hidden">
          <div className="video-zone relative w-full h-full">
            <div ref={stageRef} className="relative w-full h-full">
            {/* FLOATING HEARTS */}
            {floatingHearts.map((h) => (
              <div
                key={h.id}
                className="absolute elix-heart-float z-[200] flex items-center gap-1.5"
                style={{
                  left: h.x,
                  top: h.y,
                  '--elix-heart-dx': '0px',
                  '--elix-heart-rot': '0deg',
                } as React.CSSProperties}
              >
                <svg width={h.size} height={h.size} viewBox="0 0 24 24" fill={h.color} stroke="none" className="flex-shrink-0">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                {h.username && (
                  <span className="text-[#C8CCD4] text-[11px] font-bold whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                    {h.username}
                  </span>
                )}
              </div>
            ))}
            
            {/* Base Video Layer */}
        {!isBattleMode && (
          <div
            className="relative w-full h-full"
            style={{ filter: liveFilterCss !== 'none' ? liveFilterCss : undefined }}
            onPointerDown={(e) => {
              if (isBattleMode && isBroadcast) return;
              if (e.target instanceof Element) {
                const interactive = e.target.closest('button, a, input, textarea, select, [role="button"]');
                if (interactive) return;
              }
              // Normal Like Tap
              handleLikeTap(e);
              
              const now = Date.now();
              const last = lastScreenTapRef.current;
              lastScreenTapRef.current = now;
              if (now - last <= 320) {
                handleComboClick();
              }
            }}
          >
            {/* Main broadcaster camera / Viewer placeholder */}
            {isBroadcast ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
            ) : (
              <div className="w-full h-full bg-[#13151A] flex flex-col items-center justify-center relative">
                {myAvatar ? (
                  <img src={myAvatar} alt="" className="w-28 h-28 rounded-full object-cover border-2 border-[#C9A96E]/40 mb-4 opacity-80" />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-[#1C1E24] border-2 border-[#C9A96E]/30 flex items-center justify-center mb-4">
                    <span className="text-4xl font-black text-[#C9A96E]/60">{creatorName.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <p className="text-white font-bold text-lg">{creatorName}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white/50 text-xs font-semibold">LIVE</span>
                </div>
                <div className="absolute inset-0 pointer-events-none" style={{background: 'radial-gradient(circle at center 40%, rgba(201,169,110,0.06) 0%, transparent 60%)'}} />
              </div>
            )}

            {isBroadcast && activeFaceARGift && (
              <>
                <canvas
                  ref={faceARCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
                <FaceARGift
                  giftType={activeFaceARGift.type}
                  color={activeFaceARGift.color || '#C9A96E'}
                />
              </>
            )}

            {isBroadcast && cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#13151A] text-white font-bold">
                {cameraError}
              </div>
            )}

            {/* ═══ MULTI-HOST GRID — between header and chat ═══ */}
            {isBroadcast && liveCoHosts.length > 0 && !isBattleMode && (
              <div
                className="absolute left-0 right-0 z-[15] pointer-events-none"
                style={{
                  top: 'calc(env(safe-area-inset-top, 0px) + 85px)',
                  bottom: 'calc(25dvh + 55px + env(safe-area-inset-bottom, 0px) + 3mm)',
                }}
              >
                {/* FEATURED LAYOUT: 1 big on left + small grid on right (when 9+ hosts and one is featured) */}
                {featuredHost ? (
                  <div className="w-full h-full flex gap-[2px] p-1 pointer-events-auto">
                    {/* Featured host — left half */}
                    <div className="w-1/2 h-full relative overflow-hidden rounded-xl bg-[#13151A] border-2 border-[#C9A96E]/50 shadow-lg">
                      <img src={featuredHost.avatar} alt={featuredHost.name} className="w-full h-full object-cover" />
                      <img src="/Icons/Profile icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
                        <Crown size={10} className="text-white" />
                        <span className="text-white text-[11px] font-bold truncate max-w-[80px]">{featuredHost.name}</span>
                      </div>
                      {featuredHost.isMuted && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center">
                          <MicOff size={10} className="text-white" />
                        </div>
                      )}
                      <button onClick={() => removeCoHost(featuredHost.id)} className="absolute top-2 left-2 w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center pointer-events-auto">
                        <X size={10} className="text-black" />
                      </button>
                      <button onClick={() => toggleFeatured(featuredHost.id)} className="absolute top-2 right-10 px-2 py-1 rounded-full bg-black/60 flex items-center gap-1 pointer-events-auto">
                        <span className="text-white text-[8px] font-bold">Minimize</span>
                      </button>
                      <button onClick={() => toggleCoHostMute(featuredHost.id)} className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center pointer-events-auto">
                        {featuredHost.isMuted ? <MicOff size={12} className="text-red-400" /> : <Mic size={12} className="text-white" />}
                      </button>
                    </div>

                    {/* Small hosts — right half grid */}
                    <div className="w-1/2 h-full overflow-y-auto no-scrollbar">
                      <div
                        className="grid gap-[2px] h-full"
                        style={{
                          gridTemplateColumns: `repeat(${smallHosts.length <= 4 ? 2 : 3}, 1fr)`,
                          gridAutoRows: 'min-content',
                        }}
                      >
                        {smallHosts.map(host => (
                          <div key={host.id} className="relative overflow-hidden rounded-lg bg-[#13151A] border border-white/10 aspect-square">
                            <img src={host.avatar} alt={host.name} className="w-full h-full object-cover" />
                            <img src="/Icons/Profile icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1]" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                            <div className="absolute bottom-0.5 left-0.5 bg-black/60 backdrop-blur-sm rounded-full px-1 py-0.5">
                              <span className="text-white text-[7px] font-bold truncate block max-w-[40px]">{host.name}</span>
                            </div>
                            {host.isMuted && (
                              <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-red-500/80 flex items-center justify-center">
                                <MicOff size={6} className="text-white" />
                              </div>
                            )}
                            <button onClick={() => removeCoHost(host.id)} className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-red-500/80 flex items-center justify-center pointer-events-auto">
                              <X size={6} className="text-black" />
                            </button>
                            <button onClick={() => toggleFeatured(host.id)} className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center pointer-events-auto" title="Make featured">
                              <Crown size={8} className="text-white/60" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* NORMAL LAYOUT: equal square tiles in grid */
                  <div className="w-full h-full flex items-start justify-center p-1 pointer-events-auto overflow-y-auto no-scrollbar">
                    <div
                      className="grid gap-[2px] w-full"
                      style={{
                        gridTemplateColumns: `repeat(${hostGridCols}, 1fr)`,
                      }}
                    >
                      {liveCoHosts.map(host => (
                        <div key={host.id} className="relative overflow-hidden rounded-xl bg-[#13151A] border border-white/10 shadow-lg aspect-square">
                          <img src={host.avatar} alt={host.name} className="w-full h-full object-cover" />
                          <img src="/Icons/Profile icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1]" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />
                          <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">
                            <span className="text-white text-[9px] font-bold truncate max-w-[50px]">{host.name}</span>
                          </div>
                          {host.isMuted && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center">
                              <MicOff size={8} className="text-white" />
                            </div>
                          )}
                          <button onClick={() => removeCoHost(host.id)} className="absolute top-1 left-1 w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center pointer-events-auto">
                            <X size={8} className="text-black" />
                          </button>
                          <button onClick={() => toggleFeatured(host.id)} className="absolute top-1 right-7 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center pointer-events-auto" title="Make big">
                            <Crown size={10} className="text-white/60" />
                          </button>
                          <button onClick={() => toggleCoHostMute(host.id)} className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center pointer-events-auto">
                            {host.isMuted ? <MicOff size={10} className="text-red-400" /> : <Mic size={10} className="text-white" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Battle Split Screen Overlay - Shows ONLY when in battle mode */}
        {isBattleMode && (
          <div
            className={`absolute inset-0 z-[80] flex flex-col ${isBroadcast ? 'pointer-events-none' : ''}`}
            style={{ paddingTop: isBroadcast ? '90px' : '90px', paddingBottom: isBroadcast ? '305px' : undefined }}
            onClick={(e) => {
              if (isBroadcast) return;
              e.stopPropagation();
              handleScreenTap(e);
            }}
          >
            {battleCountdown != null && (
              <div className="absolute inset-0 z-[260] pointer-events-none flex items-center justify-center">
                {/* LUXURY BATTLE COUNTDOWN */}
                <div className="w-32 h-32 flex items-center justify-center animate-luxury-pulse relative">
                  <div className="text-white text-6xl font-black tabular-nums relative z-10 drop-shadow-[0_0_20px_rgba(230,179,106,1)]">{battleCountdown}</div>
                </div>
              </div>
            )}





      {/* ═══ SPEED CHALLENGE OVERLAY ═══ */}
      {SPEED_CHALLENGE_ENABLED && speedChallengeCountdown !== null && (
              <div className="absolute inset-x-0 bottom-32 z-[270] pointer-events-none flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl bg-[#13151A]/60 backdrop-blur-xl border border-[#C9A96E]/30 shadow-[0_0_30px_rgba(230,179,106,0.2)]">
                  <span className="text-white text-[12px] font-bold uppercase tracking-widest">
                    Speed Challenge {speedMultiplier > 1 ? `x${speedMultiplier}` : ''}
                  </span>
                  <div className="text-white text-7xl font-black tabular-nums drop-shadow-[0_0_30px_rgba(230,179,106,1)] animate-pulse">
                    {speedChallengeCountdown}
                  </div>
                  <span className="text-white/60 text-[10px] font-semibold">Get ready to tap!</span>
                </div>
              </div>
            )}



            {SPEED_CHALLENGE_ENABLED && speedChallengeResult && !speedChallengeActive && (
              <div className="absolute inset-x-0 bottom-24 z-[270] pointer-events-none flex items-center justify-center">
                <div className="flex flex-col items-center gap-1 px-6 py-3 rounded-xl bg-[#13151A]/70 backdrop-blur-md border border-[#C9A96E]/30 shadow-[0_0_20px_rgba(230,179,106,0.3)]">
                  <span className="text-white text-[10px] font-bold uppercase tracking-widest">⚡ Speed Challenge Result</span>
                  <span className="text-white text-lg font-black drop-shadow-[0_0_15px_rgba(230,179,106,0.8)] animate-bounce">{speedChallengeResult}</span>
                </div>
              </div>
            )}

            {/* Dynamic Battle Grid: 2-split or 4-split based on players */}
            {(() => {
              const is4Player = battleSlots[1].status !== 'empty' || battleSlots[2].status !== 'empty';
              return (
                <div className={`relative w-full flex-none flex flex-col ${is4Player ? 'aspect-square' : 'h-[42dvh]'}`}>
                  {/* Fan Club Button - Left of Battle Bar */}
                  <div className="absolute top-2 left-[20%] -translate-x-1/2 z-30 pointer-events-auto">
                    {/* Fan Club Removed */}
                  </div>

                  {/* Score Bar on top - Red vs Blue */}
                  <button
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (isBroadcast) {
                        toggleBattle(); 
                      } else {
                        // For spectators: Tap on bar -> Like
                       spawnHeartFromClient(e.clientX, e.clientY);
                       // Do not add live likes on battle bar tap
                       
                      }
                    }}
                    className="relative z-20 w-full h-4 overflow-hidden shadow-2xl pointer-events-auto flex-none cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <div className="absolute inset-0 flex">
                      <div className="h-full transition-all duration-500 ease-out" style={{ width: `${leftPct}%`, backgroundImage: 'linear-gradient(90deg, #DC143C, #FF1744, #C41E3A)' }} />
                      <div className="h-full flex-1 transition-all duration-500 ease-out" style={{ backgroundImage: 'linear-gradient(90deg, #1E90FF, #4169E1, #0047AB)' }} />
                    </div>
                    <div className="relative z-10 h-full flex items-center justify-between px-2">
                      <div className="text-white font-black text-[8px] tabular-nums">{redTeamScore.toLocaleString()}</div>
                      
                      {/* Battle Timer with VS */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1">
                        <span className="text-white text-[10px] font-black italic">VS</span>
                        <div className="px-1.5 py-0.5 rounded bg-[#13151A]/50 backdrop-blur-sm border border-[#C9A96E]/30">
                          <span className="text-white text-[9px] font-black tabular-nums leading-none">
                            {formatTime(battleTime)}
                          </span>
                        </div>
                      </div>

                      <div className="text-white font-black text-[8px] tabular-nums">{blueTeamScore.toLocaleString()}</div>
                    </div>
                  </button>

                  {/* Spectator Tap Indicator: 1 tap = 5 pts, then done */}
                  {!isBroadcast && battleTime > 0 && !battleWinner && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#13151A]/70 backdrop-blur-md border border-[#C9A96E]/30">
                        <span className={`text-[9px] font-bold ${spectatorTapsUsed > 0 ? 'text-white/40' : 'text-white'}`}>
                          {spectatorTapsUsed > 0 ? 'Voted +5' : 'Tap to vote +5'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Top Row (or only row for 2-player): P1 & P2 */}
                  <div className="flex flex-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleBattleTap('me'); setGiftTarget('me'); spawnHeartFromClient(e.clientX, e.clientY); }}
                      className={`w-1/2 h-full overflow-hidden relative bg-[#13151A] pointer-events-auto border-r border-white/5 ${is4Player ? 'border-b' : ''}`}
                    >
                      <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay playsInline muted />
                      <div className="absolute top-1 right-1 z-10 pointer-events-auto flex items-center gap-1">
                        <div onClick={(e) => { e.stopPropagation(); togglePlayerMute('me'); }}>
                          {mutedPlayers['me'] ? <VolumeX className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} /> : <Volume2 className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
                        </div>
                        <div onClick={(e) => { e.stopPropagation(); toggleBattle(); }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                        </div>
                      </div>


                      {battleWinner && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className={`text-sm font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${battleWinner === 'me' ? 'text-white' : battleWinner === 'draw' ? 'text-white' : 'text-red-400'}`}>
                            {battleWinner === 'me' ? 'WIN' : battleWinner === 'draw' ? 'DRAW' : 'LOSS'}
                          </span>
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setGiftTarget('opponent'); spawnHeartFromClient(e.clientX, e.clientY); }}
                      className={`w-1/2 h-full overflow-hidden relative bg-[#13151A] pointer-events-auto ${is4Player ? 'border-b border-white/5' : ''}`}
                    >
                      {battleSlots[0].status === 'accepted' ? (
                        <video ref={opponentVideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                      ) : battleSlots[0].status === 'invited' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#13151A]">
                          <img src={battleSlots[0].avatar} alt={battleSlots[0].name} className="w-12 h-12 rounded-full border-2 border-[#C9A96E] opacity-60" />
                          <div className="w-5 h-5 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
                          <span className="text-white text-[10px] font-bold">Waiting...</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#13151A]/80 pointer-events-auto" onClick={(e) => { e.stopPropagation(); setIsFindCreatorsOpen(true); }}>
                          <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                            <span className="text-white/30 text-2xl">+</span>
                          </div>
                          <span className="text-white/40 text-[10px] font-bold">Invite P2</span>
                        </div>
                      )}

                      {battleSlots[0].status !== 'empty' && (
                        <div className="absolute top-1 right-1 z-10 pointer-events-auto flex items-center gap-1">
                          <div onClick={(e) => { e.stopPropagation(); togglePlayerMute('opponent'); }}>
                            {mutedPlayers['opponent'] ? <VolumeX className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} /> : <Volume2 className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
                          </div>
                          <div onClick={(e) => { e.stopPropagation(); removePlayerFromSlot(0); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                          </div>
                        </div>
                      )}

                      <div 
                        className="absolute bottom-1 right-1 flex items-center cursor-pointer hover:scale-105 transition-transform active:scale-95 pointer-events-auto"
                        onClick={(e) => { e.stopPropagation(); openMiniProfile(battleSlots[0].name); }}
                      >
                        {lastGifts.opponent && (
                          <div className="w-5 h-5 rounded-full bg-[#13151A] border border-[#C9A96E]/40 overflow-hidden flex items-center justify-center drop-shadow-md z-10 relative">
                            <img src={lastGifts.opponent} alt="gift" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div 
                          className={`h-4 flex items-center rounded-full text-[8px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] relative z-0 bg-[#13151A]/40 backdrop-blur-md border border-white/10 ${lastGifts.opponent ? '-ml-2 pl-3 pr-1.5' : 'px-1.5'}`}
                        >
                          {battleSlots[0].status !== 'empty' ? battleSlots[0].name : 'P2'}
                        </div>
                      </div>

                      {battleWinner && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className={`text-sm font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${battleWinner === 'opponent' ? 'text-white' : battleWinner === 'draw' ? 'text-white' : 'text-red-400'}`}>
                            {battleWinner === 'opponent' ? 'WIN' : battleWinner === 'draw' ? 'DRAW' : 'LOSS'}
                          </span>
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Bottom Row: Player 3 & Player 4 - ONLY shown when 4 players */}
                  {is4Player && (
                    <div className="flex flex-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setGiftTarget('player3'); spawnHeartFromClient(e.clientX, e.clientY); }}
                        className="w-1/2 h-full overflow-hidden relative bg-[#13151A] pointer-events-auto border-r border-white/5"
                      >
                        {battleSlots[1].status === 'accepted' ? (
                          <video ref={player3VideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                        ) : battleSlots[1].status === 'invited' ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#13151A]">
                            <img src={battleSlots[1].avatar} alt={battleSlots[1].name} className="w-12 h-12 rounded-full border-2 border-[#C9A96E] opacity-60" />
                            <div className="w-5 h-5 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
                            <span className="text-white text-[10px] font-bold">Waiting...</span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#13151A]/80 pointer-events-auto" onClick={(e) => { e.stopPropagation(); setIsFindCreatorsOpen(true); }}>
                            <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                              <span className="text-white/30 text-2xl">+</span>
                            </div>
                            <span className="text-white/40 text-[10px] font-bold">Invite P3</span>
                          </div>
                        )}

                        {battleSlots[1].status !== 'empty' && (
                          <div className="absolute top-1 right-1 z-10 pointer-events-auto flex items-center gap-1">
                            <div onClick={(e) => { e.stopPropagation(); togglePlayerMute('player3'); }}>
                              {mutedPlayers['player3'] ? <VolumeX className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} /> : <Volume2 className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
                            </div>
                            <div onClick={(e) => { e.stopPropagation(); removePlayerFromSlot(1); }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                            </div>
                        </div>
                      )}

                      <div 
                        className="absolute bottom-1 left-1 flex items-center cursor-pointer hover:scale-105 transition-transform active:scale-95 pointer-events-auto"
                        onClick={(e) => { e.stopPropagation(); openMiniProfile(battleSlots[1].name); }}
                      >
                        {lastGifts.player3 && (
                          <div className="w-5 h-5 rounded-full bg-[#13151A] border border-[#C9A96E]/40 overflow-hidden flex items-center justify-center drop-shadow-md z-10 relative">
                            <img src={lastGifts.player3} alt="gift" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div 
                          className={`h-4 flex items-center rounded-full text-[8px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] relative z-0 ${lastGifts.player3 ? '-ml-2 pl-3 pr-1.5' : 'px-1.5'}`}
                          style={{ background: 'linear-gradient(135deg, rgba(0,200,83,0.7), rgba(0,200,83,0.3))' }}
                        >
                          {battleSlots[1].status !== 'empty' ? battleSlots[1].name : 'P3'}
                        </div>
                      </div>

                      {battleWinner && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className={`text-sm font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${battleWinner === 'me' ? 'text-white' : battleWinner === 'draw' ? 'text-white' : 'text-red-400'}`}>
                              {battleWinner === 'me' ? 'WIN' : battleWinner === 'draw' ? 'DRAW' : 'LOSS'}
                            </span>
                          </div>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setGiftTarget('player4'); spawnHeartFromClient(e.clientX, e.clientY); }}
                        className="w-1/2 h-full overflow-hidden relative bg-[#13151A] pointer-events-auto"
                      >
                        {battleSlots[2].status === 'accepted' ? (
                          <video ref={player4VideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                        ) : battleSlots[2].status === 'invited' ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#13151A]">
                            <img src={battleSlots[2].avatar} alt={battleSlots[2].name} className="w-12 h-12 rounded-full border-2 border-[#C9A96E] opacity-60" />
                            <div className="w-5 h-5 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
                            <span className="text-white text-[10px] font-bold">Waiting...</span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#13151A]/80 pointer-events-auto" onClick={(e) => { e.stopPropagation(); setIsFindCreatorsOpen(true); }}>
                            <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                              <span className="text-white/30 text-2xl">+</span>
                            </div>
                            <span className="text-white/40 text-[10px] font-bold">Invite P4</span>
                          </div>
                        )}

                        {battleSlots[2].status !== 'empty' && (
                          <div className="absolute top-1 right-1 z-10 pointer-events-auto flex items-center gap-1">
                            <div onClick={(e) => { e.stopPropagation(); togglePlayerMute('player4'); }}>
                              {mutedPlayers['player4'] ? <VolumeX className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} /> : <Volume2 className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
                            </div>
                            <div onClick={(e) => { e.stopPropagation(); removePlayerFromSlot(2); }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                            </div>
                        </div>
                      )}

                      <div 
                        className="absolute bottom-1 right-1 flex items-center cursor-pointer hover:scale-105 transition-transform active:scale-95 pointer-events-auto"
                        onClick={(e) => { e.stopPropagation(); openMiniProfile(battleSlots[2].name); }}
                      >
                        {lastGifts.player4 && (
                          <div className="w-5 h-5 rounded-full bg-[#13151A] border border-[#C9A96E]/40 overflow-hidden flex items-center justify-center drop-shadow-md z-10 relative">
                            <img src={lastGifts.player4} alt="gift" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div 
                          className={`h-4 flex items-center rounded-full text-[8px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] relative z-0 ${lastGifts.player4 ? '-ml-2 pl-3 pr-1.5' : 'px-1.5'}`}
                          style={{ background: 'linear-gradient(135deg, rgba(156,39,176,0.7), rgba(156,39,176,0.3))' }}
                        >
                          {battleSlots[2].status !== 'empty' ? battleSlots[2].name : 'P4'}
                        </div>
                      </div>

                      {battleWinner && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className={`text-sm font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${battleWinner === 'opponent' ? 'text-white' : battleWinner === 'draw' ? 'text-white' : 'text-red-400'}`}>
                              {battleWinner === 'opponent' ? 'WIN' : battleWinner === 'draw' ? 'DRAW' : 'LOSS'}
                            </span>
                          </div>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

              {/* MVP Circles - outside below battle frame, 3 left + 3 right */}
            <div className="w-full px-3 py-2 flex items-center justify-between flex-none pointer-events-none mt-1 relative z-30">
              {/* Left side - top gifters for P1 */}
              <div className="flex items-center -space-x-1.5 pointer-events-auto" onClick={() => setShowViewerList(true)}>
                {[['#FFD700'], ['#C0C0C0'], ['#CD7F32']].map(([c], i) => {
                  const g = getTopGifters('me')[i];
                  return g ? (
                    <div key={i} style={{ zIndex: 3 - i }}><AvatarRing src={g.avatar} alt={g.name} size={36} /></div>
                  ) : (
                    <div key={i} style={{ zIndex: 3 - i }}><AvatarRing src="/Icons/elix-logo.png" alt="" size={36} /></div>
                  );
                })}
              </div>

              {/* Speed Challenge Timer - MOVED HERE between circles */}
              {SPEED_CHALLENGE_ENABLED && speedChallengeActive && (
                <div className="flex items-center gap-3 px-5 py-1 rounded-full bg-[#13151A]/70 backdrop-blur-md border border-[#C9A96E]/30 shadow-[0_0_15px_rgba(201,169,110,0.3)] animate-luxury-fade-in">
                  <span className="text-white text-[9px] font-bold uppercase tracking-[0.1em]">⚡ Speed</span>
                  <span className="text-white text-[14px] font-black tabular-nums">{speedChallengeTime}s</span>
                  {speedMultiplier > 1 && (
                    <span className="text-white text-[11px] font-black animate-pulse">x{speedMultiplier}</span>
                  )}
                </div>
              )}

              {/* Right side - top gifters for P2 */}
              <div className="flex items-center -space-x-1.5 pointer-events-auto" onClick={() => setShowViewerList(true)}>
                {[['#FFD700'], ['#C0C0C0'], ['#CD7F32']].map(([c], i) => {
                  const g = getTopGifters('opponent')[i];
                  return g ? (
                    <div key={i} style={{ zIndex: 3 - i }}><AvatarRing src={g.avatar} alt={g.name} size={36} /></div>
                  ) : (
                    <div key={i} style={{ zIndex: 3 - i }}><AvatarRing src="/Icons/elix-logo.png" alt="" size={36} /></div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>

        <div className="relative z-10 h-full pointer-events-none">
          {/* Input Layer Removed - Moved to Bottom Zone */}

          <div className="relative flex flex-col h-full pointer-events-none">
            {/* TOP AREA: Overlays (Top Bar & Floating Buttons) */}
            <div className="flex-[0_0_50dvh] relative pointer-events-none">
              {/* Top Bar */}
              {isBroadcast ? (
                <div className="absolute top-0 left-0 right-0 z-[110] pointer-events-none">
                  <div className="px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2px)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="pointer-events-auto flex flex-col gap-2">
                        {/* BROADCASTER INFO */}
                        <div className="px-0 py-1 animate-luxury-fade-in -ml-2 relative">
                          <div className="flex items-center relative">
                            <div 
                              className="relative z-10 flex-shrink-0 pointer-events-auto cursor-pointer active:scale-95 transition-transform"
                              onClick={(e) => { e.stopPropagation(); openMiniProfile(myCreatorName); }}
                            >
                              <AvatarRing src={myAvatar} alt={myCreatorName} size={56} />
                            </div>
                            <div className="flex flex-col justify-center -ml-4 pl-6 pr-16 h-9 rounded-full border border-[#C9A96E]/60 bg-[#13151A]/80 min-w-[140px] relative" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, boxShadow: '0 0 8px rgba(201,169,110,0.25)' }}>
                              <span className="text-white text-[10px] font-bold truncate max-w-[160px] leading-tight">{myCreatorName}</span>
                              <button
                  type="button"
                  className="flex items-center gap-0.5 pointer-events-auto -mt-0.5"
                  onPointerDown={(e) => {
                    handleLikeTap(e);
                  }}
                >
                                <Heart className="w-2 h-2 text-[#FF2D55]" strokeWidth={2.5} fill="#FF2D55" />
                                <span className="text-white/70 text-[8px] font-bold tabular-nums">{activeLikes.toLocaleString()}</span>
                              </button>
                              
                              {(() => {
                                const redCount = 0;
                                const greyCount = 0;
                                return (
                                  <div className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center pointer-events-auto">
                                    {/* Membership / Join Button (Bottom) */}
                                    <button
                                      type="button"
                                      className={`col-start-1 row-start-1 flex items-center justify-center gap-1 ${hasJoinedToday ? 'bg-[#C9A96E] border-[#C9A96E]' : 'bg-[#13151A] border-[#C9A96E]/40'} rounded-full px-1.5 py-0.5 shadow-sm border w-[58px] h-7 z-0 transition-colors duration-200`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!hasJoinedToday && user?.id && effectiveStreamId) {
                                          const today = new Date().toISOString().split('T')[0];
                                          const storageKey = `joined_stream_${effectiveStreamId}_${user.id}_${today}`;
                                          localStorage.setItem(storageKey, 'true');
                                          
                                          // Update total heart count
                                          const heartKey = `my_heart_count_${effectiveStreamId}_${user.id}`;
                                          const newCount = myHeartCount + 1;
                                          localStorage.setItem(heartKey, newCount.toString());
                                          setMyHeartCount(newCount);
                                          
                                          setMemberCount(prev => prev + 1);
                                          setHasJoinedToday(true);
                                          setShowTeamStatus(true);
                                          
                                          // Send animated heart to chat
                                          const newMessage: LiveMessage = {
                                            id: Date.now().toString(),
                                            username: 'You',
                                            text: '❤️ Joined the team!',
                                            level: userLevel,
                                            isGift: false,
                                            avatar: '/Icons/elix-logo.png',
                                            isSystem: true,
                                            membershipIcon: '/icons/Membership.png'
                                          };
                                          setMessages(prev => [...prev, newMessage]);
                                          spawnHeartFromClient(e.clientX, e.clientY);

                                        } else if (hasJoinedToday) {
                                          setShowTeamStatus(true);
                                        }
                                      }}
                                    >
                                      <div className="relative">
                                        <Heart
                                          className={`w-3.5 h-3.5 ${hasJoinedToday ? 'text-white fill-white' : 'text-[#C9A96E] fill-[#C9A96E]'}`}
                                          strokeWidth={2.5}
                                        />
                                        {!hasJoinedToday && (
                                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#C9A96E] rounded-full flex items-center justify-center border border-white">
                                            <span className="text-white text-[6px] font-bold leading-none">+</span>
                                          </div>
                                        )}
                                      </div>
                                      <span className={`${hasJoinedToday ? 'text-white' : 'text-[#C9A96E]'} text-[10px] font-bold`}>Join</span>
                                    </button>

                                    {/* Follow Button (Top) - Shows "+ Follow" */}
                                    {!isFollowing && (
                                      <button
                                        type="button"
                                        className="col-start-1 row-start-1 z-20 relative flex items-center justify-center gap-1 bg-[#FF2D55] rounded-full px-1.5 py-0.5 shadow-sm border border-white/20 w-[58px] h-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setIsFollowing(true);
                                        }}
                                      >
                                        <Plus size={12} className="text-white" strokeWidth={3} />
                                        <span className="text-white text-[10px] font-bold">Follow</span>
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 ml-9 pointer-events-auto relative z-20 flex-wrap">
                            <div 
                              className="flex items-center gap-1 bg-[#13151A] rounded-full px-2 py-0.5 border border-[#C9A96E]/40 shadow-sm cursor-pointer" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowRankingPanel(true);
                              }}
                            >
                              <Trophy className="w-2.5 h-2.5 text-[#C9A96E]" />
                              <span className="text-[#C9A96E] text-[9px] font-bold whitespace-nowrap">Weekly Ranking &gt;</span>
                            </div>
                            <div 
                              className="flex items-center gap-1 bg-[#13151A] rounded-full px-2 py-0.5 border border-[#C9A96E]/40 shadow-sm cursor-pointer" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowFanClub(true);
                              }}
                            >
                              <img src="/icons/Membership.png" alt="Membership" className="w-3.5 h-3.5 object-contain" onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }} />
                              <Heart className="w-2.5 h-2.5 text-[#C9A96E] fill-[#C9A96E] hidden" />
                              <span className="text-[#C9A96E] text-[9px] font-bold whitespace-nowrap">Membership</span>
                            </div>
                            {currentUniverse && (
                              <div className="flex items-center gap-1 bg-[#13151A] rounded-full px-2 py-0.5 border border-[#C9A96E]/40 shadow-sm">
                                <span className="text-[#C9A96E] text-[9px] font-bold whitespace-nowrap truncate max-w-[140px]">✨ {universeText} ✨</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pointer-events-auto flex items-center gap-2 mt-5">
                        <div className="flex items-center gap-1.5">
                            <div className="flex items-center -space-x-1 pointer-events-auto" onClick={() => setShowViewerList(prev => !prev)}>
                              {activeViewers.slice(0, 3).map((v, i) => {
                                const donated = 0;
                                return (
                                  <div key={v.id} className="relative flex flex-col items-center" style={{ zIndex: 3 - i }}>
                                    <div className="relative">
                                      <AvatarRing src={v.avatar} alt={v.username} size={28} />
                                      <span className="absolute bottom-0 inset-x-0 flex items-center justify-center text-white text-[5px] font-black leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">{formatCoinsShort(donated)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          <button onClick={() => setShowViewerList(prev => !prev)} className="flex items-center gap-0.5 pointer-events-auto">
                            <span className="text-white text-[9px] font-bold tabular-nums">{formatCountShort(viewerCount)}</span>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                        </div>
                        <button type="button" onClick={stopBroadcast} className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-transform" title="End broadcast">
                          <img src="/Icons/Gold power buton.png" alt="Close" className="w-5 h-5 object-contain" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute top-0 left-0 right-0 z-[110] pointer-events-none">
                  <div className="px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="pointer-events-auto flex items-center gap-2">
                        {/* LUXURY CREATOR PROFILE BUTTON */}
                        <button type="button" onClick={() => openMiniProfile(myCreatorName)} className="pr-3 pl-2 py-2 hover:scale-105 transition-all animate-luxury-fade-in">
                          <div className="flex items-center gap-2">
                            <div 
                              className="relative z-10 flex-shrink-0 pointer-events-auto cursor-pointer active:scale-95 transition-transform"
                              onClick={(e) => { e.stopPropagation(); openMiniProfile(myCreatorName); }}
                            >
                              <AvatarRing src={myAvatar} alt={myCreatorName} size={44} />
                            </div>
                            <div className="min-w-0 flex items-center gap-2">
                              <p className="text-white font-black text-[14px] truncate max-w-[160px]">{myCreatorName}</p>
                              <button type="button" className="flex items-center gap-1 pointer-events-auto" onPointerDown={(e) => { spawnHeartFromClient(e.clientX, e.clientY); addLiveLikes(1); }}>
                                <Heart className="w-3.5 h-3.5 text-[#FF2D55]" strokeWidth={2.5} fill="#FF2D55" />
                                <span className="text-white/80 text-[10px] font-bold tabular-nums">{activeLikes.toLocaleString()}</span>
                              </button>
                            </div>
                              
                              <div className="flex items-center gap-2 mt-0.5 pointer-events-auto flex-wrap">
                                <div className="flex items-center gap-1 bg-[#13151A] rounded-full px-2 py-0.5 border border-[#C9A96E]/40 shadow-sm cursor-pointer" onClick={(e) => {
                                   e.stopPropagation();
                                   setShowRankingPanel(true);
                                }}>
                                  <Trophy className="w-2.5 h-2.5 text-[#C9A96E]" />
                                  <span className="text-[#C9A96E] text-[9px] font-bold whitespace-nowrap">52 Weekly Ranking &gt;</span>
                                </div>
                                <div className="flex items-center gap-1 bg-[#13151A] rounded-full px-2 py-0.5 border border-[#C9A96E]/40 shadow-sm cursor-pointer pointer-events-auto" onClick={(e) => {
                                   e.stopPropagation();
                                   setShowFanClub(true);
                                }}>
                                  <Heart className="w-2.5 h-2.5 text-[#C9A96E] fill-[#C9A96E]" />
                                  <span className="text-[#C9A96E] text-[9px] font-bold whitespace-nowrap">Join Super Fan</span>
                                </div>
                                {currentUniverse && (
                                  <div className="flex items-center gap-1 bg-[#13151A] rounded-full px-2 py-0.5 border border-[#C9A96E]/40 shadow-sm">
                                    <span className="text-[#C9A96E] text-[9px] font-bold whitespace-nowrap truncate max-w-[140px]">✨ {universeText} ✨</span>
                                  </div>
                                )}
                              </div>
                            </div>
                        </button>
                        {(() => {
                          const redCount = 0;
                          const greyCount = 0;
                          return (
                            <button type="button" className="flex items-center gap-1 pointer-events-auto" onClick={(e) => { e.stopPropagation(); if (showMembershipBar) closeMembershipBar(); else openMembershipBar(); }}>
                              <Heart className={`w-3.5 h-3.5 drop-shadow-[0_0_3px_rgba(201,169,110,0.5)] transition-colors duration-300 ${membershipHeartActive ? 'text-white' : 'text-white'}`} strokeWidth={2} fill={membershipHeartActive ? '#C9A96E' : '#C9A96E'} />
                              <div className="flex flex-col leading-none gap-px">
                                <span className="text-white text-[7px] font-bold tabular-nums">{redCount}</span>
                                <span className="text-[#6B7280] text-[7px] font-bold tabular-nums">{greyCount}</span>
                              </div>
                            </button>
                          );
                        })()}
                      </div>

                      <div className="pointer-events-auto flex flex-col items-center gap-2">
                        <div className="h-9 px-3 flex items-center gap-2 animate-luxury-fade-in">
                          <Flame className="w-4 h-4 text-white animate-float" strokeWidth={2.5} />
                          <span className="text-white text-xs font-black">Popular</span>
                        </div>
                      </div>

                      <div className="pointer-events-auto flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setShowViewerList(prev => !prev)} className="flex items-center gap-1 bg-[#13151A]/40 backdrop-blur-sm rounded-full px-2 py-1 pointer-events-auto">
                            <div className="flex -space-x-1 pointer-events-auto" onClick={() => setShowViewerList(prev => !prev)}>
                              {activeViewers.slice(0, 3).map(v => (
                                <AvatarRing key={v.id} src={v.avatar} alt="" size={20} />
                              ))}
                            </div>
                            <span className="text-white text-[9px] font-bold tabular-nums">{formatCountShort(viewerCount)}</span>
                          </button>
                          <button type="button" onClick={() => navigate('/feed', { replace: true })} className="w-7 h-7 flex items-center justify-center active:scale-95 transition-transform" title="Leave">
                            <img src="/Icons/Gold power buton.png" alt="Close" className="w-5 h-5 object-contain" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Floating Action Buttons */}
              <div className="absolute right-3 bottom-4 z-[150] flex flex-col items-center gap-3 pointer-events-none">
                <div className="flex flex-col items-center gap-3 pointer-events-auto">
                  {/* Broadcaster buttons moved to bottom-right zone */}
                </div>
              </div>
            </div>

            {/* MIDDLE ZONE: CHAT (Scrollable) */}
            <div 
              className="chat-zone fixed left-0 right-0 bottom-[calc(50px+max(12px,env(safe-area-inset-bottom)))] h-[25dvh] max-h-[25dvh] overflow-y-auto pointer-events-auto z-[20] bg-transparent"
              onPointerDown={(e) => {
                e.stopPropagation();
                if (e.target instanceof Element) {
                  const interactive = e.target.closest('button, a, input, textarea, select, [role="button"]');
                  if (interactive) return;
                }
                // Chat tap -> hearts only, never battle points
                handleLikeTap(e);
              }}
            >
            {isChatVisible && (
              <ChatOverlay
                messages={messages}
                variant="panel"
                onLike={() => addLiveLikes(1)}
                onHeartSpawn={(cx, cy) => handleLikeTap()}
                onProfileTap={(username) => openMiniProfile(username)}
              />
            )}
          </div>

      {/* BOTTOM ZONE: INPUT (Fixed) - Moved out to ensure top z-index */}
      <div className="bottom-zone flex-none pointer-events-auto bg-transparent px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 min-h-[50px] flex items-center fixed bottom-0 left-0 right-0 z-[50] justify-center">
        <div className="w-full max-w-[480px] mx-auto">
          {/* Spectator Input & Actions */}
          {!isBroadcast && (
            <div className="flex items-center gap-2 w-full relative">
              {/* Emoji Picker Panel */}
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#1C1E24] border border-white/10 rounded-xl shadow-xl overflow-hidden pointer-events-auto z-[250]">
                  <div className="grid grid-cols-6 gap-2 p-2 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                    {EMOJI_LIST.map((emoji, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setInputValue(prev => prev + emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="text-xl hover:bg-white/10 rounded p-1 transition"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2 bg-[#13151A]/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 h-10 relative z-keyboard pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`text-white/60 hover:text-white transition flex-shrink-0 ${showEmojiPicker ? 'text-white' : ''}`}
                >
                  <Smile size={20} />
                </button>
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
                    onFocus={() => setShowEmojiPicker(false)}
                />
                <button type="submit" className="text-white hover:text-white/80 transition flex-shrink-0" title="Send">
                    <Send size={18} />
                </button>
              </form>
              
              <div className="flex items-center gap-2 flex-shrink-0 pointer-events-auto">
                <button type="button" onClick={() => setIsReportModalOpen(true)} className="w-9 h-9 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </button>
                <button type="button" onClick={handleShare} className="w-9 h-9 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                  <Share2 size={16} className="text-[#C9A96E]" />
                </button>
                <button type="button" onClick={() => setShowGiftPanel(true)} className="w-9 h-9 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                  <Gift size={16} className="text-[#C9A96E]" />
                </button>
                <LiveAIFilters currentFilter={liveFilterCss} onFilterChange={setLiveFilterCss} />
                <button type="button" onPointerDown={(e) => { handleLikeTap(e); }} className="w-9 h-9 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                  <Heart size={16} fill="#FF2D55" className="text-[#FF2D55]" />
                </button>
              </div>
            </div>
          )}

          {isBroadcast && (
            <div className="flex items-center gap-3 pointer-events-auto translate-y-[12px]">
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

              <div className="flex items-center justify-end gap-3 flex-shrink-0">
              {isBattleMode && battleWinner && (
                <button 
                  type="button" 
                  onClick={() => {
                    setBattleTime(300);
                    setMyScore(0);
                    setOpponentScore(0);
                    setPlayer3Score(0);
                    setPlayer4Score(0);
                    setBattleWinner(null);
                    setBattleCountdown(3);
                    reachedThresholdsRef.current.clear();
                  }} 
                  className="px-4 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  <RefreshCw size={20} className="text-[#C9A96E] mr-2" />
                  <span className="text-[#C9A96E] text-xs font-bold">Rematch</span>
                </button>
              )}
              {!isBattleMode && (
                <button type="button" onClick={() => setIsInviteHostOpen(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg relative">
                  <UserPlus size={20} className="text-[#C9A96E]" />
                  {coHosts.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#C9A96E] rounded-full flex items-center justify-center">
                      <span className="text-black text-[10px] font-black">{coHosts.length}</span>
                    </div>
                  )}
                </button>
              )}
              <button type="button" onClick={() => { if (!isBattleMode) toggleBattle(); else setIsFindCreatorsOpen(true); }} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg">
                <Users size={20} className="text-[#C9A96E]" />
              </button>
              <button type="button" onClick={() => { setGiftTarget('me'); setShowGiftPanel(true); }} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg">
                <Gift size={20} className="text-[#C9A96E]" />
              </button>
              <button type="button" onClick={() => setShowSharePanel(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                <Share2 size={20} className="text-[#C9A96E]" />
              </button>
              <button type="button" onClick={() => setIsMoreMenuOpen(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg">
                <MoreVertical size={20} className="text-[#C9A96E]" />
              </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ INVITE HOST PANEL (Multi-Host, up to 12) ═══ */}
      {isInviteHostOpen && (
        <div className="absolute inset-0 z-[99999] flex flex-col justify-end">
          <div className="absolute inset-0 pointer-events-auto" onClick={() => { setIsInviteHostOpen(false); setHostSearchQuery(''); }} />
          <div
            className="bg-[#1C1E24]/95 rounded-t-2xl max-h-[65dvh] flex flex-col shadow-2xl border-t border-[#C9A96E]/20 pointer-events-auto w-full relative z-10 overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-white" />
                <span className="text-white font-bold text-sm">Invite Co-Hosts</span>
                <span className="text-white/40 text-xs">({coHosts.length}/{MAX_CO_HOSTS})</span>
              </div>
              <button onClick={() => { setIsInviteHostOpen(false); setHostSearchQuery(''); }} className="w-8 h-8 rounded-full bg-[#13151A] border border-[#C9A96E]/40 flex items-center justify-center">
                <X size={16} className="text-[#C9A96E]" />
              </button>
            </div>

            {/* Current Co-Hosts */}
            {coHosts.length > 0 && (
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-2">Current Hosts ({coHosts.length})</p>
                <div className="flex gap-3 overflow-x-auto no-scrollbar">
                  {coHosts.map(host => (
                    <div key={host.id} className="flex flex-col items-center gap-1 min-w-[60px]">
                      <div className="relative">
                        <AvatarRing src={host.avatar} alt={host.name} size={48} />
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#1a1a1a] ${
                          host.status === 'live' ? 'bg-[#C9A96E]' : host.status === 'accepted' ? 'bg-[#C9A96E]/60' : 'bg-[#C9A96E]/30 animate-pulse'
                        }`} />
                        <button
                          onClick={() => removeCoHost(host.id)}
                          className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center"
                        >
                          <X size={10} className="text-black" />
                        </button>
                      </div>
                      <span className="text-white text-[10px] truncate w-14 text-center">{host.name}</span>
                      <span className="text-white/40 text-[8px] uppercase font-bold">
                        {host.status === 'live' ? '● LIVE' : host.status === 'accepted' ? 'Joining...' : 'Invited'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                <Search className="w-4 h-4 text-white/50" strokeWidth={2} />
                <input
                  type="text"
                  placeholder="Search creators to invite..."
                  className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-white/30"
                  value={hostSearchQuery}
                  onChange={(e) => setHostSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Creator List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {filteredHostCreators.length === 0 ? (
                <div className="text-center text-white/30 text-sm py-8">No creators found</div>
              ) : (
                <div className="space-y-2">
                  {filteredHostCreators.map(creator => (
                    <button
                      key={creator.name}
                      onClick={() => {
                        inviteCoHost({ name: creator.name, avatar: creator.avatar });
                      }}
                      disabled={coHosts.length >= MAX_CO_HOSTS}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-[#C9A96E]/10 transition-all active:scale-[0.98] disabled:opacity-30"
                    >
                      <div className="relative">
                        <AvatarRing src={creator.avatar} alt={creator.name} size={40} />
                        {creator.isLive && (
                          <div className="absolute -bottom-0.5 -right-0.5 px-1 py-0.5 bg-red-500 rounded text-[7px] font-black text-white leading-none">LIVE</div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white text-sm font-bold">{creator.name}</p>
                        <p className="text-white/40 text-xs">{creator.isLive ? 'Currently Live' : 'Creator'}</p>
                      </div>
                      <div className="px-3 py-1.5 rounded-full bg-[#C9A96E] flex items-center gap-1">
                        <UserPlus size={12} className="text-black" />
                        <span className="text-black text-xs font-bold">Invite</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Weekly Ranking Panel */}
      {showRankingPanel && (
        <>
          <div 
            className="absolute inset-0 bg-black/40 pointer-events-auto" 
            style={{ zIndex: 99998 }}
            onClick={() => setShowRankingPanel(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 z-[99999] pointer-events-auto">
            <RankingPanel onClose={() => setShowRankingPanel(false)} />
          </div>
        </>
      )}

      {/* ─── INCOMING BATTLE INVITE BANNER ─── */}
      {pendingInvite && (
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+60px)] left-3 right-3 z-[99998] animate-in slide-in-from-top">
          <div className="bg-[#1C1E24]/95 backdrop-blur-md rounded-2xl border border-[#C9A96E]/30 shadow-2xl shadow-black/50 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full border-2 border-[#C9A96E]/50 overflow-hidden bg-[#13151A] flex-shrink-0">
                {pendingInvite.hostAvatar ? (
                  <img src={pendingInvite.hostAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#C9A96E] font-bold text-lg">
                    {pendingInvite.hostName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">Battle Invite</p>
                <p className="text-white/60 text-xs truncate">
                  <span className="text-[#C9A96E]">@{pendingInvite.hostName}</span> wants to battle you!
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Sword className="w-4 h-4 text-red-400" />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={declineBattleInvite}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs font-bold active:scale-95 transition-all"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={acceptBattleInvite}
                className="flex-1 py-2.5 rounded-xl bg-[#C9A96E] text-black text-xs font-bold active:scale-95 transition-all shadow-lg shadow-[#C9A96E]/20"
              >
                Accept & Join
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS & OVERLAYS */}
      {isFindCreatorsOpen && (
        <div className="absolute inset-0 z-[99999] flex flex-col justify-end">
          <div 
            className="absolute inset-0 pointer-events-auto" 
            onClick={() => {
              setIsFindCreatorsOpen(false);
              setCreatorQuery('');
            }}
          />
          <div
            className="bg-[#1C1E24]/95 rounded-t-2xl h-[40dvh] max-h-[40dvh] flex flex-col shadow-2xl border-t border-white/10 pointer-events-auto w-full relative z-10 overflow-y-auto no-scrollbar pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#C9A96E]" strokeWidth={2} />
                <span className="text-white font-bold text-sm">Invite Creators</span>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-3 px-3 h-10 rounded-xl bg-[#13151A]/50 border border-white/10 focus-within:border-[#C9A96E]/50 transition-colors">
                <Search className="w-4 h-4 text-white/50" strokeWidth={2} />
                <input
                  value={creatorQuery}
                  onChange={(e) => setCreatorQuery(e.target.value)}
                  placeholder="Search creators..."
                  className="flex-1 bg-transparent outline-none text-white text-sm placeholder:text-white/30"
                  autoFocus
                />
              </div>
            </div>

            {/* Invited Players Status */}
            {anySlotFilled && (
              <div className="px-4 pb-2">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2">Lobby Status</p>
                  <div className="flex gap-3">
                    {battleSlots.map((slot, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        {slot.status === 'empty' ? (
                          <div className="w-10 h-10 rounded-full border border-dashed border-[#C9A96E]/30 flex items-center justify-center bg-[#13151A]">
                            <span className="text-white/30 text-lg">+</span>
                          </div>
                        ) : (
                          <div className="relative">
                            <AvatarRing src={slot.avatar} alt={slot.name} size={40} />
                            {slot.status === 'invited' && (
                              <div className="absolute inset-0 rounded-full flex items-center justify-center bg-[#13151A]/40">
                                <div className="w-4 h-4 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                            {slot.status === 'accepted' && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#C9A96E] rounded-full flex items-center justify-center border-2 border-black">
                                <span className="text-white text-[8px] font-bold">✓</span>
                              </div>
                            )}
                          </div>
                        )}
                        <span className="text-white/60 text-[9px] font-bold truncate max-w-[50px]">
                          {slot.status === 'empty' ? `Slot ${i + 1}` : `@${slot.name}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Creator list */}
            <div className="flex-1 overflow-y-auto px-2" style={{ scrollbarWidth: 'none' }}>
              <div className="space-y-1 pb-4">
                {filteredCreators.map((c) => {
                  const slotStatus = battleSlots.find(s => s.userId === c.id)?.status;
                  const isInvited = slotStatus === 'invited';
                  const isAccepted = slotStatus === 'accepted';
                  const allFull = battleSlots.every(s => s.status !== 'empty');

                  return (
                    <div
                      key={c.id}
                      className="px-3 py-2 flex items-center justify-between hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          <AvatarRing src={c.avatar} alt={c.username} size={40} />
                          {c.isLive && (
                            <div className="absolute -bottom-0.5 -right-0.5 px-1 py-0.5 bg-red-500 rounded text-[7px] font-black text-white leading-none">LIVE</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-bold truncate">@{c.username}</p>
                          {c.name !== c.username && (
                            <p className="text-white/40 text-[10px] font-medium truncate">{c.name}</p>
                          )}
                          <p className="text-white/50 text-[10px] font-medium">{c.followers} followers</p>
                        </div>
                      </div>

                      {isAccepted ? (
                        <span className="px-3 py-1 bg-[#C9A96E]/20 text-white text-[10px] font-bold rounded-full border border-[#C9A96E]/30">
                          Joined ✓
                        </span>
                      ) : isInvited ? (
                        <span className="px-3 py-1 bg-[#C9A96E]/20 text-white text-[10px] font-bold rounded-full border border-[#C9A96E]/30 flex items-center gap-1.5">
                          <div className="w-2 h-2 border border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
                          Sent
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inviteCreatorToSlot(c.id)}
                          disabled={allFull}
                          className={`px-4 py-1.5 text-[11px] font-bold rounded-full transition-all active:scale-95 ${
                            allFull 
                              ? 'bg-white/5 text-white/30 cursor-not-allowed' 
                              : 'bg-[#C9A96E] hover:bg-[#B8943F] text-white shadow-lg shadow-[#C9A96E]/20'
                          }`}
                        >
                          Invite
                        </button>
                      )}
                    </div>
                  );
                })}

                {filteredCreators.length === 0 && (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#13151A] border border-[#C9A96E]/40 flex items-center justify-center mx-auto mb-3">
                      <Search className="w-5 h-5 text-[#C9A96E]/40" />
                    </div>
                    <p className="text-white/40 text-xs font-medium">No creators found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status bar & Start Button */}
            {battleSlots.some(s => s.status !== 'empty') && (
              <div className="p-4 border-t border-white/10 bg-[#1C1E24]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/50 text-xs font-bold">
                    Match Status
                  </span>
                  <span className="text-white text-xs font-bold">
                    {battleSlots.filter(s => s.status === 'accepted').length} Ready <span className="text-white/30">•</span> {battleSlots.filter(s => s.status === 'invited').length} Waiting
                  </span>
                </div>
                
                {battleSlots.some(s => s.status === 'accepted') && (
                  <button
                    type="button"
                    onClick={() => {
                      setBattleCountdown(3);
                      setIsFindCreatorsOpen(false);
                    }}
                    className="w-full py-3 bg-[#C9A96E] hover:bg-[#B8943F] text-white text-sm font-black rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <span>Start Match</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {miniProfile && (
          <div className="absolute inset-0 z-[10000] flex flex-col justify-end">
            <div 
              className="absolute inset-0 pointer-events-auto" 
              onClick={closeMiniProfile}
            />
            <motion.div
              className="bg-[#1C1E24] rounded-t-2xl border-t border-white/10 px-4 pt-4 pb-[calc(20px+env(safe-area-inset-bottom))] pointer-events-auto shadow-2xl relative z-10"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="relative -mt-6 flex-shrink-0">
                    <AvatarRing src={miniProfile.avatar} alt={miniProfile.username} size={80} />
                  </div>
                  <div className="min-w-0 pt-1">
                    <div className="text-white font-black text-[16px] truncate">{miniProfile.username}</div>
                    <div className="text-white/70 text-[12px] font-bold">
                      {typeof miniProfile.level === 'number' ? (
                        <span className="inline-flex items-center gap-2">
                          <LevelBadge level={miniProfile.level} size={16} layout="fixed" />
                          <span>Level {miniProfile.level}</span>
                        </span>
                      ) : (
                        'Level —'
                      )}
                      {miniProfile.coins != null ? ` • 🪙 ${formatCoinsShort(miniProfile.coins)}` : ''}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-white/50">
                      <div className="flex items-center gap-1">
                        <span className="text-white font-bold tabular-nums">1.2k</span>
                        <span>Followers</span>
                      </div>
                      <div className="w-px h-2 bg-white/20" />
                      <div className="flex items-center gap-1">
                        <span className="text-white font-bold tabular-nums">458</span>
                        <span>Following</span>
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-white/80 leading-snug line-clamp-2">
                      Welcome to my stream! 🎵 Music lover, gamer & content creator. Let's vibe! ✨
                    </div>

                    {miniProfile.donated != null && miniProfile.donated > 0 && (
                      <div className="text-white text-[11px] font-bold mt-2 pt-2 border-t border-white/10">
                        Donated: {formatCoinsShort(miniProfile.donated)} coins
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-5 gap-2">
                <button type="button" onClick={async () => {
                  if (!user?.id || !miniProfile) return;
                  try {
                    await supabase.from('followers').upsert({ follower_id: user.id, following_id: miniProfile.id }, { onConflict: 'follower_id,following_id' });
                    setIsFollowing(true);
                    closeMiniProfile();
                  } catch {}
                }} className="h-9 rounded-lg bg-[#C9A96E] text-black text-[11px] font-black hover:bg-[#C9A96E]/90 active:scale-95 transition-all">
                  Follow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowGiftPanel(true);
                    closeMiniProfile();
                  }}
                  className="h-9 rounded-lg bg-white/10 text-white text-[11px] font-bold hover:bg-white/20 active:scale-95 transition-all"
                >
                  Gift
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    closeMiniProfile();
                    navigate(`/profile/${miniProfile.username}`);
                  }}
                  className="h-9 rounded-lg bg-white/10 text-white text-[11px] font-bold hover:bg-white/20 active:scale-95 transition-all"
                >
                  Profile
                </button>
                <button type="button" onClick={handleShare} className="h-9 rounded-lg bg-white/10 text-white text-[11px] font-bold hover:bg-white/20 active:scale-95 transition-all">
                  Share
                </button>
                <button type="button" onClick={async () => {
                  if (!user?.id || !miniProfile) return;
                  try {
                    await supabase.from('blocked_users').upsert({ blocker_id: user.id, blocked_id: miniProfile.id }, { onConflict: 'blocker_id,blocked_id' });
                    closeMiniProfile();
                  } catch {}
                }} className="h-9 rounded-lg bg-red-950/50 text-red-400 text-[11px] font-bold border border-red-900/50 hover:bg-red-900/50 active:scale-95 transition-all">
                  Block
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ VIEWER LIST PANEL ═══ */}
      {showViewerList && (
        <div className="absolute inset-0 z-[99999] flex flex-col bg-[#0A0B0E]/95 backdrop-blur-sm">
          <div className="flex-1 flex flex-col max-w-[480px] w-full mx-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-2">
              <div className="flex items-center gap-2.5">
                <button onClick={() => setShowViewerList(false)} className="p-1" title="Close">
                  <img src="/Icons/Gold power buton.png" alt="Close" className="w-5 h-5" />
                </button>
                <span className="text-white font-bold text-base">Spectators</span>
                <span className="text-white/30 text-xs font-medium">{formatCountShort(viewerCount)} watching</span>
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto px-1 pb-[env(safe-area-inset-bottom,20px)]">
              {activeViewers.length > 0 ? (
                <div className="grid grid-cols-2 gap-1">
                  {activeViewers
                    .map((v, idx) => ({ ...v, rank: idx }))
                    .map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => { setMiniProfile({ id: v.id, username: v.displayName, avatar: v.avatar, level: v.level ?? null }); setShowViewerList(false); }}
                        className="relative overflow-hidden aspect-[3/4] active:scale-[0.97] transition-transform"
                      >
                        {v.avatar ? (
                          <img src={v.avatar} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1c22] to-[#0e1015] flex items-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-[#C9A96E]/10 border border-[#C9A96E]/20 flex items-center justify-center">
                              <span className="text-[#C9A96E] font-bold text-xl">{v.displayName.slice(0, 1).toUpperCase()}</span>
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        {/* Rank + Level badges */}
                        <div className="absolute top-2 left-2 flex items-center gap-1">
                          {v.rank < 10 && (
                            <span className="px-1.5 py-0.5 rounded bg-[#C9A96E] text-black text-[9px] font-extrabold">#{v.rank + 1}</span>
                          )}
                          <span className="px-1.5 py-0.5 rounded bg-black/50 text-white/80 text-[9px] font-semibold">LVL {v.level}</span>
                        </div>

                        {/* Country */}
                        {v.country && (
                          <div className="absolute top-2 right-2">
                            <span className="text-white/60 text-[10px]">{v.country}</span>
                          </div>
                        )}

                        {/* Name at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 p-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full border-2 border-[#C9A96E]/40 overflow-hidden flex-shrink-0 bg-[#1a1c22]">
                              {v.avatar ? (
                                <img src={v.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/60 text-[10px] font-bold">
                                  {v.displayName.slice(0, 1).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <p className="text-white font-bold text-xs truncate">{v.displayName}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full pb-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4">
                    <Users className="w-7 h-7 text-white/10" />
                  </div>
                  <p className="text-white/50 font-bold text-sm">No spectators yet</p>
                  <p className="text-white/25 text-xs mt-1">Share this stream to get viewers</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      


      {/* ═══ JOIN ANIMATION OVERLAY ═══ */}
      {showJoinAnimation && (
        <div className="absolute inset-0 z-[99999] flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center animate-in zoom-in-50 duration-300">
            <img 
              src="/icons/Membership.png" 
              alt="Membership" 
              className="w-20 h-20 object-contain drop-shadow-2xl animate-pulse"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <Heart className="w-20 h-20 text-[#FF2D55] fill-[#FF2D55] drop-shadow-2xl animate-pulse hidden" />
            <span className="text-white font-black text-2xl mt-2 drop-shadow-lg tracking-wider animate-bounce">JOIN</span>
          </div>
        </div>
      )}

      {/* ═══ TEAM STATUS PANEL (Heart Icon) ═══ */}
      {showTeamStatus && (
        <>
          <div 
            className="absolute inset-0 bg-black/40 pointer-events-auto" 
            style={{ zIndex: 99998 }}
            onClick={() => setShowTeamStatus(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 z-[99999] pointer-events-auto">
          <div
            className="bg-[#1C1E24]/95 rounded-t-2xl p-3 pb-safe max-h-[40dvh] overflow-y-auto no-scrollbar shadow-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2">
              <div className="flex items-center gap-1.5">
                <Heart className="w-3 h-3 text-[#C9A96E]" strokeWidth={2} fill="#C9A96E" />
                <span className="text-gold-metallic font-bold text-sm">Your Team Status</span>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 no-scrollbar">
               {/* Team Status Card */}
               <div className="bg-white/5 rounded-xl p-3 border border-[#C9A96E]/20 relative overflow-hidden">
                 <div className="flex items-center gap-3 relative z-10">
                   <div 
                     className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C9A96E] to-[#E8D5A3] flex items-center justify-center border-2 border-[#C9A96E]/30 shadow-lg cursor-pointer active:scale-95 transition-transform"
                     onClick={(e) => {
                       e.stopPropagation();
                       setShowJoinAnimation(true);
                       setTimeout(() => setShowJoinAnimation(false), 2000);
                     }}
                   >
                     <Heart className="w-4 h-4 text-black fill-black" />
                   </div>
                   <div>
                     <div className="text-[#C9A96E]/60 text-[9px] font-bold uppercase tracking-wider">Current Status</div>
                     <div className="text-gold-metallic font-bold text-sm">
                      {myHeartCount === 0 ? 'New Viewer' : myHeartCount < 5 ? 'Rising Fan' : myHeartCount < 20 ? 'Loyal Member' : 'Super Fan'}
                    </div>
                    <div className="text-white/50 text-[9px] font-bold mt-0.5">
                      {myHeartCount} Hearts Sent • {myHeartCount} Days Supported
                    </div>
                   </div>
                 </div>
               </div>
               
               <p className="text-white/30 text-[10px] text-center mt-3 px-4">
                 Join not tap tap one single heart
               </p>

               {/* Recent Supporters List */}
               <div className="mt-3">
                 <h4 className="text-[#C9A96E]/60 text-[9px] font-bold uppercase tracking-wider mb-2 px-1">Recent Supporters</h4>
                 <div className="space-y-1">
                   {hasJoinedToday && (
                     <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#C9A96E]/5 border border-[#C9A96E]/15">
                        <div className="relative">
                          <img src={'/Icons/elix-logo.png'} alt="You" className="w-7 h-7 rounded-full object-cover border border-[#C9A96E]/20" />
                          <div className="absolute -bottom-0.5 -right-0.5 bg-[#C9A96E] w-3 h-3 rounded-full flex items-center justify-center border border-[#1C1E24]">
                            <Heart size={6} className="text-black fill-black" />
                          </div>
                        </div>
                        <div className="flex-1">
                        <div className="text-[10px] font-bold text-white">You</div>
                        <div className="text-[9px] text-white/50">Just joined the team!</div>
                      </div>
                        <div className="text-[#C9A96E]/50 text-[8px]">Now</div>
                     </div>
                   )}
                   
                 </div>
               </div>
            </div>
          </div>
          </div>
        </>
      )}

      {/* ═══ SUPER FAN GOAL PANEL (Membership) ═══ */}
      {showFanClub && (
        <>
          <div 
            className="absolute inset-0 bg-black/40 pointer-events-auto" 
            style={{ zIndex: 99998 }}
            onClick={() => setShowFanClub(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 z-[99999] pointer-events-auto">
          <div
            className="bg-[#1C1E24]/95 rounded-t-2xl p-3 pb-safe max-h-[40dvh] overflow-y-auto no-scrollbar shadow-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2">
              <div className="flex items-center gap-1.5">
                <Heart className="w-3 h-3 text-[#C9A96E]" strokeWidth={2} fill="#C9A96E" />
                <span className="text-gold-metallic font-bold text-sm">Super Fan Goal</span>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 no-scrollbar">
              <div className="flex flex-col gap-3">
                {/* Subscription Banner */}
                <div className="bg-gradient-to-r from-[#C9A96E]/10 to-[#B8943F]/5 rounded-xl p-3 border border-[#C9A96E]/20 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-gold-metallic font-bold text-xs">Membership</h3>
                        <p className="text-white/50 text-[9px]">Unlock photo stickers & exclusive perks</p>
                      </div>
                      <div className="w-6 h-6 bg-[#C9A96E]/20 rounded-full flex items-center justify-center border border-[#C9A96E]/30">
                        <Heart className="w-2.5 h-2.5 text-[#C9A96E] fill-[#C9A96E] animate-pulse" />
                      </div>
                    </div>
                    
                    <div className="flex items-end gap-1 mb-2">
                      <span className="text-lg font-black text-gold-metallic">£3.00</span>
                      <span className="text-white/40 text-[10px] font-medium mb-0.5">/ month</span>
                    </div>

                    <button
                      onClick={handleSubscribe}
                      disabled={isSubscribing}
                      className="w-full py-2 bg-gradient-to-r from-[#C9A96E] to-[#E8D5A3] text-black font-bold text-[10px] uppercase tracking-wide rounded-xl active:scale-[0.98] transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {isSubscribing ? (
                        <>
                          <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <span>Subscribe Now</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Photo Stickers - Only for Subscribers */}
                <div className="bg-white/5 rounded-xl p-3 border border-[#C9A96E]/20">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-gold-metallic font-bold text-[10px] flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-[#13151A] flex items-center justify-center border border-[#C9A96E]/40">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </div>
                      Photo Stickers
                    </h3>
                    <span className="bg-[#C9A96E]/10 text-[#C9A96E] text-[7px] font-bold px-1.5 py-0.5 rounded-full border border-[#C9A96E]/20">SUBSCRIBER ONLY</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1">
                    {['🔥', '💎', '👑', '🚀', '💯', '🎉', '💖', '👀'].map((emoji, i) => (
                      <button
                        key={i}
                        className="aspect-square rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center text-sm border border-[#C9A96E]/10 relative overflow-hidden group"
                        onClick={() => {
                          // Simulate sending a sticker
                          const newMessage: LiveMessage = {
                            id: Date.now().toString(),
                            username: 'You',
                            text: emoji, // In a real app this would be an image URL
                            level: userLevel,
                            isGift: false, // Could be treated as a special message type
                            avatar: '/Icons/elix-logo.png', // Fallback for now to avoid TS issues with User type
                            isSystem: false
                          };
                          setMessages(prev => [...prev, newMessage]);
                          setShowFanClub(false); // Close panel after sending
                        }}
                      >
                        <span className="group-hover:scale-110 transition-transform duration-200">{emoji}</span>
                        {!isSubscribing && (
                          <div className="absolute inset-0 bg-[#13151A]/60 backdrop-blur-[1px] flex items-center justify-center">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-80"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          </div>
                        )}
                      </button>
                    ))}
                    {/* Add Custom Sticker Upload Button */}
                    <button
                      className="aspect-square rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center border border-[#C9A96E]/10 relative overflow-hidden group"
                      onClick={() => {
                        if (!isSubscribing) return;
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const newMessage: LiveMessage = {
                                id: Date.now().toString(),
                                username: 'You',
                                text: ev.target?.result as string,
                                level: userLevel,
                                isGift: false, 
                                avatar: '/Icons/elix-logo.png',
                                isSystem: false
                              };
                              setMessages(prev => [...prev, newMessage]);
                              setShowFanClub(false);
                            };
                            reader.readAsDataURL(file);
                          }
                        };
                        input.click();
                      }}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <PlusCircle size={12} className="text-[#C9A96E]/50 group-hover:text-[#C9A96E] transition-colors" />
                        <span className="text-[6px] text-[#C9A96E]/50 font-bold uppercase">Upload</span>
                      </div>
                       {!isSubscribing && (
                          <div className="absolute inset-0 bg-[#13151A]/60 backdrop-blur-[1px] flex items-center justify-center">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-80"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          </div>
                        )}
                    </button>
                  </div>
                  <p className="text-white/30 text-[8px] text-center mt-1.5">Subscribe to unlock photo stickers and send them in chat!</p>
                </div>
              </div>
            </div>
          </div>
          </div>
        </>
      )}





      {isMoreMenuOpen && (
        <>
          <div 
            className="absolute inset-0 bg-black/40 pointer-events-auto" 
            style={{ zIndex: 99998 }}
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 z-[99999] pointer-events-auto"
          >
          <div
            className="bg-[#1C1E24]/95 rounded-t-2xl p-3 pb-safe max-h-[40dvh] overflow-y-auto no-scrollbar shadow-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center mb-2">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <Settings2 className="w-4 h-4 text-[#C9A96E]" />
              <span className="text-white font-bold text-sm">More Options</span>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-0.5">
              {/* Share Button - always visible */}
              <button
                type="button"
                onClick={() => { setShowSharePanel(true); setIsMoreMenuOpen(false); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-white hover:bg-[#C9A96E]/10 rounded-xl transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#13151A] flex items-center justify-center border border-[#C9A96E]/40">
                  <Share2 className="w-4 h-4 text-[#C9A96E]" strokeWidth={2} />
                </div>
                <span className="text-sm font-bold">Share</span>
              </button>

              {isBattleMode && battleWinner && isBroadcast && (
                <button
                  type="button"
                  onClick={() => {
                    setBattleTime(300);
                    setMyScore(0);
                    setOpponentScore(0);
                    setPlayer3Score(0);
                    setPlayer4Score(0);
                    setBattleWinner(null);
                    setBattleCountdown(3);
                    reachedThresholdsRef.current.clear();
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 text-white hover:bg-[#C9A96E]/10 rounded-xl transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#13151A] flex items-center justify-center border border-[#C9A96E]/40">
                    <RefreshCw className="w-4 h-4 text-[#C9A96E]" strokeWidth={2} />
                  </div>
                  <span className="text-sm font-bold">Rematch</span>
                </button>
              )}
              
              {isBattleMode && isBroadcast && !battleWinner && battleTime > 0 && (
                <button
                  type="button"
                  onClick={() => { startSpeedChallenge(); setIsMoreMenuOpen(false); }}
                  className="w-full px-4 py-3 flex items-center gap-3 text-white hover:bg-[#C9A96E]/10 rounded-xl transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#13151A] flex items-center justify-center border border-[#C9A96E]/40">
                    <Zap className="w-4 h-4 text-[#C9A96E]" strokeWidth={2} />
                  </div>
                  <span className="text-sm font-bold">Start Speed Challenge</span>
                </button>
              )}

              <button
                type="button"
                disabled={!isBroadcast}
                onClick={() => { flipCamera(); setIsMoreMenuOpen(false); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-white disabled:opacity-50 hover:bg-[#C9A96E]/10 rounded-xl transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#13151A] flex items-center justify-center border border-[#C9A96E]/40">
                  <RefreshCw className="w-4 h-4 text-[#C9A96E]" strokeWidth={2} />
                </div>
                <span className="text-sm font-bold">Flip camera</span>
              </button>

              <button
                type="button"
                disabled={!isBroadcast}
                onClick={() => { toggleMic(); setIsMoreMenuOpen(false); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-white disabled:opacity-50 hover:bg-[#C9A96E]/10 rounded-xl transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#13151A] flex items-center justify-center border border-[#C9A96E]/40">
                  {isMicMuted ? <MicOff className="w-4 h-4 text-[#C9A96E]" strokeWidth={2} /> : <Mic className="w-4 h-4 text-[#C9A96E]" strokeWidth={2} />}
                </div>
                <span className="text-sm font-bold">{isMicMuted ? 'Unmute mic' : 'Mute mic'}</span>
              </button>

              <button
                type="button"
                onClick={() => { setIsLiveSettingsOpen(true); setIsMoreMenuOpen(false); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-white hover:bg-[#C9A96E]/10 rounded-xl transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#13151A] flex items-center justify-center border border-[#C9A96E]/40">
                  <Settings2 className="w-4 h-4 text-[#C9A96E]" strokeWidth={2} />
                </div>
                <span className="text-sm font-bold">Live settings</span>
              </button>

              <button
                type="button"
                onClick={() => { setIsChatVisible((v) => !v); setIsMoreMenuOpen(false); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-white hover:bg-[#C9A96E]/10 rounded-xl transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#13151A] flex items-center justify-center border border-[#C9A96E]/40">
                  <MessageCircle className="w-4 h-4 text-[#C9A96E]" strokeWidth={2} />
                </div>
                <span className="text-sm font-bold">{isChatVisible ? 'Hide chat' : 'Show chat'}</span>
              </button>

            </div>
          </div>
          </div>
        </>
      )}


      {isLiveSettingsOpen && (
        <div
          className="absolute inset-0 z-[710] bg-[#13151A] pointer-events-auto"
          onClick={() => setIsLiveSettingsOpen(false)}
          role="button"
          tabIndex={-1}
        >
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pointer-events-auto">
            <div
              className="mx-auto w-full bg-[#13151A] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              role="button"
              tabIndex={-1}
            >
              <div className="px-4 py-3 flex items-center justify-between text-white">
                <div className="flex flex-col">
                  <span className="font-extrabold">Live settings</span>
                  <span className="text-[10px] text-white/40 font-mono">v1.5 (Clean UI)</span>
                </div>
                <button type="button" onClick={() => setIsLiveSettingsOpen(false)} className="p-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="h-px bg-[#C9A96E]" />
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleMic();
                    setIsLiveSettingsOpen(false);
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-white hover:brightness-125"
                >
                  <div className="flex items-center gap-3">
                    {isMicMuted ? <MicOff className="w-5 h-5" strokeWidth={2} /> : <Mic className="w-5 h-5" strokeWidth={2} />}
                    <span className="font-semibold">{isMicMuted ? 'Unmute microphone' : 'Mute microphone'}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsChatVisible((v) => !v);
                    setIsLiveSettingsOpen(false);
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-white hover:brightness-125"
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5" strokeWidth={2} />
                    <span className="font-semibold">{isChatVisible ? 'Hide comments' : 'Show comments'}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await handleShare();
                    setIsLiveSettingsOpen(false);
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-white hover:brightness-125"
                >
                  <div className="flex items-center gap-3">
                    <Share2 className="w-5 h-5" strokeWidth={2} />
                    <span className="font-semibold">Share</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Gift Overlay Animation */}
      <GiftAnimationOverlay streamId={effectiveStreamId} />

      {/* Gift Panel Slide-up */}
      {showGiftPanel && (
        <>
          <div 
            className="absolute inset-0 bg-[#13151A]/40 pointer-events-auto"
            style={{ zIndex: 99998 }}
            onClick={() => setShowGiftPanel(false)}
          />
          <div 
            className="absolute bottom-0 left-0 right-0 h-[40dvh] z-[999999] pointer-events-auto"
          >
            <GiftPanel 
              onSelectGift={handleSendGift} 
              userCoins={coinBalance} 
              onRechargeSuccess={(newBalance) => setCoinBalance(newBalance)}
            />
          </div>
        </>
      )}

      {/* Full-screen Video Effect Overlay (Behind controls but above video) */}
      <GiftOverlay 
        videoSrc={currentGift} 
        onEnded={handleGiftEnded} 
        isBattleMode={isBattleMode}
      />
      
      {/* ═══ SHARE PANEL ═══ */}
      {showSharePanel && (
        <>
          <div 
            className="absolute inset-0 bg-black/40 pointer-events-auto" 
            style={{ zIndex: 99998 }}
            onClick={() => setShowSharePanel(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 z-[99999] pointer-events-auto">
          <div className="bg-[#1C1E24]/95 rounded-t-2xl p-4 pb-safe flex flex-col gap-1 shadow-2xl w-full max-h-[40dvh] overflow-y-auto no-scrollbar">
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
            
            {/* Followers List - populated from real data */}
            <div className="w-full overflow-hidden shrink-0">
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar items-center">
                {creators.filter(c => c.name.toLowerCase().includes(shareQuery.toLowerCase())).map((u) => (
                  <button 
                    key={u.id} 
                    className="flex flex-col items-center gap-1 min-w-[56px] active:scale-95 transition-transform"
                    onClick={() => {
                      setShowSharePanel(false);
                    }}
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

            {/* Social Row */}
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
                       const shareUrl = `https://app.com/live/${effectiveStreamId}`;
                       navigator.clipboard.writeText(shareUrl);
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

            {/* Actions Row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar shrink-0">
              {[
                { name: 'Promote', color: '#C9A96E', icon: <TrendingUp size={24} className="text-white" />, action: () => { if (navigator.share) navigator.share({ title: 'Watch my LIVE on Elix!', url: window.location.href }); } },
                { name: 'Report', color: '#EF4444', icon: <AlertTriangle size={24} className="text-white" />, action: () => setIsReportModalOpen(true) },
                { name: 'Add Story', color: '#3B82F6', icon: <PlusCircle size={24} className="text-white" />, action: () => navigate('/create') },
                { name: 'Settings', color: '#6B7280', icon: <Settings2 size={24} className="text-white" />, action: () => setIsLiveSettingsOpen(true) },
              ].map((item) => (
                <button 
                  key={item.name}
                  onClick={() => {
                    item.action();
                    setShowSharePanel(false);
                  }}
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

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        videoId={effectiveStreamId || ''}
        contentType="live"
      />

      {/* Combo Button Overlay - Moved to top-most layer */}
      <AnimatePresence>
        {showComboButton && lastSentGift && (
            <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute right-4 bottom-[120px] z-[100000] flex flex-col items-center pointer-events-auto"
            >
                <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleComboClick();
                    }}
                    className="w-16 h-14 rounded-full bg-gradient-to-r from-secondary to-[#C9A96E] flex flex-col items-center justify-center animate-pulse active:scale-90 transition-transform shadow-[0_0_20px_rgba(201,169,110,0.5)] border-2 border-white/30"
                >
                    <span className="text-xl font-black italic text-white drop-shadow-md">x{comboCount}</span>
                    <span className="text-[9px] font-bold text-white uppercase tracking-widest">Combo</span>
                </button>
                <div className="mt-1 px-3 py-1 text-[10px] text-secondary font-bold bg-[#13151A]/60 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
                    Send {lastSentGift.name}
                </div>
            </motion.div>
        )}
      </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
