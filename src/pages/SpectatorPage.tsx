import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
  TrendingUp,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Keyboard,
  Coins,
  Lock,
  Crown,
  Trophy,
  Plus,
  PlusCircle,
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
import PromotePanel from '../components/PromotePanel';
import { RankingPanel } from '../components/RankingPanel';
import { websocket } from '../lib/websocket';
import { useLiveWebRTC } from '../hooks/useLiveWebRTC';
import { IS_STORE_BUILD } from '../config/build';

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

const StreamVideo = ({ stream, className, style, ...props }: React.VideoHTMLAttributes<HTMLVideoElement> & { stream?: MediaStream }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return <video ref={ref} autoPlay playsInline className={className} style={style} {...props} />;
};

interface SpectatorBattleState {
  active: boolean;
  hostScore: number;
  opponentScore: number;
  player3Score?: number;
  player4Score?: number;
  timeLeft: number;
  opponentName?: string;
  player3Name?: string;
  player4Name?: string;
  winner?: string;
  opponentUserId?: string;
  player3UserId?: string;
  player4UserId?: string;
}

export default function SpectatorPage() {
  const { streamId } = useParams<{ streamId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const effectiveStreamId = streamId || '';

  const [hostName, setHostName] = useState('Creator');
  const [hostAvatar, setHostAvatar] = useState('');
  const [hostUserId, setHostUserId] = useState('');
  const hostUserIdRef = useRef('');
  const [streamIsLive, setStreamIsLive] = useState<boolean | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [activeLikes, setActiveLikes] = useState(0);

  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [coinBalance, setCoinBalance] = useState(0);
  const getPersistedTestCoinsBalance = (userId: string | undefined) => {
    if (!userId || typeof localStorage === 'undefined') return 0;
    try {
      const v = localStorage.getItem(`elix_test_coins_balance_${userId}`);
      return v ? Math.max(0, parseInt(v, 10)) : 0;
    } catch { return 0; }
  };
  const persistTestCoinsBalance = (userId: string | undefined, balance: number) => {
    if (!userId || typeof localStorage === 'undefined') return;
    try { localStorage.setItem(`elix_test_coins_balance_${userId}`, String(Math.max(0, balance))); } catch {}
  };

  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [showPromotePanel, setShowPromotePanel] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [showRankingPanel, setShowRankingPanel] = useState(false);
  const [showFanClub, setShowFanClub] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showCoHostPanel, setShowCoHostPanel] = useState(false);
  const [streamEndedReceived, setStreamEndedReceived] = useState(false);

  const [showTestCoinsModal, setShowTestCoinsModal] = useState(false);
  const [testCoinsStep, setTestCoinsStep] = useState<'password' | 'amount'>('password');
  const TEST_COINS_PWD_KEY = 'elix_test_coins_pwd_saved';
  const TEST_COINS_VERIFIED_KEY = 'elix_test_coins_verified';
  const [testCoinsPwd, setTestCoinsPwd] = useState('');
  const [testCoinsAmount, setTestCoinsAmount] = useState('');
  const [testCoinsError, setTestCoinsError] = useState('');
  const [testCoinsSavePwd, setTestCoinsSavePwd] = useState(!!(typeof localStorage !== 'undefined' && localStorage.getItem(TEST_COINS_PWD_KEY)));
  const testCoinsPwdRef = useRef<HTMLInputElement>(null);
  const TEST_COINS_HASH = '169a9bfc269089e14090ad2e393b17e945d798598c33993bcab5feef93e68508';
  const [currentGift, setCurrentGift] = useState<string | null>(null);
  const [giftQueue, setGiftQueue] = useState<string[]>([]);
  const [shareQuery, setShareQuery] = useState('');
  const [shareContacts, setShareContacts] = useState<{ id: string; name: string; avatar: string }[]>([]);
  const [lastSentGift, setLastSentGift] = useState<typeof GIFTS[0] | null>(null);
  const [comboCount, setComboCount] = useState(0);
  const [showComboButton, setShowComboButton] = useState(false);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetComboTimer = () => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => { setShowComboButton(false); setComboCount(0); }, 5000);
  };

  const [showChatInput, setShowChatInput] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [showViewersPanel, setShowViewersPanel] = useState(false);
  const [viewersList, setViewersList] = useState<{ id: string; name: string; avatar: string; level?: number }[]>([]);
  const actualViewersRef = useRef<Map<string, { name: string; avatar: string; level: number }>>(new Map());

  const [joinRequested, setJoinRequested] = useState(false);

  const [userLevel, setUserLevel] = useState(user?.level || 1);
  const [userXP, setUserXP] = useState(0);

  const viewerName = user?.username || user?.name || 'Viewer';
  const viewerAvatar = user?.avatar || '';

  const [moderators, setModerators] = useState<Set<string>>(new Set());
  const isModerator = moderators.has(user?.id || '');

  const [hasJoinedToday, setHasJoinedToday] = useState(false);
  const [myHeartCount, setMyHeartCount] = useState(0);

  // ═══════════════════════════════════════════════════
  // BATTLE STATE (spectator sees host's battle status)
  // ═══════════════════════════════════════════════════
  const [spectatorBattle, setSpectatorBattle] = useState<SpectatorBattleState | null>(null);

  // ═══════════════════════════════════════════════════
  // CO-HOST STATE
  // ═══════════════════════════════════════════════════
  const [isCoHosting, setIsCoHosting] = useState(false);
  const [coHostStream, setCoHostStream] = useState<MediaStream | null>(null);
  const coHostChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [pendingCoHostInvite, setPendingCoHostInvite] = useState<{ notifId: string; hostName: string; hostAvatar: string; streamKey: string; hostUserId: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const chan = supabase
      .channel(`spectator_cohost_invite_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const row = payload.new;
          if (row?.type === 'cohost_invite') {
            setPendingCoHostInvite({
              notifId: row.id,
              hostName: row.data?.host_name || 'Someone',
              hostAvatar: row.data?.host_avatar || '',
              streamKey: row.data?.stream_key || '',
              hostUserId: row.data?.actor_id || '',
            });
          }
          if (row?.type === 'cohost_accepted') {
            const streamKey = row.data?.stream_key || '';
            if (streamKey) {
              showToast('Co-host request accepted! Joining...');
              navigate(`/watch/${streamKey}?cohost=1`);
            }
          }
          
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [user?.id]);
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [isCamOff, setIsCamOff] = useState(false);

  const isCoHostFromUrl = new URLSearchParams(location.search).get('cohost') === '1';

  // If arrived via ?cohost=1, auto-start co-hosting
  useEffect(() => {
    if (!isCoHostFromUrl || !user?.id || isCoHosting) return;
    startCoHosting();
  }, [isCoHostFromUrl, user?.id]);

  const startCoHosting = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = false;
      setCoHostStream(stream);
      setIsCoHosting(true);

      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
        myVideoRef.current.play().catch(() => {});
      }

      if (coHostChanRef.current) { supabase.removeChannel(coHostChanRef.current); }
      const chan = supabase.channel(`cohost_presence_${effectiveStreamId}`, {
        config: {
          presence: {
            key: user?.id,
          },
        },
      });
      coHostChanRef.current = chan;
      chan.on('presence', { event: 'sync' }, () => {}).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await chan.track({
            userId: user?.id,
            name: user?.username || user?.name || viewerName,
            avatar: user?.avatar || viewerAvatar,
            joinedAt: new Date().toISOString(),
          });
        }
      });

      showToast('You are now co-hosting!');
      setMessages(prev => [...prev, {
        id: `cohost-${Date.now()}`,
        username: 'System',
        text: 'You joined as co-host',
        isSystem: true,
      }]);
    } catch {
      showToast('Camera access denied');
    }
  };

  const stopCoHosting = () => {
    if (coHostStream) {
      coHostStream.getTracks().forEach(t => t.stop());
      setCoHostStream(null);
    }
    if (coHostChanRef.current) {
      supabase.removeChannel(coHostChanRef.current);
      coHostChanRef.current = null;
    }
    setIsCoHosting(false);
    setIsMicMuted(true);
    setIsCamOff(false);
  };

  const toggleMic = () => {
    if (!coHostStream) return;
    const audioTrack = coHostStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMicMuted;
      setIsMicMuted(!isMicMuted);
    }
  };

  const toggleCam = () => {
    if (!coHostStream) return;
    const videoTrack = coHostStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = isCamOff;
      setIsCamOff(!isCamOff);
    }
  };

  // Cleanup co-host camera on unmount
  useEffect(() => {
    return () => {
      if (coHostStream) {
        coHostStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [coHostStream]);

  // Attach co-host stream to my video ref
  useEffect(() => {
    if (isCoHosting && coHostStream && myVideoRef.current) {
      myVideoRef.current.srcObject = coHostStream;
      myVideoRef.current.play().catch(() => {});
    }
  }, [isCoHosting, coHostStream]);

  // WebRTC: receive broadcaster's live camera stream (+ send co-host stream if co-hosting)
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStream, setHasStream] = useState(false);

  const { remotePeers, error: webrtcError, joinRoom: retryJoinRoom } = useLiveWebRTC({
    roomId: effectiveStreamId,
    localUserId: user?.id || '',
    localStream: coHostStream,
    enabled: !!effectiveStreamId && !!user?.id && streamIsLive === true,
  });
  const [showRetryButton, setShowRetryButton] = useState(false);
  useEffect(() => {
    if (hasStream) { setShowRetryButton(false); return; }
    const t = setTimeout(() => { if (!hasStream) setShowRetryButton(true); }, 10000);
    return () => clearTimeout(t);
  }, [hasStream]);

  useEffect(() => {
    setHasStream(remotePeers.length > 0);
  }, [remotePeers]);

  useEffect(() => {
    if (webrtcError) {
      showToast(`Connection error: ${webrtcError}`);
    }
  }, [webrtcError]);

  // Fetch host profile
  useEffect(() => {
    if (!effectiveStreamId) return;
    (async () => {
      let stream: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data } = await supabase
          .from('live_streams')
          .select('user_id, title, viewer_count, is_live')
          .eq('stream_key', effectiveStreamId)
          .maybeSingle();
        stream = data;
        if (stream?.is_live) break;
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
      }
      if (!stream || !stream.is_live) {
        setStreamIsLive(false);
        showToast('Stream is offline');
        setTimeout(() => navigate('/feed', { replace: true }), 2000);
        return;
      }
      setStreamIsLive(true);
      if (stream.user_id) {
        setHostUserId(stream.user_id);
        hostUserIdRef.current = stream.user_id;
        actualViewersRef.current.delete(stream.user_id);
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
        const currentUser = (await supabase.auth.getUser()).data.user;
        if (currentUser && stream.user_id) {
          const { data: follow } = await supabase.from('followers').select('id').eq('follower_id', currentUser.id).eq('following_id', stream.user_id).maybeSingle();
          if (follow) setIsFollowing(true);
        }
      }
    })();
  }, [effectiveStreamId, navigate]);

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
        if (data.coins != null) {
          const dbCoins = Number(data.coins);
          const persisted = getPersistedTestCoinsBalance(user.id);
          setCoinBalance(Math.max(dbCoins, persisted));
        }
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (showTestCoinsModal) {
      const verified = localStorage.getItem(TEST_COINS_VERIFIED_KEY);
      const ts = verified ? parseInt(verified, 10) : NaN;
      if (ts && Date.now() - ts < 24 * 60 * 60 * 1000) {
        setTestCoinsStep('amount');
      } else {
        setTestCoinsStep('password');
        setTimeout(() => testCoinsPwdRef.current?.focus(), 100);
      }
    }
  }, [showTestCoinsModal]);

  // Refresh coins when gift panel opens - use max of local, DB and persisted so test coins stay
  useEffect(() => {
    if (showGiftPanel && user?.id) {
      supabase
        .from('profiles')
        .select('coins')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.coins != null) {
            const dbCoins = Number(data.coins);
            const persisted = getPersistedTestCoinsBalance(user.id);
            setCoinBalance(prev => Math.max(prev, dbCoins, persisted));
          }
        });
    }
  }, [showGiftPanel, user?.id]);

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!user?.id) {
        navigate('/login');
        return;
      }
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session?.access_token}` },
        body: JSON.stringify({ creatorId: effectiveStreamId, userId: user.id }),
      });
      if (res.ok) {
        const data = await res.json();
        const url = data.url;
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

  // Viewer count: increment on join, decrement on leave + realtime updates
  useEffect(() => {
    if (!effectiveStreamId) return;

    const chan = supabase
      .channel(`spectator_viewers_${effectiveStreamId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams',
        filter: `stream_key=eq.${effectiveStreamId}`,
      }, async (payload: any) => {
        if (payload.new?.viewer_count != null) setViewerCount(payload.new.viewer_count);
        if (payload.new?.is_live === false) {
          await new Promise(r => setTimeout(r, 3000));
          const { data: recheck } = await supabase
            .from('live_streams')
            .select('is_live')
            .eq('stream_key', effectiveStreamId)
            .maybeSingle();
          if (!recheck || !recheck.is_live) {
            showToast('Stream ended');
            setTimeout(() => navigate('/feed', { replace: true }), 2000);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chan);
    };
  }, [effectiveStreamId, navigate]);

  // WebSocket: connect to room for real-time chat, gifts, join/leave
  // Only connect after stream is verified live — avoids reconnect loop from racing with stream fetch
  useEffect(() => {
    if (!effectiveStreamId || !user?.id || !streamIsLive) return;

    let mounted = true;

    const connect = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || '';
      if (!token || !mounted) return;
      websocket.connect(effectiveStreamId, token);
    };

    let hostFoundInRoom = false;
    let roomStateReceived = false;
    let roomUsers: string[] = [];

    const handleRoomState = (data: any) => {
      if (!mounted) return;
      roomStateReceived = true;
      const viewers = data.viewers;
      const hid = hostUserIdRef.current;
      if (Array.isArray(viewers)) {
        actualViewersRef.current.clear();
        roomUsers = viewers.map((v: any) => v.user_id).filter(Boolean);
        hostFoundInRoom = false;
        for (const v of viewers) {
          if (v.user_id === hid || v.user_id === effectiveStreamId || v.is_host) {
            hostFoundInRoom = true;
          } else if (v.user_id && v.user_id !== user?.id) {
            actualViewersRef.current.set(v.user_id, {
              name: v.display_name || v.username || 'User',
              avatar: v.avatar_url || '',
              level: v.level || 1,
            });
          }
        }
        if (!hostFoundInRoom && !hid) {
          hostFoundInRoom = true;
        }
      }
    };

    const handleUserJoined = (data: any) => {
      if (!mounted) return;
      if (data.user_id === user?.id) return;
      if (data.user_id === hostUserIdRef.current || data.user_id === effectiveStreamId) {
        hostFoundInRoom = true;
        return;
      }
      if (data.user_id) {
        actualViewersRef.current.set(data.user_id, {
          name: data.display_name || data.username || 'User',
          avatar: data.avatar_url || '',
          level: typeof data.level === 'number' ? data.level : 1,
        });
      }
      const joinName = data.username || 'User';
      setMessages(prev => [...prev, {
        id: `join-${Date.now()}`,
        username: joinName,
        text: 'joined the stream',
        isSystem: true,
        level: typeof data.level === 'number' && Number.isFinite(data.level) ? data.level : 1,
        avatar: typeof data.avatar_url === 'string' ? data.avatar_url : '',
      }]);
      setViewerCount(prev => prev + 1);
    };

    const handleUserLeft = (data: any) => {
      if (!mounted) return;
      if (data.user_id) actualViewersRef.current.delete(data.user_id);
      setViewerCount(prev => Math.max(0, prev - 1));
    };

    const handleChatMessage = (data: any) => {
      if (!mounted) return;
      if (data.user_id === user?.id) return;
      const msg: LiveMessage = {
        id: `ws-${Date.now()}-${Math.random()}`,
        username: typeof data.username === 'string' ? data.username : 'User',
        text: typeof data.text === 'string' ? data.text : '',
        level: typeof data.level === 'number' && Number.isFinite(data.level) ? data.level : 1,
        avatar: typeof data.avatar === 'string' ? data.avatar : '',
      };
      setMessages(prev => [...prev, msg]);
    };

    const handleGiftSent = (data: any) => {
      if (!mounted) return;
      if (data.user_id === user?.id) return;
      const giftDef = GIFTS.find(g => g.id === data.giftId);
      if (giftDef) {
        const msg: LiveMessage = {
          id: `gift-ws-${Date.now()}-${Math.random()}`,
          username: typeof data.username === 'string' ? data.username : 'User',
          text: `sent ${giftDef.name}`,
          level: typeof data.level === 'number' && Number.isFinite(data.level) ? data.level : 1,
          avatar: typeof data.avatar === 'string' ? data.avatar : '',
          isGift: true,
        };
        setMessages(prev => [...prev, msg]);
        if (giftDef.video && (giftDef.video.startsWith('http://') || giftDef.video.startsWith('https://'))) {
          setGiftQueue(prev => [...prev, giftDef.video]);
        }
      }
    };

    const handleStreamEnded = () => {
      if (!mounted) return;
      setStreamEndedReceived(true);
      setStreamIsLive(false);
      websocket.disconnect();
      setTimeout(() => { if (mounted) navigate('/feed', { replace: true }); }, 2000);
    };

    const handleBattleStateSync = (data: any) => {
      if (!mounted) return;
      if (data.status === 'active' || data.status === 'IN_BATTLE' || data.status === 'ACTIVE') {
        setSpectatorBattle({
          active: true,
          hostScore: data.hostScore || 0,
          opponentScore: data.opponentScore || 0,
          player3Score: data.player3Score || 0,
          player4Score: data.player4Score || 0,
          timeLeft: data.timeLeft || 300,
          opponentName: data.opponentName || '',
          player3Name: data.player3Name || '',
          player4Name: data.player4Name || '',
          opponentUserId: data.opponentUserId || '',
          player3UserId: (data.player3UserId && data.player3UserId !== data.opponentUserId) ? data.player3UserId : '',
          player4UserId: (data.player4UserId && data.player4UserId !== data.opponentUserId && data.player4UserId !== data.player3UserId) ? data.player4UserId : '',
        });
      } else if (data.status === 'ENDED') {
        setSpectatorBattle(prev => prev ? { ...prev, active: false, winner: data.winner } : null);
      } else {
        setSpectatorBattle(null);
      }
    };

    const handleBattleTick = (data: any) => {
      if (!mounted) return;
      setSpectatorBattle(prev => prev ? {
        ...prev,
        active: true,
        timeLeft: data.timeLeft ?? prev.timeLeft,
        hostScore: data.hostScore ?? prev.hostScore,
        opponentScore: data.opponentScore ?? prev.opponentScore,
        player3Score: data.player3Score ?? prev.player3Score,
        player4Score: data.player4Score ?? prev.player4Score,
      } : null);
    };

    const handleBattleScore = (data: any) => {
      if (!mounted) return;
      setSpectatorBattle(prev => prev ? {
        ...prev,
        hostScore: data.hostScore ?? prev.hostScore,
        opponentScore: data.opponentScore ?? prev.opponentScore,
        player3Score: data.player3Score ?? prev.player3Score,
        player4Score: data.player4Score ?? prev.player4Score,
      } : null);
    };

    const handleBattleEnded = (data: any) => {
      if (!mounted) return;
      setSpectatorBattle(prev => prev ? {
        ...prev,
        active: true,
        hostScore: data.hostScore ?? prev.hostScore,
        opponentScore: data.opponentScore ?? prev.opponentScore,
        player3Score: data.player3Score ?? prev.player3Score,
        player4Score: data.player4Score ?? prev.player4Score,
        winner: data.winner,
      } : null);
      setTimeout(() => { if (mounted) setSpectatorBattle(null); }, 2000);
    };

    websocket.on('room_state', handleRoomState);
    websocket.on('user_joined', handleUserJoined);
    websocket.on('user_left', handleUserLeft);
    websocket.on('chat_message', handleChatMessage);
    websocket.on('gift_sent', handleGiftSent);
    websocket.on('stream_ended', handleStreamEnded);
    websocket.on('battle_state_sync', handleBattleStateSync);
    websocket.on('battle_tick', handleBattleTick);
    websocket.on('battle_score', handleBattleScore);
    websocket.on('battle_ended', handleBattleEnded);

    connect();

    const goOffline = async () => {
      if (!mounted) return;
      try {
        const { data: recheck } = await supabase
          .from('live_streams')
          .select('is_live')
          .eq('stream_key', effectiveStreamId)
          .maybeSingle();
        if (recheck?.is_live) return;
      } catch {}
      if (!mounted) return;
      showToast('Stream is offline');
      setStreamIsLive(false);
      websocket.disconnect();
      setTimeout(() => { if (mounted) navigate('/feed', { replace: true }); }, 2000);
    };

    const connectTimeout = setTimeout(() => {
      if (!mounted) return;
      const hid = hostUserIdRef.current;
      if (roomStateReceived && hid && !roomUsers.includes(hid)) {
        hostFoundInRoom = false;
      }
      if (!hostFoundInRoom) goOffline();
    }, 15000);

    const videoTimeout = setTimeout(() => {
      if (!mounted) return;
      const vid = document.querySelector('video');
      const hasTrack = vid?.srcObject && (vid.srcObject as MediaStream).getVideoTracks().length > 0;
      if (!hasTrack && !hostFoundInRoom) goOffline();
    }, 25000);

    return () => {
      mounted = false;
      clearTimeout(connectTimeout);
      clearTimeout(videoTimeout);
      websocket.off('room_state', handleRoomState);
      websocket.off('user_joined', handleUserJoined);
      websocket.off('user_left', handleUserLeft);
      websocket.off('chat_message', handleChatMessage);
      websocket.off('gift_sent', handleGiftSent);
      websocket.off('stream_ended', handleStreamEnded);
      websocket.off('battle_state_sync', handleBattleStateSync);
      websocket.off('battle_tick', handleBattleTick);
      websocket.off('battle_score', handleBattleScore);
      websocket.off('battle_ended', handleBattleEnded);
      websocket.disconnect();
    };
  }, [effectiveStreamId, user?.id, streamIsLive]);

  // Fetch share followers (people you follow / who follow you)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data: followData } = await supabase.from('followers').select('follower_id').eq('following_id', user.id).limit(50);
        const { data: followingData } = await supabase.from('followers').select('following_id').eq('follower_id', user.id).limit(50);
        const ids = new Set<string>();
        (followData || []).forEach((f: any) => ids.add(f.follower_id));
        (followingData || []).forEach((f: any) => ids.add(f.following_id));
        ids.delete(user.id);
        if (ids.size === 0) { setShareContacts([]); return; }
        const { data: profiles } = await supabase.from('profiles').select('user_id, username, display_name, avatar_url').in('user_id', Array.from(ids));
        setShareContacts((profiles || []).map((p: any) => ({
          id: p.user_id,
          name: p.display_name || p.username || 'User',
          avatar: p.avatar_url || '',
        })));
      } catch { setShareContacts([]); }
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

  // Send gift — only when stream is live and WebSocket connected; update points immediately
  const handleSendGift = async (gift: typeof GIFTS[0]) => {
    if (!gift) return;
    if (coinBalance < gift.coins) {
      showToast(`Not enough coins (have ${coinBalance.toLocaleString()}, need ${gift.coins.toLocaleString()})`);
      return;
    }
    if (!websocket.isConnected()) {
      showToast('Connecting... try again in a moment');
      return;
    }

    const prevBalance = coinBalance;
    const afterDeduct = Math.max(0, coinBalance - gift.coins);
    setCoinBalance(afterDeduct);
    persistTestCoinsBalance(user?.id, afterDeduct);

    let newLevel = userLevel;
    let rpcSucceeded = false;

    if (user?.id) {
      try {
        const { data, error } = await supabase.rpc('send_stream_gift', {
          p_stream_key: effectiveStreamId,
          p_gift_id: gift.id,
        });
        if (!error) {
          rpcSucceeded = true;
          const row = Array.isArray(data) ? data[0] : data;
          if (row?.new_balance != null) {
            const nb = Number(row.new_balance);
            setCoinBalance(nb);
            persistTestCoinsBalance(user?.id, nb);
          }
          if (row?.new_level != null) {
            const updatedLevel = Number(row.new_level);
            setUserLevel(updatedLevel);
            updateUser({ level: updatedLevel });
            newLevel = updatedLevel;
          }
          if (row?.new_xp != null) setUserXP(Number(row.new_xp));
        }
      } catch { /* RPC failed, fall through to test-coins path */ }

      if (!rpcSucceeded) {
        // RPC failed — use local test coins balance instead
        const persisted = getPersistedTestCoinsBalance(user?.id);
        if (persisted >= gift.coins) {
          const newPersisted = persisted - gift.coins;
          persistTestCoinsBalance(user?.id, newPersisted);
          setCoinBalance(newPersisted);
          // Try to sync DB too (fire-and-forget)
          supabase.from('profiles').update({ coins: newPersisted }).eq('user_id', user.id).then(() => {});
        } else {
          setCoinBalance(prevBalance);
          persistTestCoinsBalance(user?.id, prevBalance);
          showToast('Not enough coins to send this gift');
          return;
        }
      }

      const xpGained = gift.coins;
      let currentXP = userXP + xpGained;
      let currentLevel = userLevel;
      for (let i = 0; i < 300 && currentXP >= currentLevel * 1000 && currentLevel < 300; i++) {
        currentXP -= currentLevel * 1000;
        currentLevel++;
      }
      setUserLevel(currentLevel);
      setUserXP(currentXP);
      updateUser({ level: currentLevel });
      newLevel = currentLevel;
      supabase.from('profiles').update({ level: currentLevel, xp: currentXP }).eq('user_id', user.id).then(() => {});
    }

    setShowGiftPanel(false);

    if (gift.video && (gift.video.startsWith('http://') || gift.video.startsWith('https://'))) {
      setGiftQueue(prev => [...prev, gift.video]);
    }

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
      coins: gift.coins,
      gift_icon: gift.icon || '🎁',
      quantity: 1,
      level: newLevel,
      avatar: viewerAvatar,
      video: gift.video || null,
      transactionId: `${user?.id || 'anon'}-${Date.now()}`,
      creator_name: hostName || 'Creator',
    });

    setLastSentGift(gift);
    setComboCount(1);
    setShowComboButton(true);
    resetComboTimer();
  };

  const handleComboClick = () => {
    if (!lastSentGift) return;
    setComboCount(prev => prev + 1);
    resetComboTimer();
    handleSendGift(lastSentGift);
  };

  // Heart tap handler
  const handleLikeTap = () => {
    setActiveLikes(prev => prev + 1);
  };

  if (streamIsLive === null) {
    return (
      <div className="fixed inset-0 bg-[#0A0B0E] flex justify-center">
        <div className="relative w-full max-w-[480px] h-full bg-[#13151A] flex flex-col items-center justify-center gap-4 p-6">
          <div className="w-10 h-10 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Checking stream...</p>
        </div>
      </div>
    );
  }

  if (streamIsLive === false) {
    return (
      <div className="fixed inset-0 bg-[#0A0B0E] flex justify-center">
        <div className="relative w-full max-w-[480px] h-full bg-[#13151A] flex flex-col items-center justify-center gap-4 p-6">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
            <span className="text-3xl">{streamEndedReceived ? '🔴' : '📡'}</span>
          </div>
          <h2 className="text-white font-bold text-lg">
            {streamEndedReceived ? 'Stream ended' : 'Stream offline'}
          </h2>
          <p className="text-white/50 text-sm text-center">
            {streamEndedReceived
              ? 'The host has ended the stream. Taking you back...'
              : 'This stream has ended or is not available right now.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/feed', { replace: true })}
            className="mt-2 px-6 py-2.5 rounded-lg bg-[#C9A96E] text-black font-semibold"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0A0B0E] flex justify-center">
      <div className="relative w-full max-w-[480px] h-full bg-[#13151A] overflow-hidden flex flex-col">

        {/* FULL SCREEN VIDEO AREA — live stream via WebRTC */}
        <div className="absolute inset-0 z-0 bg-[#13151A]">
          {spectatorBattle && spectatorBattle.active ? (
            /* BATTLE MODE: Split screen for battle - Added mt-16 to avoid header overlap */
            <div className={`w-full flex flex-col mt-16 ${spectatorBattle.player3UserId || spectatorBattle.player4UserId ? 'aspect-square' : 'h-[36dvh]'}`}>
              {/* Battle Header - Same as LiveStream */}
              <div className="relative z-20 w-full flex-none overflow-hidden" style={{ height: '18px' }}>
                <div className="absolute inset-0 flex">
                  <div className="h-full transition-all duration-500 ease-out" style={{ width: `${(spectatorBattle.hostScore + (spectatorBattle.player3Score||0) + spectatorBattle.opponentScore + (spectatorBattle.player4Score||0)) > 0 ? ((spectatorBattle.hostScore + (spectatorBattle.player3Score||0)) / (spectatorBattle.hostScore + (spectatorBattle.player3Score||0) + spectatorBattle.opponentScore + (spectatorBattle.player4Score||0)) * 100) : 50}%`, backgroundImage: 'linear-gradient(90deg, #DC143C, #FF1744, #C41E3A)' }} />
                  <div className="h-full flex-1 transition-all duration-500 ease-out" style={{ backgroundImage: 'linear-gradient(90deg, #1E90FF, #4169E1, #0047AB)' }} />
                </div>
                <div className="absolute inset-0 z-10 flex items-center justify-between px-2 pointer-events-none">
                  <span className="text-white font-black text-[14px] tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{(spectatorBattle.hostScore + (spectatorBattle.player3Score||0)).toLocaleString()}</span>
                  <span className="text-white font-black text-[14px] tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{(spectatorBattle.opponentScore + (spectatorBattle.player4Score||0)).toLocaleString()}</span>
                </div>
              </div>
              
              {/* Battle timer REMOVED as per user request */}

              {/* Host Video (Top/Left) */}
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex flex-1 min-h-0">
                  <div className="w-1/2 h-full relative bg-black overflow-hidden border-r border-[#C9A96E]/20">
                    <StreamVideo
                      stream={remotePeers.find(p => p.userId === hostUserId)?.stream || remotePeers[0]?.stream}
                      className="w-full h-full object-cover"
                      style={{ opacity: hasStream ? 1 : 0 }}
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm">
                      <span className="text-white text-[10px] font-bold">{hostName}</span>
                    </div>
                    {spectatorBattle.winner === 'host' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-4xl font-black text-[#C9A96E] drop-shadow-lg rotate-[-12deg]">WINNER</span>
                      </div>
                    )}
                  </div>

                  {/* Opponent Video (Top/Right) */}
                  <div className="w-1/2 h-full relative bg-[#1C1E24] overflow-hidden flex items-center justify-center">
                    {remotePeers.find(p => p.userId === spectatorBattle.opponentUserId)?.stream ? (
                      <StreamVideo
                        stream={remotePeers.find(p => p.userId === spectatorBattle.opponentUserId)?.stream}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-[#13151A] border-2 border-blue-500 flex items-center justify-center mx-auto mb-2">
                          <span className="text-xl">VS</span>
                        </div>
                        <p className="text-white/60 text-xs font-bold truncate max-w-[80px]">{spectatorBattle.opponentName || 'Opponent'}</p>
                      </div>
                    )}
                    {spectatorBattle.winner === 'opponent' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-4xl font-black text-blue-500 drop-shadow-lg rotate-[-12deg]">WINNER</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Row 2: Player 3 & 4 (if active) */}
                {(spectatorBattle.player3UserId || spectatorBattle.player4UserId) && (
                  <div className="flex flex-1 min-h-0 border-t border-[#C9A96E]/20">
                     {/* Player 3 */}
                    <div className="w-1/2 h-full relative bg-[#1C1E24] overflow-hidden flex items-center justify-center border-r border-[#C9A96E]/20">
                      {remotePeers.find(p => p.userId === spectatorBattle.player3UserId)?.stream ? (
                        <StreamVideo
                          stream={remotePeers.find(p => p.userId === spectatorBattle.player3UserId)?.stream}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <p className="text-white/60 text-xs font-bold truncate max-w-[80px]">{spectatorBattle.player3Name || 'P3'}</p>
                        </div>
                      )}
                      {spectatorBattle.winner === 'player3' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="text-4xl font-black text-[#C9A96E] drop-shadow-lg rotate-[-12deg]">WINNER</span>
                        </div>
                      )}
                    </div>
                     {/* Player 4 */}
                    <div className="w-1/2 h-full relative bg-[#1C1E24] overflow-hidden flex items-center justify-center">
                      {remotePeers.find(p => p.userId === spectatorBattle.player4UserId)?.stream ? (
                        <StreamVideo
                          stream={remotePeers.find(p => p.userId === spectatorBattle.player4UserId)?.stream}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <p className="text-white/60 text-xs font-bold truncate max-w-[80px]">{spectatorBattle.player4Name || 'P4'}</p>
                        </div>
                      )}
                      {spectatorBattle.winner === 'player4' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="text-4xl font-black text-blue-500 drop-shadow-lg rotate-[-12deg]">WINNER</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : isCoHosting ? (
            /* SPLIT SCREEN: host on top, co-host (me) on bottom */
            <div className="w-full h-full flex flex-col">
              <div className="flex-1 relative bg-black overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  autoPlay
                  style={{ opacity: hasStream ? 1 : 0, transition: 'opacity 0.4s ease' }}
                />
                {!hasStream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#13151A]">
                    <div className="w-16 h-16 rounded-full border-[3px] border-red-500/40 overflow-hidden">
                      {hostAvatar ? (
                        <img src={hostAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#C9A96E]/20 flex items-center justify-center">
                          <span className="text-[#C9A96E] font-bold text-2xl">{hostName.slice(0, 1).toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm">
                  <span className="text-white text-[10px] font-bold">{hostName}</span>
                </div>
              </div>
              <div className="flex-1 relative bg-black overflow-hidden border-t-2 border-[#C9A96E]/30">
                <video
                  ref={myVideoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  autoPlay
                  muted
                  style={{ transform: 'scaleX(-1)', opacity: isCamOff ? 0 : 1, transition: 'opacity 0.3s ease' }}
                />
                {isCamOff && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#13151A]">
                    <CameraOff size={32} className="text-white/30" />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm">
                  <span className="text-white text-[10px] font-bold">You</span>
                </div>
                {/* Co-host controls: mic (active only in host view), cam, leave */}
                <div className="absolute top-2 right-2 flex items-center gap-2 z-[5]">
                  <button
                    type="button"
                    title={isMicMuted ? 'Unmute mic' : 'Mute mic'}
                    onClick={toggleMic}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isMicMuted ? 'bg-red-500/80' : 'bg-black/50 backdrop-blur-sm'}`}
                  >
                    {isMicMuted ? <MicOff size={14} className="text-white" /> : <Mic size={14} className="text-white" />}
                  </button>
                  <button
                    type="button"
                    title={isCamOff ? 'Turn on camera' : 'Turn off camera'}
                    onClick={toggleCam}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isCamOff ? 'bg-red-500/80' : 'bg-black/50 backdrop-blur-sm'}`}
                  >
                    {isCamOff ? <CameraOff size={14} className="text-white" /> : <Camera size={14} className="text-white" />}
                  </button>
                  <button
                    type="button"
                    title="Leave co-host"
                    onClick={stopCoHosting}
                    className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center"
                  >
                    <X size={14} className="text-white" />
                  </button>
                </div>
              </div>
            </div>
          ) : remotePeers.length > 1 ? (
            /* MULTI-PEER GRID (Spectator view of Co-hosts) */
            <div className="w-full h-full flex flex-col bg-black">
              <div className="flex-1 relative border-b border-[#C9A96E]/20">
                 <StreamVideo
                   stream={remotePeers.find(p => p.userId === hostUserId)?.stream || remotePeers[0]?.stream}
                   className="w-full h-full object-cover"
                 />
                 <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm">
                   <span className="text-white text-[10px] font-bold">{hostName}</span>
                 </div>
               </div>
               <div className="flex-1 relative">
                 <StreamVideo
                   stream={remotePeers.find(p => p.userId !== hostUserId)?.stream || remotePeers[1]?.stream}
                   className="w-full h-full object-cover"
                 />
               </div>
            </div>
          ) : (
            /* NORMAL FULL SCREEN: host video only */
            <>
              <StreamVideo
                 stream={remotePeers.find(p => p.userId === hostUserId)?.stream || remotePeers[0]?.stream}
                 className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: hasStream ? 1 : 0, transition: 'opacity 0.4s ease' }}
              />
              {!hasStream && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                  <div className="w-24 h-24 rounded-full border-[3px] border-red-500/40 overflow-hidden">
                    {hostAvatar ? (
                      <img src={hostAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#C9A96E]/20 flex items-center justify-center">
                        <span className="text-[#C9A96E] font-bold text-3xl">{hostName.slice(0, 1).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
                    <span className="text-white/60 text-sm">Connecting to stream...</span>
                  </div>
                  {showRetryButton && (
                    <button
                      type="button"
                      onClick={() => { setShowRetryButton(false); retryJoinRoom(); setTimeout(() => { if (!hasStream) setShowRetryButton(true); }, 8000); }}
                      className="mt-2 px-5 py-2 rounded-lg bg-[#C9A96E]/20 border border-[#C9A96E]/40 text-[#C9A96E] text-sm font-medium"
                    >
                      Tap to retry
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* TOP BAR */}
        <div className="absolute top-0 left-0 right-0 z-[110] pointer-events-none">
          <div className="px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}>
            <div className="flex items-center justify-between gap-2">
              {/* Left: Creator info */}
              <div className="pointer-events-auto flex items-center gap-0 -ml-1 flex-shrink min-w-0">
                <div
                  className="relative z-10 flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                  onClick={() => navigate(`/profile/${hostUserId}`)}
                >
                  <AvatarRing src={hostAvatar} alt={hostName} size={44} />
                </div>
                <div
                  className="flex flex-col justify-center -ml-3 pl-5 pr-3 h-8 rounded-full border border-[#C9A96E]/60 bg-[#13151A]/80 min-w-0"
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, boxShadow: '0 0 8px rgba(201,169,110,0.25)' }}
                >
                  <span className="text-white text-[11px] font-bold truncate max-w-[100px] leading-tight">{hostName}</span>
                  <div className="flex items-center gap-1 -mt-0.5">
                    <Heart className="w-2.5 h-2.5 text-[#FF2D55]" strokeWidth={2.5} fill="#FF2D55" />
                    <span className="text-white/70 text-[8px] font-bold tabular-nums">{(typeof activeLikes === 'number' && Number.isFinite(activeLikes) ? activeLikes : 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Right: viewer count + close */}
              <div className="pointer-events-auto flex items-center gap-2 flex-shrink-0">
                {/* Viewer count circle with plus icon */}
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#13151A]/70 border border-white/10 active:scale-95 transition-transform"
                  onClick={() => {
                    const list: { id: string; name: string; avatar: string; level?: number }[] = [];
                    const hid = hostUserIdRef.current || hostUserId || effectiveStreamId;
                    actualViewersRef.current.forEach((v, id) => {
                      if (id !== user?.id && id !== hid && id !== effectiveStreamId) {
                        list.push({ id, name: v.name, avatar: v.avatar, level: v.level });
                      }
                    });
                    setViewersList(list);
                    setShowViewersPanel(true);
                  }}
                >
                  <Eye size={12} className="text-white/60" />
                  <span className="text-white text-[11px] font-bold tabular-nums">
                    {viewerCount >= 1000 ? (viewerCount / 1000).toFixed(1) + 'K' : viewerCount}
                  </span>
                  <UserPlus size={10} className="text-[#C9A96E]" />
                </button>
                <button
                  type="button"
                  title="Leave stream"
                  onClick={() => {
                    websocket.disconnect();
                    if (coHostStream) { coHostStream.getTracks().forEach(t => t.stop()); setCoHostStream(null); }
                    navigate('/feed', { replace: true });
                  }}
                  className="w-8 h-8 rounded-full bg-[#13151A]/60 border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <X size={16} className="text-white/80" />
                </button>
              </div>
            </div>

            {/* Weekly Ranking + Membership + Follow — same as creator page */}
            <div className="flex items-center gap-2 mt-1 ml-1 pointer-events-auto flex-wrap px-1">
              <div
                className="flex items-center gap-1 bg-[#13151A] rounded-full px-2 py-0.5 border border-[#C9A96E]/40 shadow-sm cursor-pointer active:scale-95 transition-transform"
                onClick={() => setShowRankingPanel(true)}
              >
                <Trophy className="w-2.5 h-2.5 text-[#C9A96E]" />
                <span className="text-[#C9A96E] text-[9px] font-bold whitespace-nowrap">Weekly Ranking &gt;</span>
              </div>
              <div
                className="flex items-center gap-1 bg-[#13151A] rounded-full px-2 py-0.5 border border-[#C9A96E]/40 shadow-sm cursor-pointer active:scale-95 transition-transform"
                onClick={() => setShowFanClub(true)}
              >
                <Heart className="w-2.5 h-2.5 text-[#C9A96E] fill-[#C9A96E]" />
                <span className="text-[#C9A96E] text-[9px] font-bold whitespace-nowrap">Membership</span>
              </div>
              {!isFollowing && (
                <button
                  type="button"
                  className="flex items-center gap-1 bg-[#FF2D55] rounded-full px-2 py-0.5 shadow-sm border border-white/20 active:scale-95 transition-transform"
                  onClick={async () => {
                    setIsFollowing(true);
                    if (user?.id && hostUserId) {
                      try { await supabase.from('followers').insert({ follower_id: user.id, following_id: hostUserId }); } catch {}
                    }
                  }}
                >
                  <UserPlus size={10} className="text-white" strokeWidth={3} />
                  <span className="text-white text-[9px] font-bold">Follow</span>
                </button>
              )}
            </div>
          </div>
        </div>
        {/* CHAT */}
        <div className="chat-zone fixed left-0 right-0 bottom-[calc(58px+max(12px,env(safe-area-inset-bottom)))] z-[5] flex justify-center pointer-events-none">
          <div className="w-full max-w-[480px] h-[25dvh] max-h-[25dvh] overflow-y-auto pointer-events-auto bg-transparent">
            <ChatOverlay
              messages={messages}
              variant="panel"
              compact
              isModerator={isModerator}
              onLike={() => {}}
              onProfileTap={() => {}}
            />
          </div>
        </div>

        {/* COMBO BUTTON — above bottom buttons */}
        {showComboButton && lastSentGift && (
          <div className="fixed bottom-[calc(63px+max(12px,env(safe-area-inset-bottom)))] right-3 z-[121] pointer-events-auto max-w-[480px]">
            <button
              type="button"
              onClick={handleComboClick}
              className="w-16 h-14 rounded-full bg-gradient-to-r from-[#C9A96E] to-[#D4A017] flex flex-col items-center justify-center animate-pulse active:scale-90 transition-transform shadow-[0_0_20px_rgba(201,169,110,0.5)] border-2 border-white/30"
            >
              <span className="text-xl font-black italic text-white drop-shadow-md">x{comboCount}</span>
              <span className="text-[9px] font-bold text-white uppercase tracking-widest">Combo</span>
            </button>
          </div>
        )}

        {/* BOTTOM BAR — buttons in front of video, lifted 18mm up from bottom — hidden during gift animation */}
        <div className={`fixed left-0 right-0 z-[120] pointer-events-auto flex justify-center ${currentGift ? 'hidden' : ''}`} style={{ bottom: '18mm' }}>
          <div className="w-full max-w-[480px] px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 bg-transparent">
          <div className="flex items-center gap-2">
          <form
            className="flex-1 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-2 border border-white/10 h-10 min-w-0"
            onSubmit={(e) => { handleSendMessage(e); }}
          >
            <input
              type="text"
              inputMode="text"
              enterKeyHint="send"
              autoComplete="off"
              placeholder="Say something..."
              className="bg-transparent text-white text-xs outline-none flex-1 placeholder:text-white/30 min-w-0"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            {inputValue.trim() && (
              <button type="submit" title="Send message" className="text-[#C9A96E] flex-shrink-0">
                <Send size={16} />
              </button>
            )}
          </form>

          {isCoHosting && (
            <div className="h-10 px-2 rounded-full bg-[#C9A96E]/20 border border-[#C9A96E]/40 flex items-center justify-center gap-1 flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#C9A96E] animate-pulse" />
              <span className="text-[#C9A96E] text-[8px] font-bold">Live</span>
            </div>
          )}

          {/* Co-Host — same button as live page; opens co-host panel */}
          {!isCoHosting && (
            <button type="button" title="Co-Host" onClick={() => setShowCoHostPanel(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg relative flex-shrink-0 active:scale-95 transition-transform">
              <span className="flex items-center justify-center w-full h-full relative z-[2]"><UserPlus size={20} className="text-[#C9A96E] shrink-0" strokeWidth={2} /></span>
              <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
            </button>
          )}

          {/* Gift */}
          <button type="button" title="Send gift" onClick={() => setShowGiftPanel(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform relative flex-shrink-0">
            <Gift size={20} className="text-[#C9A96E] relative z-[2]" />
            <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
          </button>

            {/* Share */}
            <button type="button" title="Share" onClick={() => setShowSharePanel(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform relative">
              <Share2 size={20} className="text-[#C9A96E] relative z-[2]" />
              <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
            </button>

            {/* More (3 dots) */}
            <button type="button" title="More options" onClick={() => setIsMoreMenuOpen(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform relative flex-shrink-0">
              <MoreVertical size={20} className="text-[#C9A96E] relative z-[2]" />
              <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
            </button>
          </div>
          </div>
        </div>

        {/* GIFT ANIMATION OVERLAY */}
        <GiftAnimationOverlay streamId={effectiveStreamId} />

        {/* GIFT VIDEO OVERLAY */}
        <GiftOverlay videoSrc={currentGift} onEnded={handleGiftEnded} isBattleMode={!!spectatorBattle?.active} />

        {/* BATTLE STATUS BAR — full-width thin banner for spectators */}
        {spectatorBattle && (
          <div className="absolute top-[calc(env(safe-area-inset-top,0px)+48px)] left-0 right-0 z-[50] pointer-events-none">
            <div className="w-full h-6 flex items-center justify-between px-3 bg-gradient-to-r from-red-900/70 via-[#13151A]/80 to-blue-900/70 backdrop-blur-sm border-b border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 text-[9px] font-bold uppercase tracking-wider">Battle</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#C9A96E] text-[11px] font-black">{spectatorBattle.hostScore}</span>
                <span className="text-white/30 text-[9px]">—</span>
                <span className="text-blue-400 text-[11px] font-black">{spectatorBattle.opponentScore}</span>
              </div>
              {spectatorBattle.active && spectatorBattle.timeLeft > 0 ? (
                <span className="text-white/50 text-[9px] font-bold tabular-nums">
                  {Math.floor(spectatorBattle.timeLeft / 60)}:{(spectatorBattle.timeLeft % 60).toString().padStart(2, '0')}
                </span>
              ) : spectatorBattle.winner ? (
                <span className="text-[#C9A96E] text-[9px] font-bold">
                  {spectatorBattle.winner === 'host' ? 'Host wins!' : spectatorBattle.winner === 'draw' ? 'Draw!' : 'Opponent wins!'}
                </span>
              ) : <span />}
            </div>
          </div>
        )}

        {/* ═══ SUPER FAN GOAL PANEL (Membership) — same as creator page */}
        {showFanClub && (
          <>
            <div
              className="fixed inset-0 bg-black/40 pointer-events-auto"
              style={{ zIndex: 99998 }}
              onClick={() => setShowFanClub(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-[99999] pointer-events-auto max-w-[480px] mx-auto">
              <div
                className="bg-[#1C1E24]/95 rounded-t-2xl p-3 pb-safe max-h-[40vh] overflow-y-auto no-scrollbar shadow-2xl w-full border-t border-[#C9A96E]/20"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center justify-center pt-3 pb-1 gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#C9A96E] shadow-[0_0_6px_rgba(201,169,110,0.5)]" />
                  <div className="w-10 h-1 bg-white/20 rounded-full" />
                </div>
                <div className="flex items-center justify-between px-4 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-3 h-3 text-[#C9A96E]" strokeWidth={2} fill="#C9A96E" />
                    <span className="text-gold-metallic font-bold text-sm">Super Fan Goal</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-4 no-scrollbar">
                  <div className="flex flex-col gap-3">
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
                        <p className="text-[8px] text-white/30 text-center mt-1.5">Non-refundable. Cancel anytime in store settings.</p>
                      </div>
                    </div>
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
                              const newMessage: LiveMessage = {
                                id: Date.now().toString(),
                                username: 'You',
                                text: emoji,
                                level: userLevel,
                                isGift: false,
                                avatar: '/Icons/elix-logo.png',
                                isSystem: false,
                              };
                              setMessages(prev => [...prev, newMessage]);
                              setShowFanClub(false);
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
                                    text: (ev.target?.result as string) || '',
                                    level: userLevel,
                                    isGift: false,
                                    avatar: '/Icons/elix-logo.png',
                                    isSystem: false,
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

        {/* GIFT PANEL — anchored to bottom, above all buttons */}
        {showGiftPanel && (
          <>
            <div
              className="fixed inset-0 bg-black/50 pointer-events-auto"
              style={{ zIndex: 200 }}
              onClick={() => setShowGiftPanel(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 pointer-events-auto max-w-[480px] mx-auto" style={{ zIndex: 201 }}>
              <GiftPanel
                onSelectGift={handleSendGift}
                userCoins={coinBalance}
                onRechargeSuccess={(newBalance) => { setCoinBalance(newBalance); persistTestCoinsBalance(user?.id, newBalance); }}
                onWeeklyRanking={() => { setShowGiftPanel(false); setShowRankingPanel(true); }}
                onMembership={() => { setShowGiftPanel(false); setShowFanClub(true); }}
              />
            </div>
          </>
        )}

        {/* TOP VIEWERS PANEL */}
        {showViewersPanel && (
          <>
            <div
              className="fixed inset-0 bg-black/40 pointer-events-auto"
              style={{ zIndex: 99998 }}
              onClick={() => setShowViewersPanel(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-[999999] pointer-events-auto max-w-[480px] mx-auto">
              <div className="bg-[#1C1E24]/95 backdrop-blur-md rounded-t-2xl h-[40vh] flex flex-col shadow-2xl border-t border-[#C9A96E]/20 overflow-hidden">
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 bg-white/20 rounded-full" />
                </div>
                <div className="flex items-center justify-between px-4 pb-2">
                  <h3 className="text-white font-bold text-sm">Top Viewers</h3>
                  <div className="flex items-center gap-1">
                    <Eye size={12} className="text-white/50" />
                    <span className="text-white/60 text-xs font-semibold">{viewerCount}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4">
                  {viewersList.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    viewersList.map((v, i) => (
                      <button
                        key={v.id}
                        type="button"
                        className="flex items-center gap-3 w-full py-2.5 active:bg-white/5 rounded-xl transition-colors"
                        onClick={() => { setShowViewersPanel(false); navigate(`/profile/${v.id}`); }}
                      >
                        <span className="text-white/30 text-xs font-bold w-5 text-right">{i + 1}</span>
                        <div className="w-10 h-10 rounded-full border-2 border-[#C9A96E]/30 overflow-hidden bg-[#13151A] flex-shrink-0">
                          {v.avatar ? (
                            <img src={v.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-[#C9A96E] font-bold text-sm">{v.name.slice(0, 1).toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-white text-sm font-semibold truncate">{v.name}</p>
                          {v.level && <p className="text-white/40 text-[10px] font-medium">Level {v.level}</p>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
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
              <div className="bg-[#1C1E24]/95 rounded-t-2xl p-4 pb-safe flex flex-col gap-1 shadow-2xl w-full max-h-[40vh] overflow-y-auto overflow-x-hidden">
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
                  <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar items-center px-4" style={{ marginLeft: '-2mm' }}>
                    <button type="button" onClick={() => { setShowSharePanel(false); navigate('/create'); }} className="flex-shrink-0 flex flex-col items-center gap-1.5 min-w-[80px] active:scale-95 transition-transform">
                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <img src="/Icons/Profile icon.png" alt="" className="w-full h-full object-contain" />
                        <Plus size={28} className="text-[#C9A96E] absolute" strokeWidth={2.5} />
                      </div>
                      <span className="text-white/80 text-[11px] font-medium">Create</span>
                    </button>
                    {shareContacts.filter(c => c.name.toLowerCase().includes(shareQuery.toLowerCase())).map((u) => (
                      <button
                        key={u.id}
                        className="flex flex-col items-center gap-1 min-w-[64px] active:scale-95 transition-transform"
                        style={{ marginTop: '6mm' }}
                        onClick={() => setShowSharePanel(false)}
                      >
                        <AvatarRing src={u.avatar || '/Icons/Profile icon.png'} alt={u.name} size={56} />
                        <span className="text-white/60 text-[10px] font-medium truncate w-16 text-center">{u.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-scroll overflow-x-hidden min-h-0 px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:bg-[#C9A96E]/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <div className="grid grid-cols-5 gap-y-3 gap-x-1.5 pt-1">
                    {[
                      { name: 'WhatsApp', icon: <MessageCircle size={22} className="text-white" />, action: () => { window.open(`https://wa.me/?text=${encodeURIComponent('Watch this on Elix! ' + `${window.location.origin}/watch/${effectiveStreamId}`)}`); setShowSharePanel(false); } },
                      { name: 'Facebook', icon: <Share2 size={22} className="text-white" />, action: () => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/watch/${effectiveStreamId}`)}`); setShowSharePanel(false); } },
                      { name: 'Copy Link', icon: <Copy size={22} className="text-white" />, action: () => { navigator.clipboard.writeText(`https://www.elixlive.co.uk/watch/${effectiveStreamId}`); showToast('Link copied!'); setShowSharePanel(false); } },
                      { name: 'Promote', icon: <TrendingUp size={22} className="text-white" />, action: () => { setShowSharePanel(false); setShowPromotePanel(true); } },
                      { name: 'Report', icon: <Flag size={22} className="text-red-400" />, isRed: true, action: () => { setIsReportModalOpen(true); setShowSharePanel(false); } },
                    ].map((item) => (
                      <button key={item.name} onClick={item.action} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                        <div className="relative w-9 h-9 rounded-full bg-[#13151A] overflow-hidden flex items-center justify-center flex-shrink-0">
                          <div className={`relative z-[2] ${item.name === 'Report' ? 'translate-y-0.5' : ''}`}>{React.cloneElement((item.icon as React.ReactElement), { className: `w-3.5 h-3.5 ${(item as { isRed?: boolean }).isRed ? 'text-red-400' : 'text-white'}`, strokeWidth: 1.8 })}</div>
                          <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
                        </div>
                        <span className={`text-[8px] font-semibold truncate w-full text-center ${(item as { isRed?: boolean }).isRed ? 'text-red-400/70' : 'text-white/70'}`}>{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <PromotePanel
          isOpen={showPromotePanel}
          onClose={() => setShowPromotePanel(false)}
          contentType="live"
          content={{
            id: effectiveStreamId,
            title: `Watch ${hostName} on Elix!`,
            thumbnail: hostAvatar,
            username: hostName,
            avatar: hostAvatar,
            postedAt: new Date().toLocaleDateString(),
          }}
        />

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
                  {!IS_STORE_BUILD && (
                  <button
                    type="button"
                    onClick={() => {
                      const v = localStorage.getItem(TEST_COINS_VERIFIED_KEY);
                      const ts = v ? parseInt(v, 10) : NaN;
                      setTestCoinsStep((ts && Date.now() - ts < 24 * 60 * 60 * 1000) ? 'amount' : 'password');
                      setTestCoinsPwd(''); setTestCoinsError(''); setTestCoinsAmount('');
                      setShowTestCoinsModal(true); setIsMoreMenuOpen(false);
                    }}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-colors w-full"
                  >
                    <Coins size={18} className="text-[#C9A96E]" />
                    <span className="text-white text-sm font-medium">Test</span>
                  </button>
                  )}
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

        {/* TEST COINS MODAL — hidden in store build */}
        {!IS_STORE_BUILD && showTestCoinsModal && (
          <>
            <div
              className="fixed inset-0 bg-black/60 pointer-events-auto"
              style={{ zIndex: 100000 }}
              onClick={() => setShowTestCoinsModal(false)}
            />
            <div
              className="fixed inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 100001 }}
            >
              <div
                className="bg-[#1C1E24] rounded-2xl p-5 mx-6 w-full max-w-xs shadow-2xl border border-[#C9A96E]/30 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="w-5 h-5 text-[#C9A96E]" />
                  <span className="text-white font-bold text-base">
                    {testCoinsStep === 'password' ? 'Enter Password' : 'Add Test'}
                  </span>
                </div>

                {testCoinsStep === 'password' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        let hashHex = '';
                        if (typeof crypto !== 'undefined' && crypto.subtle) {
                          const encoder = new TextEncoder();
                          const data = encoder.encode(testCoinsPwd);
                          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                          const hashArray = Array.from(new Uint8Array(hashBuffer));
                          hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                        } else {
                          const target = [99,101,110,97,100,49,57,56,54,63,33];
                          const input = Array.from(testCoinsPwd).map(c => c.charCodeAt(0));
                          hashHex = (input.length === target.length && input.every((v, i) => v === target[i])) ? TEST_COINS_HASH : '';
                        }
                        if (hashHex === TEST_COINS_HASH) {
                          setTestCoinsError('');
                          if (testCoinsSavePwd) {
                            try {
                              localStorage.setItem(TEST_COINS_VERIFIED_KEY, String(Date.now()));
                              localStorage.setItem(TEST_COINS_PWD_KEY, '1');
                            } catch {}
                          } else {
                            try {
                              localStorage.removeItem(TEST_COINS_VERIFIED_KEY);
                              localStorage.removeItem(TEST_COINS_PWD_KEY);
                            } catch {}
                          }
                          setTestCoinsStep('amount');
                        } else {
                          setTestCoinsError('Wrong password');
                          setTestCoinsPwd('');
                        }
                      } catch {
                        setTestCoinsError('Verification failed');
                      }
                    }}
                  >
                    <input
                      ref={testCoinsPwdRef}
                      type="password"
                      autoFocus
                      value={testCoinsPwd}
                      onChange={(e) => { setTestCoinsPwd(e.target.value); setTestCoinsError(''); }}
                      placeholder="Password"
                      className="w-full bg-[#13151A] text-white text-sm rounded-xl px-4 py-3 border border-white/10 focus:border-[#C9A96E]/60 focus:outline-none placeholder:text-white/30 mb-2"
                    />
                    <label className="flex items-center gap-2 mt-2 mb-2 cursor-pointer">
                      <input type="checkbox" checked={testCoinsSavePwd} onChange={(e) => setTestCoinsSavePwd(e.target.checked)} className="rounded border-white/30" />
                      <span className="text-white/60 text-xs">Save password (stay unlocked 24h)</span>
                    </label>
                    {testCoinsError && (
                      <p className="text-red-400 text-xs mb-2">{testCoinsError}</p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => setShowTestCoinsModal(false)}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!testCoinsPwd}
                        className="flex-1 py-2.5 rounded-xl bg-[#C9A96E] text-black text-sm font-bold disabled:opacity-40"
                      >
                        Unlock
                      </button>
                    </div>
                  </form>
                )}

                {testCoinsStep === 'amount' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const amount = parseInt(testCoinsAmount, 10);
                      if (!amount || amount <= 0) {
                        setTestCoinsError('Enter a valid amount');
                        return;
                      }
                      if (amount > 100000000) {
                        setTestCoinsError('Max 100,000,000 per top-up');
                        return;
                      }
                      const newBal = coinBalance + amount;
                      setCoinBalance(newBal);
                      persistTestCoinsBalance(user?.id, newBal);
                      showToast(`+${amount.toLocaleString()} test added`);
                      setShowTestCoinsModal(false);
                      if (user?.id) {
                        supabase.rpc('add_test_coins', { p_amount: amount }).then(() => {}).catch(() => {
                          supabase.from('profiles').select('coins').eq('user_id', user.id).single().then(({ data }) => {
                            supabase.from('profiles').update({ coins: (data?.coins ?? 0) + amount }).eq('user_id', user.id).then(() => {});
                          });
                        });
                      }
                    }}
                  >
                    <p className="text-white/40 text-xs mb-3">These coins are for testing only and have no real value.</p>
                    <div className="flex items-center gap-2 mb-2">
                      <Coins className="w-4 h-4 text-[#C9A96E]" />
                      <span className="text-white/60 text-xs">Current: {coinBalance.toLocaleString()}</span>
                    </div>
                    <input
                      type="number"
                      autoFocus
                      value={testCoinsAmount}
                      onChange={(e) => { setTestCoinsAmount(e.target.value); setTestCoinsError(''); }}
                      placeholder="Amount (e.g. 5000)"
                      min={1}
                      max={100000000}
                      className="w-full bg-[#13151A] text-white text-sm rounded-xl px-4 py-3 border border-white/10 focus:border-[#C9A96E]/60 focus:outline-none placeholder:text-white/30 mb-2"
                    />
                    {testCoinsError && (
                      <p className="text-red-400 text-xs mb-2">{testCoinsError}</p>
                    )}
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      {[1000, 5000, 10000, 25000, 50000, 100000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setTestCoinsAmount(String(amt))}
                          className="py-1.5 rounded-lg text-xs font-bold transition-colors bg-white/5 text-white/70 hover:bg-[#C9A96E]/20"
                        >
                          {amt >= 1000 ? `${amt / 1000}K` : amt}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const amount = 100000000;
                          const newBal = coinBalance + amount;
                          setCoinBalance(newBal);
                          persistTestCoinsBalance(user?.id, newBal);
                          showToast(`+${amount.toLocaleString()} test added`);
                          setShowTestCoinsModal(false);
                          if (user?.id) {
                            supabase.rpc('add_test_coins', { p_amount: amount }).then(() => {}).catch(() => {
                              supabase.from('profiles').select('coins').eq('user_id', user.id).single().then(({ data }) => {
                                supabase.from('profiles').update({ coins: (data?.coins ?? 0) + amount }).eq('user_id', user.id).then(() => {});
                              });
                            });
                          }
                        }}
                        className="py-1.5 rounded-lg text-xs font-bold transition-colors bg-[#C9A96E]/30 text-[#C9A96E] hover:bg-[#C9A96E]/40 col-span-3"
                      >
                        Max (100M) – Charge at once
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTestCoinsModal(false)}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!testCoinsAmount}
                        className="flex-1 py-2.5 rounded-xl bg-[#C9A96E] text-black text-sm font-bold disabled:opacity-40"
                      >
                        Add Coins
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </>
        )}

        {/* Weekly Ranking Panel */}
        {showRankingPanel && (
          <>
            <div
              className="fixed inset-0 bg-black/40 pointer-events-auto"
              style={{ zIndex: 99998 }}
              onClick={() => setShowRankingPanel(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 h-[40vh] z-[99999] pointer-events-auto max-w-[480px] mx-auto">
              <RankingPanel onClose={() => setShowRankingPanel(false)} />
            </div>
          </>
        )}

        {/* REPORT MODAL */}
        {isReportModalOpen && (
          <ReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            videoId={hostUserId}
            contentType="live"
          />
        )}

        {/* CO-HOST PANEL — same compact size as creator invite panel (40vh), not full screen */}
        {showCoHostPanel && (
          <div className="fixed inset-0 z-[99999] flex flex-col justify-end max-w-[480px] mx-auto pointer-events-none">
            <div
              className="absolute inset-0 bg-black/40 pointer-events-auto"
              onClick={() => {
                setShowCoHostPanel(false);
                if (pendingCoHostInvite) {
                  supabase.from('notifications').update({ is_read: true }).eq('id', pendingCoHostInvite.notifId).then(() => {});
                  setPendingCoHostInvite(null);
                }
              }}
            />
            <div
              className="bg-[#1C1E24]/95 backdrop-blur-md rounded-t-2xl h-[40vh] max-h-[40vh] flex flex-col shadow-2xl border-t border-[#C9A96E]/20 pointer-events-auto w-full relative z-10 overflow-hidden pb-safe"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <Crown size={14} className="text-[#C9A96E]" strokeWidth={1.8} />
                  <span className="text-white font-bold text-[13px]">Co-Host</span>
                </div>
                <button type="button" title="Close" onClick={() => setShowCoHostPanel(false)} className="p-1 rounded-full active:bg-white/10">
                  <X size={18} className="text-white/70" />
                </button>
              </div>
              <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0 flex flex-col gap-4">
                {/* Pending invite — shown when invite exists (no overlay on main screen) */}
                {pendingCoHostInvite && (
                  <div className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg bg-white/[0.03] flex-shrink-0">
                    <div className="w-10 h-10 rounded-full border-2 border-[#C9A96E]/50 overflow-hidden bg-[#13151A] flex-shrink-0">
                      {pendingCoHostInvite.hostAvatar ? (
                        <img src={pendingCoHostInvite.hostAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#C9A96E] font-bold">
                          {pendingCoHostInvite.hostName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-white text-xs font-semibold truncate">@{pendingCoHostInvite.hostName}</p>
                      <p className="text-white/40 text-[10px]">wants you to co-host</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div
                        className="px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30 flex items-center gap-0.5 active:scale-95 transition-transform cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          supabase.from('notifications').update({ is_read: true }).eq('id', pendingCoHostInvite.notifId).then(() => {});
                          setPendingCoHostInvite(null);
                        }}
                      >
                        <span className="text-red-400 text-[9px] font-bold">Reject</span>
                      </div>
                      <div
                        className="px-2.5 py-1 rounded-full bg-green-500 flex items-center gap-0.5 active:scale-95 transition-transform cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const invite = pendingCoHostInvite;
                          setPendingCoHostInvite(null);
                          setShowCoHostPanel(false);
                          supabase.from('notifications').update({ is_read: true }).eq('id', invite.notifId).then(() => {});
                          const myUsername = user?.username || (user as any)?.name || 'User';
                          supabase.from('notifications').insert({
                            user_id: invite.hostUserId,
                            type: 'cohost_accepted',
                            title: 'Co-Host Accepted',
                            body: `@${myUsername} accepted your co-host invite!`,
                            data: { actor_id: user?.id, accepted_name: myUsername, accepted_avatar: (user as any)?.avatar || '', stream_key: invite.streamKey },
                          }).then(() => {});
                          if (invite.streamKey === effectiveStreamId) {
                            startCoHosting();
                          } else {
                            showToast(`Joining @${invite.hostName}'s stream...`);
                            navigate(`/watch/${invite.streamKey}?cohost=1`);
                          }
                        }}
                      >
                        <span className="text-black text-[9px] font-bold">Join</span>
                      </div>
                    </div>
                  </div>
                )}
                {/* Request form — always visible in panel, everything in one place */}
                <div className="flex flex-col items-center gap-3 flex-1 min-h-0">
                  <div className="w-16 h-16 rounded-full bg-[#C9A96E]/10 border border-[#C9A96E]/30 flex items-center justify-center">
                    <Crown size={28} className="text-[#C9A96E]" />
                  </div>
                  <p className="text-white/70 text-sm text-center">
                    {joinRequested
                      ? 'Your request has been sent to the creator. Wait for them to accept.'
                      : 'Request the creator to let you co-host their live stream.'}
                  </p>
                  <button
                    type="button"
                    disabled={joinRequested || !user?.id}
                    onClick={async () => {
                      if (!user?.id || !hostUserId || joinRequested) return;
                      setJoinRequested(true);
                      try {
                        await supabase.from('notifications').insert({
                          user_id: hostUserId,
                          type: 'join_request',
                          title: 'Co-Host Request',
                          body: `@${viewerName} wants to co-host`,
                          data: {
                            actor_id: user.id,
                            requester_name: viewerName,
                            requester_avatar: viewerAvatar,
                            request_type: 'cohost',
                            stream_key: effectiveStreamId,
                          },
                        });
                        showToast('Co-host request sent!');
                      } catch {
                        setJoinRequested(false);
                        showToast('Failed to send request');
                      }
                    }}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                      joinRequested
                        ? 'bg-white/10 text-white/40 cursor-not-allowed'
                        : 'bg-[#C9A96E] text-black'
                    }`}
                  >
                    {joinRequested ? 'Request Sent ✓' : 'Request to Co-Host'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
