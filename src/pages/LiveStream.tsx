import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { showToast } from '../lib/toast';
import { platform } from '../lib/platform';
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
  Sword,
  Coins,
  Lock,
  Flag,
  Eye,
  Camera,
  CameraOff,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { GIFTS, resolveGiftAssetUrl } from '../lib/gifts';
import { GiftOverlay } from '../components/GiftOverlay';
import GiftAnimationOverlay from '../components/GiftAnimationOverlay';
import { ChatOverlay } from '../components/ChatOverlay';
import { FaceARGift } from '../components/FaceARGift';
import { useLivePromoStore } from '../store/useLivePromoStore';
import { AvatarRing } from '../components/AvatarRing';
import { useAuthStore } from '../store/useAuthStore';
import { clearCachedCameraStream, getCachedCameraStream } from '../lib/cameraStream';
import { apiUrl, getLiveKitUrl } from '../lib/api';
import { LevelBadge } from '../components/LevelBadge';
import ReportModal from '../components/ReportModal';
import PromotePanel from '../components/PromotePanel';
import { RankingPanel } from '../components/RankingPanel';
import { websocket } from '../lib/websocket';
import LiveAIFilters from '../components/LiveAIFilters';
import { IS_STORE_BUILD } from '../config/build';
import { Room, LocalVideoTrack, LocalAudioTrack } from 'livekit-client';


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






type BattleState = 'LIVE_SOLO' | 'INVITING' | 'IN_BATTLE' | 'ENDED';

export default function LiveStream() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerVideoRef = useRef<HTMLVideoElement>(null);
  const opponentVideoRef = useRef<HTMLVideoElement>(null);
  const player3VideoRef = useRef<HTMLVideoElement>(null);
  const player4VideoRef = useRef<HTMLVideoElement>(null);
  const coHostVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const battlePeerRef = useRef<{ close: () => void } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [viewerHasStream, setViewerHasStream] = useState(false);
  const setPromo = useLivePromoStore((s) => s.setPromo);
  const { user, updateUser } = useAuthStore();
  const _rawStreamId = streamId;
  const PROMOTE_LIKES_THRESHOLD_LIVE = 100;
  const _PROMOTE_LIKES_THRESHOLD_BATTLE = 50;
  
  const [showRankingPanel, setShowRankingPanel] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentGift, setCurrentGift] = useState<{ video: string; preview: string } | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>(() => []);
  const [coinBalance, setCoinBalance] = useState(0);
  const [inputValue, setInputValue] = useState('');
  // Consolidate broadcast logic: host if streamId is broadcast OR if streamId matches my own user ID
  const isBroadcast = streamId === 'broadcast' || location.pathname === '/live/broadcast' || (user?.id && streamId === user.id);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [showModerationWarning, setShowModerationWarning] = useState(false);
  const [showSpectatorChatInput, setShowSpectatorChatInput] = useState(false);
  const spectatorChatInputRef = useRef<HTMLInputElement>(null);
  const [spectatorCoHostRequestSent, setSpectatorCoHostRequestSent] = useState(false);
  const [moderationWarningMessage, setModerationWarningMessage] = useState('');
  const [showTestCoinsModal, setShowTestCoinsModal] = useState(false);
  const [testCoinsStep, setTestCoinsStep] = useState<'password' | 'amount'>('password');
  const TEST_COINS_PWD_KEY = 'elix_test_coins_pwd_saved';
  const TEST_COINS_VERIFIED_KEY = 'elix_test_coins_verified';
  const [testCoinsPwd, setTestCoinsPwd] = useState('');
  const [testCoinsSavePwd, setTestCoinsSavePwd] = useState(!!(typeof localStorage !== 'undefined' && localStorage.getItem(TEST_COINS_PWD_KEY)));
  const [testCoinsError, setTestCoinsError] = useState('');
  const [testCoinsAmount, setTestCoinsAmount] = useState('');
  const testCoinsPwdRef = useRef<HTMLInputElement>(null);
  const TEST_COINS_HASH = '169a9bfc269089e14090ad2e393b17e945d798598c33993bcab5feef93e68508';
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
  const [showViewerList, setShowViewerList] = useState(false);
  const [moderators, setModerators] = useState<Set<string>>(new Set());

  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  // user is already defined above
  const isBroadcaster = isBroadcast;
  const effectiveStreamId = isBroadcaster ? (user?.id || 'broadcast') : (_rawStreamId || 'broadcast');
  const liveRegisteredRef = useRef(false);
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

  // Fetch host info when viewing a stream (non-broadcast mode)
  // Note: Without a database, we derive host info from the stream key
  useEffect(() => {
    if (isBroadcast || !effectiveStreamId) return;
    
    // Derive host name from stream key (simplified without DB)
    const hostLabel = effectiveStreamId.slice(0, 8).toUpperCase();
    setHostName(`Creator ${hostLabel}`);
    setHostAvatar(`https://ui-avatars.com/api/?name=${encodeURIComponent(hostLabel)}&background=121212&color=C9A96E`);
  }, [isBroadcast, effectiveStreamId]);

  // Load user profile (coins, level, XP)
  // Note: Without a database, we use persisted test coins and default values
  useEffect(() => {
    if (!user?.id) return;
    
    const persisted = getPersistedTestCoinsBalance(user.id);
    setCoinBalance(Math.max(0, persisted));
    setUserLevel(user.level || 1);
    setUserXP(0);
  }, [user?.id, user?.level]);

  const [isMyStreamLive, setIsMyStreamLive] = useState(false);
  const creatorNameRef = useRef(creatorName);
  creatorNameRef.current = creatorName;

  // Track stream status locally (without database)
  useEffect(() => {
    if (!user?.id) return;
    const key = effectiveStreamId;
    if (!key) return;

    if (isBroadcast) {
      // Mark stream as live locally
      setIsMyStreamLive(true);
      
      // Broadcast to other viewers via WebSocket (handled by server)
      websocket.send('stream_start', {
        stream_key: key,
        user_id: user.id,
        title: creatorNameRef.current,
      });

      return () => {
        setIsMyStreamLive(false);
        websocket.send('stream_end', {
          stream_key: key,
          user_id: user.id,
        });
      };
    } else {
      // Viewer mode - rely on WebSocket events for stream status
      return () => {};
    }
  }, [effectiveStreamId, isBroadcast, user?.id]);

  useEffect(() => {
    // Title is set at stream start via POST /api/live/start; no DB update needed here
  }, [creatorName, isBroadcast, isMyStreamLive, effectiveStreamId, user?.id]);

  useEffect(() => {
    if (showTestCoinsModal) {
      const verified = localStorage.getItem(TEST_COINS_VERIFIED_KEY);
      const ts = verified ? parseInt(verified, 10) : 0;
      if (ts && Date.now() - ts < 24 * 60 * 60 * 1000) {
        setTestCoinsStep('amount');
      } else {
        setTestCoinsStep('password');
      }
    }
  }, [showTestCoinsModal]);

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

  // LiveKit credentials from /api/live/start (so we can connect and publish)
  const [liveKitCreds, setLiveKitCreds] = useState<{ token: string; url: string } | null>(null);
  const liveKitRoomRef = useRef<Room | null>(null);

  // Register/unregister live stream in backend list; get LiveKit token+url for host
  useEffect(() => {
    if (!isBroadcast || !user?.id || !effectiveStreamId || liveRegisteredRef.current) return;

    (async () => {
      try {
        const res = await fetch(apiUrl('/api/live/start'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: effectiveStreamId,
            // so viewers / ForYou can see the real creator name instead of the raw stream key
            displayName: creatorNameRef.current,
          }),
        });
        if (res.ok) {
          liveRegisteredRef.current = true;
          const data = await res.json().catch(() => ({}));
          let url = (data?.url ?? '').trim();
          if (!url) url = getLiveKitUrl();
          if (data?.token && url) {
            setLiveKitCreds({ token: data.token, url });
          } else {
            showToast('Live server missing token or LIVEKIT_URL. Check server .env and restart.');
          }
        }
      } catch {
        // ignore; stream will just not appear in /api/live/streams
      }
    })();

    return () => {
      setLiveKitCreds(null);
      if (!liveRegisteredRef.current) return;
      (async () => {
        try {
          await fetch(apiUrl('/api/live/end'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room: effectiveStreamId }),
          });
        } catch {
          // ignore
        } finally {
          liveRegisteredRef.current = false;
        }
      })();
    };
  }, [isBroadcast, user?.id, effectiveStreamId]);

  // Live: LiveKit. Host publishes here; viewers subscribe via SpectatorPage.
  useEffect(() => {
    if (!isBroadcast || !liveKitCreds || !cameraStreamRef.current) return;

    const stream = cameraStreamRef.current;
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    if (!videoTrack && !audioTrack) return;

    const room = new Room({ adaptiveStream: true });
    liveKitRoomRef.current = room;

    (async () => {
      try {
        await room.connect(liveKitCreds.url, liveKitCreds.token);
        if (videoTrack) {
          const localVideo = new LocalVideoTrack(videoTrack);
          await room.localParticipant.publishTrack(localVideo, { name: 'camera' });
        }
        if (audioTrack) {
          const localAudio = new LocalAudioTrack(audioTrack);
          await room.localParticipant.publishTrack(localAudio, { name: 'mic' });
        }
        if (import.meta.env.DEV) console.log('[LiveKit] Host connected and published');
      } catch (e) {
        console.error('[LiveKit] Host connect/publish failed:', e);
        showToast('Live video could not start. Check LIVEKIT_URL and keys on server.');
      }
    })();

    return () => {
      liveKitRoomRef.current = null;
      room.disconnect();
    };
  }, [isBroadcast, liveKitCreds, cameraStream]);

  const [isFindCreatorsOpen, setIsFindCreatorsOpen] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [hasJoinedToday, setHasJoinedToday] = useState(false);
  const [myHeartCount, setMyHeartCount] = useState(0);
  const [creatorQuery, setCreatorQuery] = useState('');
  const [creators, setCreators] = useState<{ id: string; name: string; username: string; followers: string; avatar: string; isLive: boolean }[]>([]);
  const [creatorsLoading, setCreatorsLoading] = useState(false);
  const [creatorsLoadFailed, setCreatorsLoadFailed] = useState(false);

  const loadCreators = useCallback(async () => {
    if (!user?.id) return;
    setCreatorsLoading(true);
    setCreatorsLoadFailed(false);
    try {
      const url = apiUrl('/api/live/streams');
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to load live streams (${res.status})`);
      }
      const json = await res.json();
      const streams = Array.isArray(json.streams) ? json.streams : [];
      // Support both snake_case (Express) and camelCase (Fastify) from /api/live/streams
      const liveCreators = streams
        .map((s: any) => {
          const uid = s.user_id ?? s.userId ?? s.hostUserId ?? '';
          const title = s.title ?? s.display_name ?? s.displayName ?? '';
          const label = title ? title.slice(0, 20) : (uid ? uid.slice(0, 8) : 'Creator');
          return { uid, label };
        })
        .filter(({ uid }) => uid && uid !== user.id)
        .map(({ uid, label }) => {
          const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=121212&color=C9A96E`;
          return {
            id: uid,
            name: label,
            username: label,
            followers: '0',
            avatar,
            isLive: true,
          };
        });
      setCreators(liveCreators);
      setCreatorsLoadFailed(false);
    } catch (error) {
      console.error('Failed to load creators', error);
      setCreatorsLoadFailed(true);
      setCreators([]);
    } finally {
      setCreatorsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) loadCreators();
  }, [user?.id, loadCreators]);

  // Refetch creators when opening Invite panel so list is fresh
  useEffect(() => {
    if (isFindCreatorsOpen && user?.id) loadCreators();
  }, [isFindCreatorsOpen, loadCreators]);

  const filteredCreators = creators.filter((c) => {
    if (!c.isLive) return false;
    const q = creatorQuery.trim().toLowerCase();
    if (!q) return true;
    return c.username.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  });
  const creatorsToInvite = React.useMemo(() => filteredCreators, [filteredCreators]);

  // Battle Player Slots (P1 = creator, P2-P4 = invited players)
  type BattleSlot = { userId: string; name: string; status: 'empty' | 'invited' | 'accepted'; avatar: string };
  const [battleSlots, setBattleSlots] = useState<BattleSlot[]>([
    { userId: '', name: '', status: 'empty', avatar: '' },
    { userId: '', name: '', status: 'empty', avatar: '' },
    { userId: '', name: '', status: 'empty', avatar: '' },
  ]);
  const inviteTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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
    websocket.send('battle_invite_send', {
      targetUserId: creatorId,
      hostName: myCreatorName,
      hostAvatar: myAvatar,
    });
  };

  // ─── INCOMING INVITE (for viewers / other broadcasters) ─────
  type PendingInvite = {
    hostName: string;
    hostAvatar: string;
    streamKey: string;
    hostUserId: string;
  };
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);

  const acceptBattleInvite = async () => {
    if (!pendingInvite || !user?.id) return;
    const invite = pendingInvite;
    setPendingInvite(null);
    if (!invite.streamKey) {
      showToast('Invalid invite — missing stream key');
      return;
    }
    try {
      const myUsername = user?.username || user?.name || viewerName;
      websocket.send('battle_invite_accept', {
        hostUserId: invite.hostUserId,
        requesterName: myUsername,
        requesterAvatar: viewerAvatar,
        streamKey: invite.streamKey,
      });
    } catch { /* fire-and-forget */ }

    if (isBroadcast) {
      showToast(`Battle with @${invite.hostName} starting!`);
      setIsBattleMode(true);
      setBattleState('INVITING');
      setOpponentCreatorName(invite.hostName);
      setBattleSlots(prev => {
        const next = [...prev];
        const emptyIdx = next.findIndex(s => s.status === 'empty');
        if (emptyIdx !== -1) {
          next[emptyIdx] = { userId: invite.hostUserId, name: invite.hostName, status: 'accepted', avatar: invite.hostAvatar };
        }
        return next;
      });
      websocket.send('battle_create', {
        hostName: myCreatorName,
        opponentUserId: invite.hostUserId,
        opponentName: invite.hostName,
      });
    } else {
      showToast(`Joining @${invite.hostName}'s battle...`);
      navigate(`/live/${invite.streamKey}?battle=1`);
    }
  };

  const declineBattleInvite = async () => {
    if (!pendingInvite) return;
    setPendingInvite(null);
  };

  // Mute state per player pane
  const [mutedPlayers, setMutedPlayers] = useState<Record<string, boolean>>({});
  const [cameraOffPlayers, setCameraOffPlayers] = useState<Record<string, boolean>>({});
  const togglePlayerMute = (player: string) => {
    setMutedPlayers(prev => ({ ...prev, [player]: !prev[player] }));
  };
  const togglePlayerCamera = (player: string) => {
    setCameraOffPlayers(prev => ({ ...prev, [player]: !prev[player] }));
  };

  useEffect(() => {
    const map: Record<string, React.RefObject<HTMLVideoElement | null>> = {
      opponent: opponentVideoRef,
      player3: player3VideoRef,
      player4: player4VideoRef,
    };
    for (const [key, ref] of Object.entries(map)) {
      if (ref.current) ref.current.muted = !!mutedPlayers[key];
    }
  }, [mutedPlayers]);

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
    userId: string;
    name: string;
    avatar: string;
    status: 'invited' | 'accepted' | 'live' | 'pending_accept';
    isMuted: boolean;
    _notifId?: string;
    _streamKey?: string;
  };
  const [coHosts, setCoHosts] = useState<CoHost[]>([]);
  const [isInviteHostOpen, setIsInviteHostOpen] = useState(false);
  useEffect(() => {
    if (!isMyStreamLive) setIsInviteHostOpen(false);
  }, [isMyStreamLive]);
  const [hostSearchQuery, setHostSearchQuery] = useState('');
  const [featuredHostId, setFeaturedHostId] = useState<string | null>(null);
  const coHostTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const MAX_CO_HOSTS = 12;

  const inviteCoHost = async (creator: { id: string; name: string; avatar?: string }) => {
    if (!isBroadcast || !isMyStreamLive) {
      showToast('You must be live to invite co-hosts');
      return;
    }
    if (coHosts.length >= MAX_CO_HOSTS) return;
    if (coHosts.some(h => h.userId === creator.id)) return;

    const newHost: CoHost = {
      id: `host-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      userId: creator.id,
      name: creator.name,
      avatar: creator.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.name)}&background=121212&color=C9A96E`,
      status: 'invited',
      isMuted: false,
    };
    setCoHosts(prev => [...prev, newHost]);

    if (!user?.id) return;
    websocket.send('cohost_invite_send', {
      targetUserId: creator.id,
      hostName: myCreatorName,
      hostAvatar: myAvatar,
    });
  };

  // ─── JOIN REQUEST: creator receives when someone asked to join (from viewer) ───
  type PendingJoinRequest = { requesterName: string; requesterAvatar: string; requesterId: string; type: 'cohost' | 'battle' };
  const [pendingJoinRequest, setPendingJoinRequest] = useState<PendingJoinRequest | null>(null);

  const acceptJoinRequest = async () => {
    if (!pendingJoinRequest || !user?.id) return;
    const req = pendingJoinRequest;
    setPendingJoinRequest(null);
    const myName = user.username || user.name || 'Creator';
    websocket.send('cohost_request_accept', {
      requesterUserId: req.requesterId,
      hostName: myName,
      hostAvatar: user.avatar || '',
      streamKey: effectiveStreamId,
    });
    setCoHosts(prev => [...prev, {
      id: `host-${Date.now()}`,
      userId: req.requesterId,
      name: req.requesterName,
      avatar: req.requesterAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.requesterName)}&background=121212&color=C9A96E`,
      status: 'invited',
      isMuted: false,
    }]);
    showToast(`Accepted @${req.requesterName}'s co-host request!`);
  };

  const declineJoinRequest = async () => {
    if (!pendingJoinRequest) return;
    setPendingJoinRequest(null);
    showToast('Request declined');
  };

  // Co-host presence: when joining as cohost, announce to host (feature disabled)
  const isCoHostJoiner = new URLSearchParams(location.search).get('cohost') === '1';

  useEffect(() => {
    // Cohost signalling via WebSocket.
    if (!isCoHostJoiner || !user?.id || isBroadcast) return;
    return () => {};
  }, [isCoHostJoiner, user?.id, effectiveStreamId, isBroadcast]);

  // Host side: listen for co-hosts joining via presence
  useEffect(() => {
    // Cohost management via WebSocket.
    if (!isBroadcast || !user?.id) return;
    return () => {};
  }, [isBroadcast, user?.id, effectiveStreamId]);

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
  const [coHostCameraOff, setCoHostCameraOff] = useState<Record<string, boolean>>({});
  const toggleCoHostCamera = (hostId: string) => {
    setCoHostCameraOff(prev => ({ ...prev, [hostId]: !prev[hostId] }));
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
    !coHosts.some(h => h.userId === c.id || h.name === c.name)
  );
  const liveHostCreators = filteredHostCreators.filter(c => c.isLive);
  const offlineHostCreators = filteredHostCreators.filter(c => !c.isLive);

  useEffect(() => {
    return () => {
      coHostTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // Battle Mode State
  const [battleState, setBattleState] = useState<BattleState>('LIVE_SOLO');
  const [isBattleMode, setIsBattleMode] = useState(false);
  const isBattleModeRef = useRef(false);
  const battleEndedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { isBattleModeRef.current = isBattleMode; }, [isBattleMode]);
  const isBattleJoiner = !isBroadcast && new URLSearchParams(location.search).get('battle') === '1';

  // If joining as battle participant, enter battle mode and start camera (server drives timer/countdown)
  useEffect(() => {
    if (!isBattleJoiner || !user?.id) return;
    setIsBattleMode(true);
    setBattleState('INVITING');
    setMyScore(0);
    setOpponentScore(0);

    let cancelled = false;
    (async () => {
      // Derive host info from stream key (simplified without DB)
      const hostLabel = effectiveStreamId.slice(0, 8).toUpperCase();
      const hName = `Host ${hostLabel}`;
      const hAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(hostLabel)}&background=121212&color=C9A96E`;
      
      if (cancelled) return;
      setBattleSlots(prev => {
        const next = [...prev];
        next[0] = { userId: effectiveStreamId, name: hName, status: 'accepted', avatar: hAvatar };
        return next;
      });

      // Start camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        cameraStreamRef.current = stream;
        setCameraStream(stream);
        setBattleParticipantStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        showToast('Camera access denied');
      }

      // Announce arrival to host — the shared battle_room channel effect handles
      // battle state signaling. We just need to send joiner_arrived once the
      // channel is ready.
      const myName = user?.username || user?.name || 'Player';
      const myAv = user?.avatar || '';

      // Battle arrival via WebSocket.
    })();
    return () => {
      cancelled = true;
      if (battlePeerRef.current) { battlePeerRef.current.close(); battlePeerRef.current = null; }
    };
  }, [isBattleJoiner, user?.id, effectiveStreamId]);

  // Battle state driven by WebSocket backend.
  useEffect(() => {
    if (!effectiveStreamId || (!isBroadcast && !isBattleJoiner)) return;
    return () => {
      if (battlePeerRef.current) { battlePeerRef.current.close(); battlePeerRef.current = null; }
    };
  }, [effectiveStreamId, isBroadcast, isBattleJoiner]);
  const [liveFilterCss, setLiveFilterCss] = useState('none');
  const [battleTime, setBattleTime] = useState(300); // 5 minutes
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [player3Score, setPlayer3Score] = useState(0);
  const [player4Score, setPlayer4Score] = useState(0);
  const [battleWinner, setBattleWinner] = useState<'me' | 'opponent' | 'player3' | 'player4' | 'draw' | null>(null);
  const battleScoresRef = useRef({ myScore: 0, opponentScore: 0, player3Score: 0, player4Score: 0 });
  useEffect(() => {
    battleScoresRef.current = { myScore, opponentScore, player3Score, player4Score };
  }, [myScore, opponentScore, player3Score, player4Score]);
  const localBattleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const [hasOpponentStream, setHasOpponentStream] = useState(false);
  const [iAmReady, setIAmReady] = useState(false);
  const [hostIsReady, setHostIsReady] = useState(false);
  const [opponentIsReady, setOpponentIsReady] = useState(false);

  // Peer connections for battle & co-host
  const isBattleParticipant = !isBroadcast && new URLSearchParams(location.search).get('battle') === '1';
  const [battleParticipantStream, setBattleParticipantStream] = useState<MediaStream | null>(null);
  const [coHostJoinerStream, setCoHostJoinerStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!isCoHostJoiner || isBroadcast || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        setCoHostJoinerStream(stream);
      } catch {
        showToast('Camera access needed to co-host');
      }
    })();
    return () => {
      cancelled = true;
      setCoHostJoinerStream(prev => { if (prev) prev.getTracks().forEach(t => t.stop()); return null; });
    };
  }, [isCoHostJoiner, isBroadcast, user?.id]);

  useEffect(() => {
    if (!isBattleParticipant || battleParticipantStream) return;
    if (cameraStreamRef.current) {
      setBattleParticipantStream(cameraStreamRef.current);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        cameraStreamRef.current = stream;
        setCameraStream(stream);
        setBattleParticipantStream(stream);
      } catch {
        showToast('Camera access denied — cannot join battle');
      }
    })();
    return () => { cancelled = true; };
  }, [isBattleParticipant, battleParticipantStream]);

  useEffect(() => {
    if (!isBattleParticipant || !battleParticipantStream || !videoRef.current) return;
    videoRef.current.srcObject = battleParticipantStream;
    videoRef.current.play().catch(() => {});
  }, [isBattleParticipant, battleParticipantStream]);

  const isRegularViewer = !isBroadcast && !isBattleParticipant && !isCoHostJoiner;

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

  const speedChallengeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSpeedChallengeRef = useRef<number>(0);
  const reachedThresholdsRef = useRef<Set<number>>(new Set());
  const [_battleGifterCoins, setBattleGifterCoins] = useState<Record<string, number>>({});
  // Track top gifters per player: { 'me': { 'username': coins }, 'opponent': {...}, ... }
  const [playerGifters, setPlayerGifters] = useState<Record<string, Record<string, number>>>({});
  const [gifterAvatars, setGifterAvatars] = useState<Record<string, string>>({});
  const [lastGifts, setLastGifts] = useState<{ opponent: string | null; player3: string | null; player4: string | null }>({ opponent: null, player3: null, player4: null });
  const [floatingHearts, setFloatingHearts] = useState<
    Array<{ id: string; x: number; y: number; dx: number; rot: number; size: number; color: string; username?: string; avatar?: string }>
  >([]);
  const [miniProfile, setMiniProfile] = useState<null | { id?: string; username: string; avatar: string; level: number | null; coins?: number; donated?: number; bio?: string; followers_count?: number; following_count?: number }>(null);
  const [showMembershipBar, setShowMembershipBar] = useState(false);
  const [showTeamStatus, setShowTeamStatus] = useState(false);
  const [showJoinAnimation, setShowJoinAnimation] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [membershipHeartActive, setMembershipHeartActive] = useState(false);
  const membershipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FAN CLUB PANEL - removed top bar, now using Sheet
  const [showFanClub, setShowFanClub] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const authToken = useAuthStore.getState().session?.access_token;
      if (!user?.id || !authToken) {
        navigate('/login');
        return;
      }
      const res = await fetch(apiUrl('/api/create-subscription'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
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
  const [showPromotePanel, setShowPromotePanel] = useState(false);
  const [shareQuery, setShareQuery] = useState('');
  const [shareFollowers, setShareFollowers] = useState<{ user_id: string; username: string; avatar_url: string | null }[]>([]);
  const [shareSentTo, setShareSentTo] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (showSharePanel && user?.id) {
      setShareFollowers([]);
    } else {
      setShareSentTo(new Set());
    }
  }, [showSharePanel, user?.id]);

  const sendShareToFollower = async (targetUserId: string) => {
    if (!user?.id || shareSentTo.has(targetUserId)) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Link copied to clipboard');
      setShareSentTo(prev => new Set(prev).add(targetUserId));
    } catch {}
  };

  // 2v2: Red Team (P1+P3) vs Blue Team (P2+P4)
  const determine4PlayerWinner = useCallback(() => {
    const red = myScore + player3Score;
    const blue = opponentScore + player4Score;
    if (red === blue) return 'draw';
    // 'me' = red team wins, 'opponent' = blue team wins
    return red > blue ? 'me' : 'opponent';
  }, [myScore, opponentScore, player3Score, player4Score]);

  // Timer, scoring, and winner are all server-driven via battle_tick, battle_score, battle_ended

  const endBattleCleanup = useCallback(() => {
    setIsBattleMode(false);
    setBattleState('LIVE_SOLO');
    setBattleTime(300);
    setMyScore(0);
    setOpponentScore(0);
    setPlayer3Score(0);
    setPlayer4Score(0);
    setBattleWinner(null);
    setBattleCountdown(null);
    setHasOpponentStream(false);
    setIAmReady(false);
    setHostIsReady(false);
    setOpponentIsReady(false);
    setOpponentCreatorName('');
    setGiftTarget('me');
    setBattleGifterCoins({});
    setPlayerGifters({});
    setMutedPlayers({});
    reachedThresholdsRef.current.clear();
    battleFreeTapUsedRef.current = false;
    spectatorTapPointsRef.current = 0;
    setSpectatorTapsUsed(0);
    battleScoreTapWindowRef.current = { windowStart: 0, count: 0 };
    battleTripleTapRef.current = { target: null, lastTapAt: 0, count: 0 };
    setMiniProfile(null);
    setSpeedChallengeActive(false);
    setSpeedChallengeCountdown(null);
    setSpeedChallengeTime(10);
    setSpeedChallengeTaps({ me: 0, opponent: 0, player3: 0, player4: 0 });
    setSpeedChallengeResult(null);
    setSpeedMultiplier(1);
    if (localBattleTimerRef.current) {
      clearInterval(localBattleTimerRef.current);
      localBattleTimerRef.current = null;
    }
    setBattleSlots([
      { userId: '', name: '', status: 'empty', avatar: '' },
      { userId: '', name: '', status: 'empty', avatar: '' },
      { userId: '', name: '', status: 'empty', avatar: '' },
    ]);
    inviteTimersRef.current.forEach(t => clearTimeout(t));
    inviteTimersRef.current = [];
    setIsFindCreatorsOpen(false);
    setCreatorQuery('');
    if (opponentVideoRef.current) { opponentVideoRef.current.srcObject = null; }
    if (player3VideoRef.current) { player3VideoRef.current.srcObject = null; }
    if (player4VideoRef.current) { player4VideoRef.current.srcObject = null; }
    if (battlePeerRef.current) { battlePeerRef.current.close(); battlePeerRef.current = null; }
    // Battle state notified via WebSocket.
  }, [effectiveStreamId]);

  const toggleBattle = useCallback(() => {
    if (isBattleMode) {
      endBattleCleanup();
      // Tell server to end battle
      websocket.send('battle_end', {});
      const params = new URLSearchParams(location.search);
      if (params.has('battle')) {
        params.delete('battle');
        navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
      }
      return;
    }
    // Enter battle mode -> INVITING state, everything clean
    setBattleState('INVITING');
    setIsBattleMode(true);
    setBattleTime(0);
    setMyScore(0);
    setOpponentScore(0);
    setPlayer3Score(0);
    setPlayer4Score(0);
    setBattleWinner(null);
    setGiftTarget('me');
    setBattleGifterCoins({});
    setPlayerGifters({});
    setBattleCountdown(null);
    setHasOpponentStream(false);
    setIAmReady(false);
    setHostIsReady(false);
    setOpponentIsReady(false);
    setOpponentCreatorName('');
    setMutedPlayers({});
    battleFreeTapUsedRef.current = false;
    spectatorTapPointsRef.current = 0;
    setSpectatorTapsUsed(0);
    battleScoreTapWindowRef.current = { windowStart: 0, count: 0 };
    battleTripleTapRef.current = { target: null, lastTapAt: 0, count: 0 };
    setBattleSlots([
      { userId: '', name: '', status: 'empty', avatar: '' },
      { userId: '', name: '', status: 'empty', avatar: '' },
      { userId: '', name: '', status: 'empty', avatar: '' },
    ]);
    if (opponentVideoRef.current) { opponentVideoRef.current.srcObject = null; }
    if (player3VideoRef.current) { player3VideoRef.current.srcObject = null; }
    if (player4VideoRef.current) { player4VideoRef.current.srcObject = null; }
    setIsFindCreatorsOpen(true);
    websocket.send('battle_create', { hostName: creatorName });
  }, [isBattleMode, location.search, location.pathname, navigate, endBattleCleanup, creatorName]);

  // No auto-start - user must press Match to begin

  useEffect(() => {
    if (battleCountdown === null || battleCountdown > 0) return;
    setBattleState('IN_BATTLE');
    setBattleCountdown(null);
    setBattleTime(300);
    // Timer is handled by server 'battle_tick'
    // Winner is handled by server 'battle_end'
    return () => {
      if (localBattleTimerRef.current) {
        clearInterval(localBattleTimerRef.current);
        localBattleTimerRef.current = null;
      }
    };
  }, [battleCountdown]);

  useEffect(() => {
    if (battleCountdown == null || battleCountdown <= 0) return;
    const id = setTimeout(() => setBattleCountdown((c) => (c != null && c > 0 ? c - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [battleCountdown]);

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

  const addBattleGifterCoins = (username: string, coins: number, target?: string, avatar?: string) => {
    if (!isBattleMode) return;
    if (!username || coins <= 0) return;
    setBattleGifterCoins((prev) => ({ ...prev, [username]: (prev[username] ?? 0) + coins }));
    if (avatar) setGifterAvatars(prev => ({ ...prev, [username]: avatar }));
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
        avatar: gifterAvatars[name] || activeViewers.find(v => v.username === name || v.displayName === name)?.avatar || '',
      }));
  };

  // Get overall top 3 gifters (merged across all battle players)
  const getTop3GiftersOverall = () => {
    const merged: Record<string, number> = {};
    (['me', 'opponent', 'player3', 'player4'] as const).forEach((p) => {
      const gifters = playerGifters[p] || {};
      Object.entries(gifters).forEach(([name, coins]) => {
        merged[name] = (merged[name] || 0) + coins;
      });
    });
    return Object.entries(merged)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, coins]) => ({
        name,
        coins,
        avatar: gifterAvatars[name] || activeViewers.find(v => v.username === name || v.displayName === name)?.avatar || '',
      }));
  };

  const formatCoinsShort = (coins: number) => {
    const n = typeof coins === 'number' && Number.isFinite(coins) ? coins : 0;
    if (n >= 1_000_000) {
      const m = Math.round((n / 1_000_000) * 10) / 10;
      const label = Number.isInteger(m) ? String(Math.trunc(m)) : String(m);
      return `${label}M`;
    }
    if (n >= 1000) {
      const k = Math.round((n / 1000) * 10) / 10;
      const label = Number.isInteger(k) ? String(Math.trunc(k)) : String(k);
      return `${label}K`;
    }
    return n.toLocaleString();
  };

  const formatCountShort = (count: number) => {
    const c = typeof count === 'number' && Number.isFinite(count) ? count : 0;
    if (c >= 1_000_000) {
      const m = Math.round((c / 1_000_000) * 10) / 10;
      const label = Number.isInteger(m) ? String(Math.trunc(m)) : String(m);
      return `${label}M`;
    }
    if (c >= 1000) {
      const k = Math.round((c / 1000) * 10) / 10;
      const label = Number.isInteger(k) ? String(Math.trunc(k)) : String(k);
      return `${label}K`;
    }
    return String(c);
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
      setCameraStream(null);
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
          setCameraStream(cached);
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
        setCameraStream(stream);
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
  }, [isBroadcast, cameraFacing]);

  // Re-attach camera stream to videoRef when battle mode toggles (the <video> element changes)
  useEffect(() => {
    if (!isBroadcast && !isBattleJoiner) return;
    const stream = cameraStreamRef.current;
    if (!stream || !videoRef.current) return;
    if (videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [isBattleMode, isBroadcast, isBattleJoiner]);

  useEffect(() => {
    if (!isBroadcast) return;
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      const stream = cameraStreamRef.current;
      const track = stream?.getVideoTracks()[0];
      if (!track || track.readyState === 'ended') {
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: cameraFacing },
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          cameraStreamRef.current = newStream;
          setCameraStream(newStream);
          newStream.getAudioTracks().forEach(t => (t.enabled = !isMicMuted));
          if (videoRef.current) {
            videoRef.current.srcObject = newStream;
            videoRef.current.play().catch(() => {});
          }
        } catch { /* camera unavailable */ }
      } else if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
      websocket.reconnectOnForeground();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isBroadcast, cameraFacing, isMicMuted]);

  useEffect(() => {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !isMicMuted));
  }, [isMicMuted]);

  const [activeViewers, setActiveViewers] = useState<LiveViewer[]>([]);
  useEffect(() => { activeViewersRef.current = activeViewers; }, [activeViewers]);
  useEffect(() => { speedChallengeTapsRef.current = speedChallengeTaps; }, [speedChallengeTaps]);

  // WebSocket: connect to room and track viewers
  useEffect(() => {
    if (!effectiveStreamId || !user?.id) return;

    const getToken = async () => {
      return useAuthStore.getState().session?.access_token ?? '';
    };

    let mounted = true;

    const connect = async () => {
      const token = await getToken();
      if (!token || !mounted) return;
      websocket.connect(effectiveStreamId, token);
    };

    const handleRoomState = (data: any) => {
      if (!mounted) return;
      const seen = new Set<string>();
      const viewers: LiveViewer[] = [];
      for (const v of (data.viewers || [])) {
        const uid = typeof v.user_id === 'string' ? v.user_id : String(v.user_id ?? '');
        if (!uid || uid === user?.id || seen.has(uid)) continue;
        seen.add(uid);
        viewers.push({
          id: uid,
          username: typeof v.username === 'string' ? v.username : 'User',
          displayName: typeof v.display_name === 'string' ? v.display_name : (typeof v.username === 'string' ? v.username : 'User'),
          level: typeof v.level === 'number' && Number.isFinite(v.level) ? v.level : 1,
          avatar: typeof v.avatar_url === 'string' ? v.avatar_url : '',
          country: v.country || '',
          joinedAt: Date.now(),
          isActive: true,
          chatFrequency: 0,
          supportDays: 0,
          lastVisitDaysAgo: 0,
        });
      }
      setActiveViewers(viewers);

      // Opponent: once connected to the room, tell the server we're joining the battle
      if (isBattleJoiner) {
        websocket.send('battle_join', { opponentName: user?.username || user?.name || 'Player' });
      }
    };

    const handleUserJoined = (data: any) => {
      if (!mounted) return;
      if (data.user_id === user?.id) return;
      const joinName = data.username || 'User';
      setActiveViewers(prev => {
        if (prev.some(v => v.id === data.user_id)) return prev;
        return [...prev, {
          id: data.user_id,
          username: joinName,
          displayName: typeof data.display_name === 'string' ? data.display_name : joinName,
          level: typeof data.level === 'number' && Number.isFinite(data.level) ? data.level : 1,
          avatar: typeof data.avatar_url === 'string' ? data.avatar_url : '',
          country: data.country || '',
          joinedAt: Date.now(),
          isActive: true,
          chatFrequency: 0,
          supportDays: 0,
          lastVisitDaysAgo: 0,
        }];
      });
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
      setActiveViewers(prev => prev.filter(v => v.id !== data.user_id));
      setViewerCount(prev => Math.max(0, prev - 1));
      if (data.user_id) {
        setCoHosts(prev => prev.filter(h => h.userId !== data.user_id));
        setBattleSlots(prev => prev.map(s =>
          s.userId === data.user_id ? { userId: '', name: '', status: 'empty' as const, avatar: '' } : s
        ));
      }
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
        addBattleGifterCoins(typeof data.username === 'string' ? data.username : 'User', giftDef.coins, data.battleTarget, typeof data.avatar === 'string' ? data.avatar : '');

        const rawVideo = data.video || giftDef.video;
        if (rawVideo && typeof rawVideo === 'string' && rawVideo.trim()) {
          const videoUrl = (rawVideo.startsWith('http://') || rawVideo.startsWith('https://'))
            ? rawVideo
            : resolveGiftAssetUrl(rawVideo.startsWith('/') ? rawVideo : `/${rawVideo}`);
          const previewUrl = giftDef.preview
            ? ((giftDef.preview.startsWith('http://') || giftDef.preview.startsWith('https://'))
                ? giftDef.preview
                : resolveGiftAssetUrl(giftDef.preview.startsWith('/') ? giftDef.preview : `/${giftDef.preview}`))
            : videoUrl;
          setGiftQueue(prev => [...prev, { video: videoUrl, preview: previewUrl }]);
        }
      }
    };

    // Server-controlled battle events — single source of truth
    const handleBattleStateSync = (data: any) => {
      if (!mounted) return;
      if (data.status === 'WAITING') {
        setIsBattleMode(true);
        setBattleState('INVITING');
      } else if (data.status === 'COUNTDOWN') {
        setIsBattleMode(true);
        setBattleState('INVITING');
        setBattleCountdown(null);
      } else if (data.status === 'ACTIVE') {
        setIsBattleMode(true);
        setBattleState('IN_BATTLE');
        setBattleCountdown(null);
      } else if (data.status === 'ENDED') {
        setBattleState('ENDED');
      }
      setMyScore(data.hostScore || 0);
      setOpponentScore(data.opponentScore || 0);
      setPlayer3Score(data.player3Score || 0);
      setPlayer4Score(data.player4Score || 0);
      setBattleTime(data.timeLeft ?? 300);
      if (data.hostReady != null) setHostIsReady(!!data.hostReady);
      if (data.opponentReady != null) setOpponentIsReady(!!data.opponentReady);
      
      setBattleSlots(prev => {
        const next = [...prev];
        const seenIds = new Set<string>();

        // Opponent
        if (data.opponentName) {
          next[0] = { userId: data.opponentUserId || '', name: data.opponentName, status: 'accepted', avatar: '' };
          if (data.opponentUserId) seenIds.add(data.opponentUserId);
        } else {
          // Keep existing if not provided? Or clear? 
          // battle_state_sync sends FULL state. If opponentName is missing, it's empty.
          // But data.opponentName check is safe?
          // The sync payload has empty strings for empty slots.
          if (!data.opponentUserId) next[0] = { userId: '', name: '', status: 'empty', avatar: '' };
        }

        // Player 3
        if (data.player3Name && data.player3UserId && !seenIds.has(data.player3UserId)) {
          next[1] = { userId: data.player3UserId || '', name: data.player3Name, status: 'accepted', avatar: '' };
          seenIds.add(data.player3UserId);
        } else {
          next[1] = { userId: '', name: '', status: 'empty', avatar: '' };
        }

        // Player 4
        if (data.player4Name && data.player4UserId && !seenIds.has(data.player4UserId)) {
          next[2] = { userId: data.player4UserId || '', name: data.player4Name, status: 'accepted', avatar: '' };
        } else {
          next[2] = { userId: '', name: '', status: 'empty', avatar: '' };
        }
        return next;
      });
    };

    const handleBattleTick = (data: any) => {
      if (!mounted) return;
      setBattleTime(data.timeLeft ?? 0);
      setMyScore(data.hostScore ?? 0);
      setOpponentScore(data.opponentScore ?? 0);
      setPlayer3Score(data.player3Score ?? 0);
      setPlayer4Score(data.player4Score ?? 0);
    };

    const handleBattleScore = (data: any) => {
      if (!mounted) return;
      setMyScore(data.hostScore ?? 0);
      setOpponentScore(data.opponentScore ?? 0);
      setPlayer3Score(data.player3Score ?? 0);
      setPlayer4Score(data.player4Score ?? 0);
    };

    const handleBattleCountdown = (data: any) => {
      if (!mounted) return;
      setBattleCountdown(data.count ?? null);
      if (data.count <= 0) setBattleCountdown(null);
    };

    const handleBattleReadyState = (data: any) => {
      if (!mounted) return;
      setHostIsReady(!!data.hostReady);
      setOpponentIsReady(!!data.opponentReady);
    };

    const handleBattleEnded = (data: any) => {
      if (!mounted) return;
      if (battleEndedTimeoutRef.current) {
        clearTimeout(battleEndedTimeoutRef.current);
        battleEndedTimeoutRef.current = null;
      }
      setBattleState('ENDED');
      setMyScore(data.hostScore ?? 0);
      setOpponentScore(data.opponentScore ?? 0);
      setPlayer3Score(data.player3Score ?? 0);
      setPlayer4Score(data.player4Score ?? 0);
      if (data.winner === 'host') setBattleWinner('me');
      else if (data.winner === 'opponent') setBattleWinner('opponent');
      else if (data.winner === 'player3') setBattleWinner('player3' as any); // cast for type safety
      else if (data.winner === 'player4') setBattleWinner('player4' as any);
      else setBattleWinner('draw' as any);
      battleEndedTimeoutRef.current = setTimeout(() => {
        battleEndedTimeoutRef.current = null;
        if (mounted) endBattleCleanup();
      }, 2000);
    };

    websocket.on('room_state', handleRoomState);
    websocket.on('user_joined', handleUserJoined);
    websocket.on('user_left', handleUserLeft);
    websocket.on('chat_message', handleChatMessage);
    websocket.on('gift_sent', handleGiftSent);
    websocket.on('battle_state_sync', handleBattleStateSync);
    websocket.on('battle_tick', handleBattleTick);
    websocket.on('battle_score', handleBattleScore);
    websocket.on('battle_countdown', handleBattleCountdown);
    websocket.on('battle_ended', handleBattleEnded);
    websocket.on('battle_ready_state', handleBattleReadyState);

    // Battle & Co-Host invite / request signalling over WebSocket
    const handleBattleInvite = (data: any) => {
      if (!user?.id) return;
      setPendingInvite({
        hostName: data.hostName || 'Creator',
        hostAvatar: data.hostAvatar || '',
        streamKey: data.streamKey || effectiveStreamId,
        hostUserId: data.hostUserId,
      });
    };

    const handleBattleInviteAccepted = (data: any) => {
      if (!isBroadcast) return;
      const requesterId = data.requesterUserId as string | undefined;
      const requesterName = data.requesterName as string | undefined;
      const requesterAvatar = data.requesterAvatar as string | undefined;
      if (!requesterId || !requesterName) return;
      setIsBattleMode(true);
      setBattleState('INVITING');
      setOpponentCreatorName(requesterName);
      setBattleSlots(prev => {
        const next = [...prev];
        const emptyIdx = next.findIndex(s => s.status === 'empty');
        if (emptyIdx !== -1) {
          next[emptyIdx] = { userId: requesterId, name: requesterName, status: 'accepted', avatar: requesterAvatar || '' };
        }
        return next;
      });
      websocket.send('battle_create', {
        hostName: myCreatorName,
        opponentUserId: requesterId,
        opponentName: requesterName,
      });
    };

    const handleCohostRequest = (data: any) => {
      if (!isBroadcast) return;
      setPendingJoinRequest({
        requesterId: data.requesterUserId,
        requesterName: data.requesterName,
        requesterAvatar: data.requesterAvatar || '',
        type: 'cohost',
      });
    };

    const handleCohostRequestAccepted = (data: any) => {
      if (!user?.id) return;
      const hostName = data.hostName || 'Creator';
      const hostAvatar = data.hostAvatar || '';
      showToast(`@${hostName} accepted your co-host request!`);
      setCoHosts(prev => [...prev, {
        id: `host-${Date.now()}`,
        userId: data.hostUserId || '',
        name: hostName,
        avatar: hostAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(hostName)}&background=121212&color=C9A96E`,
        status: 'invited',
        isMuted: false,
      }]);
    };

    websocket.on('battle_invite', handleBattleInvite);
    websocket.on('battle_invite_accepted', handleBattleInviteAccepted);
    websocket.on('cohost_request', handleCohostRequest);
    websocket.on('cohost_request_accepted', handleCohostRequestAccepted);

    const handleModerationWarning = (data: { message?: string }) => {
      if (!mounted) return;
      setModerationWarningMessage(data?.message || 'Your stream may violate our safety guidelines. Please avoid dangerous or illegal activity.');
      setShowModerationWarning(true);
    };
    const handleModerationPause = (data: { message?: string }) => {
      if (!mounted) return;
      showToast(data?.message || 'Stream paused for safety. Please review our community guidelines.');
      navigate(-1);
    };
    const handleModerationSuspend = (data: { message?: string }) => {
      if (!mounted) return;
      showToast(data?.message || 'Your account is under review. Contact support if you have questions.');
      navigate('/');
    };
    websocket.on('moderation_warning', handleModerationWarning);
    websocket.on('moderation_pause', handleModerationPause);
    websocket.on('moderation_suspend', handleModerationSuspend);

    connect();

    return () => {
      mounted = false;
      if (battleEndedTimeoutRef.current) {
        clearTimeout(battleEndedTimeoutRef.current);
        battleEndedTimeoutRef.current = null;
      }
      websocket.off('room_state', handleRoomState);
      websocket.off('user_joined', handleUserJoined);
      websocket.off('user_left', handleUserLeft);
      websocket.off('chat_message', handleChatMessage);
      websocket.off('gift_sent', handleGiftSent);
      websocket.off('battle_state_sync', handleBattleStateSync);
      websocket.off('battle_tick', handleBattleTick);
      websocket.off('battle_score', handleBattleScore);
      websocket.off('battle_countdown', handleBattleCountdown);
      websocket.off('battle_ended', handleBattleEnded);
      websocket.off('battle_ready_state', handleBattleReadyState);
      websocket.off('battle_invite', handleBattleInvite);
      websocket.off('battle_invite_accepted', handleBattleInviteAccepted);
      websocket.off('cohost_request', handleCohostRequest);
      websocket.off('cohost_request_accepted', handleCohostRequestAccepted);
      websocket.off('moderation_warning', handleModerationWarning);
      websocket.off('moderation_pause', handleModerationPause);
      websocket.off('moderation_suspend', handleModerationSuspend);
      websocket.disconnect();
    };
  }, [effectiveStreamId, user?.id, navigate]);

  // AI moderation: periodic frame check when broadcasting (flag + assist, all actions logged)
  const moderationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isBroadcast || !user?.id || !effectiveStreamId) return;

    const captureFrame = (): string | null => {
      const video = videoRef.current;
      if (!video?.srcObject || video.readyState < 2) return null;
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return null;
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(w, 640);
        canvas.height = Math.min(h, (640 * h) / w);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64 = dataUrl.split(',')[1];
        return base64 || null;
      } catch {
        return null;
      }
    };

    const runCheck = async () => {
      const base64 = captureFrame();
      if (!base64) return;
      try {
        const token = useAuthStore.getState().session?.access_token;
        if (!token) return;
        const res = await fetch(apiUrl('/api/live/moderation/check'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ stream_key: effectiveStreamId, image_base64: base64 }),
        });
        if (!res.ok) return;
        const json = await res.json();
        const action = json?.action;
        const message = json?.message || '';
        if (action === 'warning') {
          setModerationWarningMessage(message);
          setShowModerationWarning(true);
        } else if (action === 'pause') {
          showToast(message);
          navigate(-1);
        } else if (action === 'suspend') {
          showToast(message);
          navigate('/');
        }
      } catch {
        // ignore
      }
    };

    moderationIntervalRef.current = setInterval(runCheck, 30000);

    return () => {
      if (moderationIntervalRef.current) {
        clearInterval(moderationIntervalRef.current);
        moderationIntervalRef.current = null;
      }
    };
  }, [isBroadcast, user?.id, effectiveStreamId, navigate]);

  const [giftQueue, setGiftQueue] = useState<{ video: string; preview: string }[]>([]);
  const [giftBanner, setGiftBanner] = useState<{ username: string; giftName: string; icon: string } | null>(null);
  const giftBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlayingGift, setIsPlayingGift] = useState(false);
  const [lastSentGift, setLastSentGift] = useState<typeof GIFTS[0] | null>(null);
  const [userLevel, setUserLevel] = useState(1);


  const [userXP, setUserXP] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [showComboButton, setShowComboButton] = useState(false);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  useEffect(() => {
    if (!isPlayingGift && giftQueue.length > 0) {
      setCurrentGift(giftQueue[0]);
      setIsPlayingGift(true);
      setGiftQueue(prev => prev.slice(1));
    }
  }, [giftQueue, isPlayingGift]);

  const handleGiftEnded = () => {
    setCurrentGift(null);
    setIsPlayingGift(false);
  };

  const handleSendGift = async (gift: typeof GIFTS[0]) => {
    if (!gift) return;

    try {
      // Local/dev: always allow sending gifts, even if coinBalance is low,
      // so video gifts are never blocked from playing.
      if (gift.video && gift.video.trim()) {
        const videoUrl = (gift.video.startsWith('http://') || gift.video.startsWith('https://'))
          ? gift.video
          : resolveGiftAssetUrl(gift.video.startsWith('/') ? gift.video : `/${gift.video}`);
        const previewUrl = gift.preview
          ? ((gift.preview.startsWith('http://') || gift.preview.startsWith('https://'))
              ? gift.preview
              : resolveGiftAssetUrl(gift.preview.startsWith('/') ? gift.preview : `/${gift.preview}`))
          : videoUrl;
        if (videoUrl) setGiftQueue(prev => [...prev, { video: videoUrl, preview: previewUrl }]);
      }
      
      let newLevel = userLevel;
      
      if (user?.id) {
        try {
          const authToken = useAuthStore.getState().session?.access_token;
          const res = await fetch(apiUrl('/api/gifts/send'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
            body: JSON.stringify({ streamKey: effectiveStreamId, giftId: gift.id, channel: platform.name }),
          });
          const result = await res.json().catch(() => ({}));

          if (!res.ok) {
            const msg = typeof result.error === 'string' ? result.error : '';
            if (msg.includes('frozen')) {
              showToast('Account is frozen. Contact support.');
              return;
            }
            setCoinBalance(prev => { const n = Math.max(0, prev - gift.coins); persistTestCoinsBalance(user?.id, n); return n; });
          } else {
            if (result.new_balance != null) {
              const nb = Number(result.new_balance);
              setCoinBalance(nb);
              persistTestCoinsBalance(user?.id, nb);
            }
            if (result.new_level != null) {
              const updatedLevel = Number(result.new_level);
              setUserLevel(updatedLevel);
              updateUser({ level: updatedLevel });
              newLevel = updatedLevel;
            }
            if (result.new_xp != null) {
              setUserXP(Number(result.new_xp));
            }
          }
        } catch {
          setCoinBalance(prev => { const n = Math.max(0, prev - gift.coins); persistTestCoinsBalance(user?.id, n); return n; });
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
      } else {
        setCoinBalance(prev => { const n = Math.max(0, prev - gift.coins); persistTestCoinsBalance(user?.id, n); return n; });
      }

      // Track session contribution for membership
      setSessionContribution(prev => prev + gift.coins);

      maybeEnqueueUniverse(gift.name, viewerName);
      addBattleGifterCoins(viewerName, gift.coins, undefined, user?.avatar || '');

      // Rose trigger for Speed Challenge
      if (gift.name.toLowerCase().includes('rose')) {
        roseCountRef.current += 1;
        setRoseCount(roseCountRef.current);
      }

      if (isBroadcast && !isBattleMode) {
        maybeTriggerFaceARGift(gift);
      }
      
      // Add to chat
      const giftMsg: LiveMessage = {
          id: Date.now().toString(),
          username: isBroadcast ? creatorName : viewerName,
          text: `Sent a ${gift.name}`,
          isGift: true,
          level: newLevel,
          avatar: isBroadcast ? myAvatar : viewerAvatar,
      };
      setMessages(prev => [...prev, giftMsg]);

      websocket.send('gift_sent', {
        giftId: gift.id,
        giftName: gift.name,
        coins: gift.coins,
        gift_icon: gift.icon || '🎁',
        quantity: 1,
        level: newLevel,
        avatar: giftMsg.avatar,
        video: gift.video || null,
        transactionId: `${user?.id || 'anon'}-${Date.now()}`,
        battleTarget: isBattleMode ? giftTarget : undefined,
        creator_name: hostName || 'Creator',
      });

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

  const toggleCam = () => {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = isCamOff;
      setIsCamOff(!isCamOff);
    }
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
          const authToken = useAuthStore.getState().session?.access_token;
          const res = await fetch(apiUrl('/api/gifts/send'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
            body: JSON.stringify({ streamKey: effectiveStreamId, giftId: lastSentGift.id, channel: platform.name }),
          });
          const result = await res.json().catch(() => ({}));

          if (!res.ok) {
            const msg = typeof result.error === 'string' ? result.error : '';
            if (msg.includes('insufficient_funds')) {
              showToast('Not enough coins');
              return;
            }
            setCoinBalance(prev => { const n = Math.max(0, prev - lastSentGift.coins); persistTestCoinsBalance(user?.id, n); return n; });
          } else {
            if (result.new_balance != null) {
              const nb = Number(result.new_balance);
              setCoinBalance(nb);
              persistTestCoinsBalance(user?.id, nb);
            }
            if (result.new_level != null) {
              newLevel = Number(result.new_level);
              setUserLevel(newLevel);
              updateUser({ level: newLevel });
            }
            if (result.new_xp != null) setUserXP(Number(result.new_xp));
          }
        } catch {
          setCoinBalance(prev => { const n = Math.max(0, prev - lastSentGift.coins); persistTestCoinsBalance(user?.id, n); return n; });
        }
      } else {
        setCoinBalance(prev => { const n = Math.max(0, prev - lastSentGift.coins); persistTestCoinsBalance(user?.id, n); return n; });
      }

      // Track session contribution for membership
      setSessionContribution(prev => prev + lastSentGift.coins);

      maybeEnqueueUniverse(lastSentGift.name, viewerName);
      addBattleGifterCoins(viewerName, lastSentGift.coins, undefined, user?.avatar || '');

      // Rose trigger for Speed Challenge
      if (lastSentGift.name.toLowerCase().includes('rose')) {
        roseCountRef.current += 1;
        setRoseCount(roseCountRef.current);
      }

      if (isBroadcast && !isBattleMode) {
        maybeTriggerFaceARGift(lastSentGift);
      }
      
      if (lastSentGift.video && lastSentGift.video.trim()) {
        const videoUrl = (lastSentGift.video.startsWith('http://') || lastSentGift.video.startsWith('https://'))
          ? lastSentGift.video
          : resolveGiftAssetUrl(lastSentGift.video.startsWith('/') ? lastSentGift.video : `/${lastSentGift.video}`);
        const previewUrl = lastSentGift.preview
          ? ((lastSentGift.preview.startsWith('http://') || lastSentGift.preview.startsWith('https://'))
              ? lastSentGift.preview
              : resolveGiftAssetUrl(lastSentGift.preview.startsWith('/') ? lastSentGift.preview : `/${lastSentGift.preview}`))
          : videoUrl;
        if (videoUrl) setGiftQueue(prev => [...prev, { video: videoUrl, preview: previewUrl }]);
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
      
      const newMsg: LiveMessage = {
          id: Date.now().toString(),
          username: isBroadcast ? creatorName : viewerName,
          text: inputValue,
          level: userLevel,
          avatar: isBroadcast ? myAvatar : viewerAvatar,
          isMod: isBroadcast || moderators.has(user?.id || ''),
      };
      setMessages(prev => [...prev, newMsg]);

      websocket.send('chat_message', {
        text: inputValue,
        level: userLevel,
        avatar: newMsg.avatar,
      });

      setInputValue('');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const stopBroadcast = () => {
      websocket.send('stream_end', {});
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
        setCameraStream(null);
      }
      clearCachedCameraStream();
      websocket.disconnect();
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

  const openMiniProfile = async (username: string, coins?: number) => {
    const avatar = username === myCreatorName
      ? myAvatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=121212&color=C9A96E`;
    const level = username === myCreatorName ? userLevel : null;
    const donated = username === myCreatorName ? sessionContribution : 0;
    setMiniProfile({ username, avatar, level, coins, donated });
    try {
      const authToken = useAuthStore.getState().session?.access_token;
      const res = await fetch(apiUrl(`/api/profiles/by-username/${encodeURIComponent(username)}`), {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (res.ok) {
        const prof = await res.json();
        if (prof?.user_id) {
          setMiniProfile(prev => prev ? {
            ...prev,
            id: prof.user_id,
            bio: prof.bio || '',
            avatar: prof.avatar_url || prev.avatar,
            level: prof.level ?? prev.level,
            followers_count: prof.followers_count ?? 0,
            following_count: prof.following_count ?? 0,
          } : prev);
        }
      }
    } catch { /* keep what we have */ }
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
    setBattleCountdown(null);
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
    <div className="min-h-[100dvh] h-[100dvh] w-full flex justify-center bg-[#0A0B0E]">
      <div className="relative w-full max-w-[480px] h-full bg-[#13151A] overflow-hidden border-none">
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
            className={coHosts.length > 0 ? 'absolute inset-x-0 z-[25] flex flex-row' : 'relative w-full h-full'}
            style={coHosts.length > 0 ? { top: '90px', height: 'calc(36dvh + 10mm)', filter: liveFilterCss !== 'none' ? liveFilterCss : undefined } : { filter: liveFilterCss !== 'none' ? liveFilterCss : undefined }}
            onPointerDown={isBroadcast ? undefined : (e) => {
              if (e.target instanceof Element) {
                const interactive = e.target.closest('button, a, input, textarea, select, [role="button"]');
                if (interactive) return;
              }
              handleLikeTap(e);
              const now = Date.now();
              const last = lastScreenTapRef.current;
              lastScreenTapRef.current = now;
              if (now - last <= 320) handleComboClick();
            }}
          >
            {/* Left: Host camera (big) */}
            <div
              className={coHosts.length > 0 ? 'flex-1 min-w-0 relative' : 'relative w-full h-full'}
              onPointerDown={isBroadcast ? (e) => {
                if (e.target instanceof Element && e.target.closest('button, a, input, textarea, select, [role="button"]')) return;
                handleLikeTap(e);
                const now = Date.now();
                const last = lastScreenTapRef.current;
                lastScreenTapRef.current = now;
                if (now - last <= 320) handleComboClick();
              } : undefined}
            >
            {isBroadcast || isBattleParticipant ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                  style={isBroadcast ? { transform: 'scaleX(-1)', opacity: isCamOff ? 0 : 1, transition: 'opacity 0.3s ease' } : undefined}
                />
                {isCamOff && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#13151A] z-[5]">
                    {(user?.avatar || myAvatar) ? (
                      <img src={user?.avatar || myAvatar || ''} alt="" className="w-16 h-16 rounded-full border-2 border-[#C9A96E]/40 object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full border-2 border-[#C9A96E]/40 bg-[#1C1E24] flex items-center justify-center">
                        <span className="text-2xl font-black text-[#C9A96E]/60">{(creatorName || user?.username || 'Me').charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <span className="text-white font-bold text-xs">{creatorName || user?.username || user?.name || 'Me'}</span>
                  </div>
                )}
                {isBroadcast && coHosts.length > 0 && (
                  <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5 pointer-events-auto">
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleMic(); }} className="p-0.5 rounded bg-black/50" title={isMicMuted ? 'Unmute' : 'Mute'}>
                      {isMicMuted ? <MicOff className="w-3 h-3 text-white" strokeWidth={2.5} /> : <Mic className="w-3 h-3 text-white" strokeWidth={2.5} />}
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleCam(); }} className="p-0.5 rounded" title={isCamOff ? 'Camera on' : 'Camera off'}>
                      {isCamOff ? <CameraOff className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" strokeWidth={2.5} /> : <Camera className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <video
                  ref={viewerVideoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  style={viewerHasStream ? {} : { display: 'none' }}
                />
                {!viewerHasStream && (
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
              </>
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
            </div>

            {/* Right: co-host cells — only when at least one co-host invited or live */}
            {coHosts.length > 0 && (() => {
              const cellSlots: Array<{ type: 'live' | 'invited' | 'pending' | 'empty'; host?: (typeof coHosts)[0] }> = [];
              const list = isBroadcast ? coHosts.filter(h => h.userId !== user?.id) : coHosts;
              list.forEach(h => {
                if (h.status === 'live' || h.status === 'accepted') cellSlots.push({ type: 'live', host: h });
                else if (h.status === 'invited') cellSlots.push({ type: 'invited', host: h });
                else if (h.status === 'pending_accept') cellSlots.push({ type: 'pending', host: h });
              });
              while (cellSlots.length < 8) cellSlots.push({ type: 'empty' });
              return (
                <div className="w-1/2 h-full grid grid-cols-2 grid-rows-4 gap-[1px] bg-[#1a1c22]">
                  {cellSlots.slice(0, 8).map((slot, i) => (
                    <div key={i} className="relative bg-[#13151A] flex flex-col items-center justify-center p-1">
                      {slot.type === 'live' && slot.host ? (
                        <>
                          <video
                            ref={(el) => { if (el) coHostVideoRefs.current.set(slot.host!.userId, el); else coHostVideoRefs.current.delete(slot.host!.userId); }}
                            className="absolute inset-0 w-full h-full object-cover rounded-sm"
                            autoPlay
                            playsInline
                            muted={slot.host.isMuted}
                            style={coHostCameraOff[slot.host.id] ? { display: 'none' } : undefined}
                          />
                          {coHostCameraOff[slot.host.id] && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#13151A] z-[6] rounded-sm">
                              {slot.host.avatar ? (
                                <img src={slot.host.avatar} alt="" className="w-10 h-10 rounded-full border-2 border-[#C9A96E]/40 object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-full border-2 border-[#C9A96E]/40 bg-[#1C1E24] flex items-center justify-center">
                                  <span className="text-[#C9A96E]/60 text-sm font-bold">{(slot.host.name || '?').charAt(0)}</span>
                                </div>
                              )}
                              <span className="text-white/90 text-[8px] font-bold truncate max-w-full px-1">{slot.host.name}</span>
                            </div>
                          )}
                          {(() => {
                            const el = coHostVideoRefs.current.get(slot.host!.userId);
                            const hasTracks = el?.srcObject && (el.srcObject as MediaStream).getVideoTracks().some(t => t.enabled);
                            if (!hasTracks && !coHostCameraOff[slot.host!.id]) return (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#13151A] z-[5]">
                                <CameraOff size={20} className="text-white/30" />
                                <span className="text-white/40 text-[8px] mt-1">{slot.host!.name}</span>
                              </div>
                            );
                            return null;
                          })()}
                          <div className="absolute top-0.5 right-0.5 z-10 flex items-center gap-0.5 pointer-events-auto">
                            <button type="button" onClick={(e) => { e.stopPropagation(); toggleCoHostMute(slot.host!.id); }} className="p-0.5 rounded bg-black/50" title={slot.host.isMuted ? 'Unmute' : 'Mute'}>
                              {slot.host.isMuted ? <MicOff className="w-3 h-3 text-white" strokeWidth={2.5} /> : <Mic className="w-3 h-3 text-white" strokeWidth={2.5} />}
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); toggleCoHostCamera(slot.host!.id); }} className="p-0.5 rounded" title={coHostCameraOff[slot.host.id] ? 'Camera on' : 'Camera off'}>
                              {coHostCameraOff[slot.host.id] ? <CameraOff className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" strokeWidth={2.5} /> : <Camera className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
                            </button>
                          </div>
                        </>
                      ) : slot.type === 'invited' && slot.host ? (
                        <>
                          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#C9A96E]/40 bg-[#1C1E24]">
                            {slot.host.avatar ? <img src={slot.host.avatar} alt="" className="w-full h-full object-cover opacity-60" /> : <div className="w-full h-full flex items-center justify-center text-[#C9A96E]/60 text-base font-bold">{(slot.host.name || '?').charAt(0)}</div>}
                          </div>
                          <p className="text-white/60 text-[9px] font-bold mt-0.5 truncate max-w-[95%] text-center">{slot.host.name}</p>
                          <span className="text-[#C9A96E]/70 text-[8px] font-semibold">Invited</span>
                        </>
                      ) : slot.type === 'pending' && slot.host ? (
                        <>
                          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#C9A96E] bg-[#1C1E24]">
                            {slot.host.avatar ? <img src={slot.host.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#C9A96E] text-sm font-bold">{(slot.host.name || '?').charAt(0)}</div>}
                          </div>
                          <p className="text-white text-[8px] font-bold mt-0.5 truncate max-w-[95%] text-center">{slot.host.name}</p>
                          <span className="text-[#C9A96E]/70 text-[8px] font-semibold">Pending — use Co-Host panel</span>
                        </>
                      ) : (
                        <button type="button" onClick={() => isBroadcast ? setIsInviteHostOpen(true) : setShowViewerList(true)} className="flex flex-col items-center justify-center w-full h-full active:scale-95">
                          <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                            <span className="text-white/30 text-2xl font-light">+</span>
                          </div>
                          <p className="text-white/30 text-[9px] font-semibold mt-0.5">{isBroadcast ? 'Invite' : 'Request'}</p>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Battle Split Screen Overlay — shown whenever in battle mode */}
        {isBattleMode && (location.pathname.startsWith('/live') || location.pathname.startsWith('/watch')) && (
          <div
            className={`absolute inset-0 z-[80] flex flex-col ${isBroadcast ? 'pointer-events-none' : ''}`}
            style={{
              // Slightly lower than top overlays: safe-area + 90px
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 90px)',
              paddingBottom: isBroadcast ? '305px' : undefined,
            }}
            onClick={(e) => {
              if (isBroadcast) return;
              e.stopPropagation();
              handleScreenTap(e);
            }}
          >
            {/* Battle timer — overlay on top of screen/video */}
            <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none flex justify-center max-w-[480px] mx-auto py-1.5 px-2 bg-gradient-to-b from-black/50 to-transparent" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4cm - 10.5mm)' }}>
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-full px-2 py-0.5 border border-white/10 shadow-sm">
                <div className="relative w-[16px] h-[16px] flex items-center justify-center">
                  <svg viewBox="0 0 40 44" className="absolute inset-0 w-full h-full drop-shadow-md">
                    <path d="M20 2 L36 10 L36 26 Q36 38 20 42 Q4 38 4 26 L4 10 Z" fill="url(#vsGrad2)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
                    <defs><linearGradient id="vsGrad2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#DC143C"/><stop offset="50%" stopColor="#8B0000"/><stop offset="100%" stopColor="#1E90FF"/></linearGradient></defs>
                  </svg>
                  <span className="relative z-10 text-white text-[5px] font-black italic drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">VS</span>
                </div>
                <span className="text-white text-[10px] font-black tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{formatTime(battleTime)}</span>
              </div>
            </div>

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
                <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl bg-[#13151A]/60 backdrop-blur-xl border border-white/15 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
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
                <div className="flex flex-col items-center gap-1 px-6 py-3 rounded-xl bg-[#13151A]/70 backdrop-blur-md border border-white/15 shadow-[0_0_20px_rgba(0,0,0,0.6)]">
                  <span className="text-white text-[10px] font-bold uppercase tracking-widest">⚡ Speed Challenge Result</span>
                  <span className="text-white text-lg font-black drop-shadow-[0_0_15px_rgba(230,179,106,0.8)] animate-bounce">{speedChallengeResult}</span>
                </div>
              </div>
            )}

            {/* Dynamic Battle Grid: 2-split or 4-split based on players */}
            {(() => {
              const is4Player = battleSlots[1].status !== 'empty' || battleSlots[2].status !== 'empty';
              return (
                <div className={`relative w-full flex-none flex flex-col ${is4Player ? 'aspect-square' : 'h-[44dvh]'}`}>
                  {/* Fan Club Button - Left of Battle Bar */}
                  <div className="absolute top-2 left-[20%] -translate-x-1/2 z-30 pointer-events-auto">
                    {/* Fan Club Removed */}
                  </div>

                  {/* Battle Score Bar */}
                  <div className="relative z-20 w-full flex-none overflow-hidden" style={{ height: '18px' }}>
                    <div
                      className="absolute inset-0 flex cursor-pointer pointer-events-auto"
                      onClick={(e) => { e.stopPropagation(); if (isBroadcast) { toggleBattle(); } else { spawnHeartFromClient(e.clientX, e.clientY); } }}
                    >
                      <div className="h-full transition-all duration-500 ease-out" style={{ width: `${leftPct}%`, backgroundImage: 'linear-gradient(90deg, #DC143C, #FF1744, #C41E3A)' }} />
                      <div className="h-full flex-1 transition-all duration-500 ease-out" style={{ backgroundImage: 'linear-gradient(90deg, #1E90FF, #4169E1, #0047AB)' }} />
                    </div>
                    <div className="absolute inset-0 z-10 flex items-center justify-between px-2 pointer-events-none">
                      <span className="text-white font-black text-[14px] tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{(typeof redTeamScore === 'number' && Number.isFinite(redTeamScore) ? redTeamScore : 0).toLocaleString()}</span>
                      <span className="text-white font-black text-[14px] tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{(typeof blueTeamScore === 'number' && Number.isFinite(blueTeamScore) ? blueTeamScore : 0).toLocaleString()}</span>
                    </div>
                  </div>

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

                  {/* Grid Container */}
                  <div className="flex-1 min-h-0 flex flex-col">
                    {/* Row 1: P1 & P2 */}
                    <div className="flex flex-1 min-h-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleBattleTap('me'); setGiftTarget('me'); spawnHeartFromClient(e.clientX, e.clientY); }}
                        className={`w-1/2 h-full overflow-hidden relative bg-[#13151A] pointer-events-auto border-r border-white/5 ${is4Player ? 'border-b' : ''}`}
                      >
                      <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay playsInline muted style={isCamOff ? { opacity: 0 } : undefined} />
                      {isCamOff && (
                        <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-1 bg-[#13151A]">
                          {(user?.avatar || myAvatar) ? (
                            <img src={user?.avatar || myAvatar || ''} alt="" className="w-12 h-12 rounded-full border-2 border-[#C9A96E]/40 object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full border-2 border-[#C9A96E]/40 bg-[#1C1E24] flex items-center justify-center">
                              <span className="text-lg font-black text-[#C9A96E]/60">{(creatorName || user?.username || 'Me').charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <span className="text-white font-bold text-[10px] truncate max-w-full px-1">{creatorName || user?.username || user?.name || 'Me'}</span>
                        </div>
                      )}
                      <div className="absolute bottom-2 right-2 z-10 pointer-events-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); togglePlayerMute('me'); }}
                          title={mutedPlayers['me'] ? 'Unmute' : 'Mute'}
                          className="w-5 h-5 flex items-center justify-center"
                        >
                          {mutedPlayers['me']
                            ? <MicOff className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />
                            : <Mic className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
                        </button>
                        <button
                          type="button"
                          className="w-5 h-5 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                          onClick={(e) => { e.stopPropagation(); toggleBattle(); }}
                          title="End Battle"
                        >
                          <img src="/Icons/Gold power buton.png" alt="End Battle" className="w-3 h-3 object-contain drop-shadow-md" />
                        </button>
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
                        <div className="w-full h-full relative bg-[#13151A]">
                          <video ref={opponentVideoRef} className="w-full h-full object-cover absolute inset-0 z-10" autoPlay playsInline muted={!!mutedPlayers['opponent']} style={cameraOffPlayers['opponent'] ? { display: 'none' } : undefined} />
                          {cameraOffPlayers['opponent'] && (
                            <div className="absolute inset-0 z-[11] flex flex-col items-center justify-center gap-2 bg-[#13151A]">
                              {battleSlots[0].avatar ? (
                                <img src={battleSlots[0].avatar} alt="" className="w-16 h-16 rounded-full border-2 border-[#C9A96E]/40 object-cover" />
                              ) : (
                                <div className="w-16 h-16 rounded-full border-2 border-[#C9A96E]/40 bg-[#1C1E24] flex items-center justify-center">
                                  <span className="text-2xl font-black text-[#C9A96E]/60">{(battleSlots[0].name || 'P').charAt(0).toUpperCase()}</span>
                                </div>
                              )}
                              <span className="text-white font-bold text-xs">{battleSlots[0].name}</span>
                            </div>
                          )}
                          {!hasOpponentStream && !cameraOffPlayers['opponent'] && (
                            <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2 bg-[#13151A]">
                              {battleSlots[0].avatar ? (
                                <img src={battleSlots[0].avatar} alt={battleSlots[0].name} className="w-16 h-16 rounded-full border-2 border-[#C9A96E] object-cover" />
                              ) : (
                                <div className="w-16 h-16 rounded-full border-2 border-[#C9A96E] bg-[#1C1E24] flex items-center justify-center">
                                  <span className="text-2xl font-black text-[#C9A96E]">{(battleSlots[0].name || 'P').charAt(0).toUpperCase()}</span>
                                </div>
                              )}
                              <span className="text-white text-xs font-bold">{battleSlots[0].name}</span>
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-green-400 text-[10px] font-bold">Connecting...</span>
                              </div>
                            </div>
                          )}
                        </div>
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
                        <div className="absolute top-1 left-1 z-10 pointer-events-auto flex items-center gap-0.5">
                          <div onClick={(e) => { e.stopPropagation(); togglePlayerMute('opponent'); }} title={mutedPlayers['opponent'] ? 'Unmute' : 'Mute'}>
                            {mutedPlayers['opponent'] ? <MicOff className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" strokeWidth={2.5} /> : <Mic className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
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

                  {/* Row 2: P3 & P4 — only when 4 players, same container */}
                  {is4Player && (
                    <div className="flex flex-1 min-h-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setGiftTarget('player3'); spawnHeartFromClient(e.clientX, e.clientY); }}
                        className="w-1/2 h-full overflow-hidden relative bg-[#13151A] pointer-events-auto border-r border-white/5"
                      >
                        {battleSlots[1].status === 'accepted' ? (
                          <div className="w-full h-full relative bg-[#13151A]">
                            <video ref={player3VideoRef} className="w-full h-full object-cover" autoPlay playsInline muted={!!mutedPlayers['player3']} style={player3VideoRef.current?.srcObject && !cameraOffPlayers['player3'] ? {} : { display: 'none' }} />
                            {cameraOffPlayers['player3'] && (
                              <div className="absolute inset-0 z-[11] flex flex-col items-center justify-center gap-1 bg-[#13151A]">
                                {battleSlots[1].avatar ? (
                                  <img src={battleSlots[1].avatar} alt="" className="w-12 h-12 rounded-full border-2 border-[#C9A96E]/40 object-cover" />
                                ) : (
                                  <div className="w-12 h-12 rounded-full border-2 border-[#C9A96E]/40 bg-[#1C1E24] flex items-center justify-center">
                                    <span className="text-lg font-black text-[#C9A96E]/60">{(battleSlots[1].name || '?').charAt(0).toUpperCase()}</span>
                                  </div>
                                )}
                                <span className="text-white font-bold text-[10px] truncate max-w-full px-1">{battleSlots[1].name}</span>
                              </div>
                            )}
                            {!player3VideoRef.current?.srcObject && !cameraOffPlayers['player3'] && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                <img src={battleSlots[1].avatar} alt={battleSlots[1].name} className="w-12 h-12 rounded-full border-2 border-[#C9A96E] object-cover" />
                                <span className="text-white text-[10px] font-bold">{battleSlots[1].name}</span>
                                <div className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                  <span className="text-green-400 text-[9px] font-bold">JOINED</span>
                                </div>
                              </div>
                            )}
                          </div>
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
                          <div className="absolute top-1 right-1 z-10 pointer-events-auto flex items-center gap-0.5">
                            <div onClick={(e) => { e.stopPropagation(); togglePlayerMute('player3'); }} title={mutedPlayers['player3'] ? 'Unmute' : 'Mute'}>
                              {mutedPlayers['player3'] ? <MicOff className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" strokeWidth={2.5} /> : <Mic className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
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
                          <div className="w-full h-full relative bg-[#13151A]">
                            <video ref={player4VideoRef} className="w-full h-full object-cover" autoPlay playsInline muted={!!mutedPlayers['player4']} style={player4VideoRef.current?.srcObject && !cameraOffPlayers['player4'] ? {} : { display: 'none' }} />
                            {cameraOffPlayers['player4'] && (
                              <div className="absolute inset-0 z-[11] flex flex-col items-center justify-center gap-1 bg-[#13151A]">
                                {battleSlots[2].avatar ? (
                                  <img src={battleSlots[2].avatar} alt="" className="w-12 h-12 rounded-full border-2 border-[#C9A96E]/40 object-cover" />
                                ) : (
                                  <div className="w-12 h-12 rounded-full border-2 border-[#C9A96E]/40 bg-[#1C1E24] flex items-center justify-center">
                                    <span className="text-lg font-black text-[#C9A96E]/60">{(battleSlots[2].name || '?').charAt(0).toUpperCase()}</span>
                                  </div>
                                )}
                                <span className="text-white font-bold text-[10px] truncate max-w-full px-1">{battleSlots[2].name}</span>
                              </div>
                            )}
                            {!player4VideoRef.current?.srcObject && !cameraOffPlayers['player4'] && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                <img src={battleSlots[2].avatar} alt={battleSlots[2].name} className="w-12 h-12 rounded-full border-2 border-[#C9A96E] object-cover" />
                                <span className="text-white text-[10px] font-bold">{battleSlots[2].name}</span>
                                <div className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                  <span className="text-green-400 text-[9px] font-bold">JOINED</span>
                                </div>
                              </div>
                            )}
                          </div>
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
                          <div className="absolute top-1 right-1 z-10 pointer-events-auto flex items-center gap-0.5">
                            <div onClick={(e) => { e.stopPropagation(); togglePlayerMute('player4'); }} title={mutedPlayers['player4'] ? 'Unmute' : 'Mute'}>
                              {mutedPlayers['player4'] ? <MicOff className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" strokeWidth={2.5} /> : <Mic className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
                            </div>
                            <div onClick={(e) => { e.stopPropagation(); removePlayerFromSlot(2); }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                            </div>
                        </div>
                      )}

                      <div 
                        className="absolute bottom-1 right-1 flex items-center cursor-pointer hover:scale-105 transition-transform active:scale-95 pointer-events-auto"
                        style={{ right: '2.5rem' }}
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
              </div>
            );
          })()}

              {/* MVP Circles - outside below battle frame, 3 left + 3 right */}
            <div className="w-full px-3 py-2 flex items-center justify-between flex-none pointer-events-none mt-1 relative z-30">
              {/* Left side - top gifters for P1, fallback to spectator avatars */}
              <div className="flex items-center -space-x-1.5 pointer-events-auto" onClick={() => setShowViewerList(true)}>
                {[0, 1, 2].map((i) => {
                  const g = getTopGifters('me')[i];
                  const fallbackViewer = activeViewers[i];
                  const src = g?.avatar || fallbackViewer?.avatar || '';
                  const alt = g?.name || fallbackViewer?.displayName || '';
                  const isMvp = i === 0 && battleWinner && g;
                  return (
                    <div key={i} style={{ zIndex: 3 - i }} className="relative">
                      <AvatarRing src={src} alt={alt} size={36} />
                      {isMvp && (
                        <div className="absolute -top-2 -right-1 bg-[#C9A96E] rounded-full w-5 h-5 flex items-center justify-center border border-black shadow-lg z-10">
                          <Crown size={10} className="text-black" />
                        </div>
                      )}
                    </div>
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

              {/* Right side - top gifters for P2, fallback to spectator avatars */}
              <div className="flex items-center -space-x-1.5 pointer-events-auto" onClick={() => setShowViewerList(true)}>
                {[0, 1, 2].map((i) => {
                  const g = getTopGifters('opponent')[i];
                  const fallbackViewer = activeViewers[3 + i];
                  const src = g?.avatar || fallbackViewer?.avatar || '';
                  const alt = g?.name || fallbackViewer?.displayName || '';
                  const isMvp = i === 0 && battleWinner && g;
                  return (
                    <div key={i} style={{ zIndex: 3 - i }} className="relative">
                      <AvatarRing src={src} alt={alt} size={36} />
                      {isMvp && (
                        <div className="absolute -top-2 -right-1 bg-[#C9A96E] rounded-full w-5 h-5 flex items-center justify-center border border-black shadow-lg z-10">
                          <Crown size={10} className="text-black" />
                        </div>
                      )}
                    </div>
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
              {/* Top Bar — always show creator layout for everyone */}
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
                                <span className="text-white/70 text-[8px] font-bold tabular-nums">{(typeof activeLikes === 'number' && Number.isFinite(activeLikes) ? activeLikes : 0).toLocaleString()}</span>
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
                        <div className="flex items-center -space-x-1.5 pointer-events-auto flex-shrink-0" onClick={() => setShowViewerList(prev => !prev)}>
                          {isBattleMode ? (
                            (() => {
                              const top3 = getTop3GiftersOverall();
                              if (top3.length === 0) {
                                return activeViewers.slice(0, 3).map((v, i) => (
                                  <div key={v.id} style={{ zIndex: 3 - i }} className="relative">
                                    <AvatarRing src={v.avatar} alt={v.username} size={36} />
                                  </div>
                                ));
                              }
                              return top3.map((g, i) => {
                                const isMvp = i === 0;
                                return (
                                  <div key={g.name} style={{ zIndex: 3 - i }} className="relative">
                                    <AvatarRing src={g.avatar} alt={g.name} size={36} />
                                    {isMvp && (
                                      <div className="absolute -top-2 -right-1 bg-[#C9A96E] rounded-full w-5 h-5 flex items-center justify-center border border-black shadow-lg z-10">
                                        <Crown size={10} className="text-black" />
                                      </div>
                                    )}
                                  </div>
                                );
                              });
                            })()
                          ) : (
                            activeViewers.slice(0, 3).map((v, i) => (
                              <div key={v.id} style={{ zIndex: 3 - i }} className="relative">
                                <AvatarRing src={v.avatar} alt={v.username} size={36} />
                              </div>
                            ))
                          )}
                        </div>
                        <button onClick={() => setShowViewerList(prev => !prev)} className="flex items-center gap-0.5 pointer-events-auto">
                          <span className="text-white text-[9px] font-bold tabular-nums">{formatCountShort(viewerCount)}</span>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        <button type="button" onClick={() => { if (!isBroadcast) { navigate('/feed', { replace: true }); } else if (isBattleMode) { toggleBattle(); } else { stopBroadcast(); } }} className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-transform" title={isBroadcast ? (isBattleMode ? 'End battle' : 'End broadcast') : 'Leave'}>
                          <img src="/Icons/Gold power buton.png" alt="Close" className="w-5 h-5 object-contain" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              {/* Floating Action Buttons */}
              <div className="absolute right-3 bottom-4 z-[150] flex flex-col items-center gap-3 pointer-events-none">
                <div className="flex flex-col items-center gap-3 pointer-events-auto">
                  {/* Broadcaster buttons moved to bottom-right zone */}
                </div>
              </div>
            </div>

            {/* MIDDLE ZONE: CHAT (Scrollable) */}
            <div className="chat-zone fixed left-0 right-0 bottom-[calc(58px+max(12px,env(safe-area-inset-bottom)))] z-[20] flex justify-center pointer-events-none">
              <div 
                className="w-full max-w-[480px] overflow-y-auto pointer-events-auto bg-transparent"
                style={{ height: 'calc(25dvh + 2cm + 4mm)', maxHeight: 'calc(25dvh + 2cm + 4mm)' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (e.target instanceof Element) {
                    const interactive = e.target.closest('button, a, input, textarea, select, [role="button"]');
                    if (interactive) return;
                  }
                  handleLikeTap(e);
                }}
              >
                {isChatVisible && (
                  <ChatOverlay
                    messages={messages}
                    variant="panel"
                    isModerator={isBroadcast || moderators.has(user?.id || '')}
                    onLike={() => addLiveLikes(1)}
                    onHeartSpawn={(cx, cy) => handleLikeTap()}
                    onProfileTap={(username) => openMiniProfile(username)}
                    onDeleteMessage={(msgId) => setMessages(prev => prev.filter(m => m.id !== msgId))}
                    onBlockUser={(username) => {
                      setMessages(prev => prev.filter(m => m.username !== username));
                      showToast(`@${username} blocked from chat`);
                    }}
                  />
                )}
              </div>
            </div>

      {/* BOTTOM RIGHT: Action buttons (same area as before, aligned right) */}
      <div className="bottom-zone flex-none pointer-events-auto bg-transparent px-3 pb-[max(16px,calc(env(safe-area-inset-bottom)+8px))] pt-2 min-h-[44px] flex flex-col items-end fixed left-0 right-0 z-[120] justify-end" style={{ bottom: '16px' }}>
        <div className="w-full max-w-[480px] mx-auto flex flex-col items-end gap-0">
        {/* Combo Button - on top of 3 dots, 1cm up */}
        <AnimatePresence>
          {showComboButton && lastSentGift && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="flex flex-col items-center pointer-events-auto mb-[1cm] ml-[2mm]"
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleComboClick(); }}
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
        <div className="flex justify-end">
          {/* Spectator bottom bar: Co-Host (request only), keyboard, share, more — hidden during gift animation */}
          {!isBroadcast && !currentGift && (
            <div className="flex items-center justify-center gap-3 pointer-events-auto">
              <div className="flex flex-col items-center gap-0.5">
                <button
                  type="button"
                  title={spectatorCoHostRequestSent ? 'Request sent' : 'Request to co-host'}
                  disabled={spectatorCoHostRequestSent || !user?.id}
                  onClick={async () => {
                    if (!user?.id || !effectiveStreamId || spectatorCoHostRequestSent) return;
                    const requesterName = user?.username || user?.name || 'Someone';
                    websocket.send('cohost_request_send', {
                      hostUserId: effectiveStreamId,
                      requesterName,
                      requesterAvatar: user?.avatar || '',
                    });
                    setSpectatorCoHostRequestSent(true);
                    showToast('Co-host request sent!');
                  }}
                  className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg relative disabled:opacity-60 active:scale-95 transition-transform"
                >
                  <span className="flex items-center justify-center w-full h-full relative z-[2]"><UserPlus size={20} className="text-[#C9A96E] shrink-0" strokeWidth={2} /></span>
                  <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
                </button>
                <span className="text-white/60 text-[8px] font-medium">{spectatorCoHostRequestSent ? 'Request sent' : 'Co-Host'}</span>
              </div>
              <button
                type="button"
                title="Type a message"
                onClick={() => setShowSpectatorChatInput(true)}
                className="rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform relative"
                style={{ width: '40mm', height: '40mm' }}
              >
                <MessageCircle size={32} className="text-[#C9A96E] relative z-[2]" />
                <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
              </button>
              <button type="button" title="Share" onClick={() => setShowSharePanel(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform relative">
                <Share2 size={20} className="text-[#C9A96E] relative z-[2]" />
                <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
              </button>
              <button type="button" title="More options" onClick={() => setIsMoreMenuOpen(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform relative">
                <MoreVertical size={20} className="text-[#C9A96E] relative z-[2]" />
                <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
              </button>
            </div>
          )}

          {isBroadcast && !currentGift && (
            <div className="flex items-center justify-center gap-3 pointer-events-auto">
              <div className="flex items-center justify-center gap-3 flex-shrink-0">
              {isBattleMode && battleWinner && (
                <button 
                  type="button" 
                  onClick={() => {
                    if (battleSlots[0]?.userId) {
                      websocket.send('battle_create', {
                        hostName: myCreatorName,
                        opponentUserId: battleSlots[0].userId,
                        opponentName: battleSlots[0].name
                      });
                    }
                    setBattleTime(300);
                    setMyScore(0);
                    setOpponentScore(0);
                    setPlayer3Score(0);
                    setPlayer4Score(0);
                    setBattleWinner(null);
                    setBattleCountdown(null);
                    reachedThresholdsRef.current.clear();
                  }}  
                  className="px-4 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  <RefreshCw size={20} className="text-[#C9A96E] mr-2" />
                  <span className="text-[#C9A96E] text-xs font-bold">Rematch</span>
                </button>
              )}
              <div className="flex flex-col items-center gap-0.5">
                <button type="button" onClick={() => setIsInviteHostOpen(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg relative">
                  <span className="flex items-center justify-center w-full h-full relative z-[2]"><UserPlus size={20} className="text-[#C9A96E] shrink-0" strokeWidth={2} /></span>
                  <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
                  {coHosts.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#C9A96E] rounded-full flex items-center justify-center">
                      <span className="text-black text-[10px] font-black">{coHosts.length}</span>
                    </div>
                  )}
                </button>
                <span className="text-white/60 text-[8px] font-medium">Co-Host</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <button type="button" onClick={() => { if (!isBattleMode) toggleBattle(); else setIsFindCreatorsOpen(true); }} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg relative">
                  <Users size={20} className="text-[#C9A96E] relative z-[2]" />
                  <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
                </button>
                <span className="text-white/60 text-[8px] font-medium">Battle</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <button type="button" title="Share" onClick={() => setShowSharePanel(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform relative">
                  <Share2 size={20} className="text-[#C9A96E] relative z-[2]" />
                  <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
                </button>
                <span className="text-white/60 text-[8px] font-medium">Share</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <button type="button" title="More options" onClick={() => setIsMoreMenuOpen(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg relative">
                  <MoreVertical size={20} className="text-[#C9A96E] relative z-[2]" />
                  <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5" />
                </button>
                <span className="text-white/60 text-[8px] font-medium">More</span>
              </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Spectator chat input overlay — appears when keyboard icon is tapped */}
      {showSpectatorChatInput && !isBroadcast && (
        <div className="fixed inset-0 z-[100000] flex flex-col justify-end pointer-events-none max-w-[480px] mx-auto">
          <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => setShowSpectatorChatInput(false)} />
          <div className="pointer-events-auto relative z-10 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <form
              onSubmit={(e) => { handleSendMessage(e); setShowSpectatorChatInput(false); }}
              className="flex items-center gap-2 bg-[#13151A]/95 backdrop-blur-md rounded-full px-4 py-2 border border-[#C9A96E]/40 h-12"
            >
              <input
                ref={spectatorChatInputRef}
                type="text"
                inputMode="text"
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                autoFocus
                placeholder="Say something..."
                className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-white/40 min-w-0"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <button type="submit" className="text-[#C9A96E] hover:text-[#C9A96E]/80 transition flex-shrink-0" title="Send">
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══ INVITE CO-HOST PANEL — ONLY place for co-host/spectator Join & Reject ═══ */}
      {isInviteHostOpen && (
        <div className="fixed inset-0 z-[99999] flex flex-col justify-end max-w-[480px] mx-auto" style={{ height: '100%' }}>
          <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => { (document.activeElement as HTMLElement)?.blur(); setIsInviteHostOpen(false); setHostSearchQuery(''); }} />
          <div
            className="bg-[#1C1E24]/95 backdrop-blur-md rounded-t-2xl h-[40vh] flex flex-col shadow-2xl border-t border-[#C9A96E]/20 pointer-events-auto w-full relative z-10 overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-[#C9A96E]" strokeWidth={1.8} />
                <span className="text-white font-bold text-[13px]">Invite Co-Hosts</span>
                <span className="text-white/30 text-[10px]">({coHosts.length}/{MAX_CO_HOSTS})</span>
              </div>
            </div>

            {/* Current Co-Hosts */}
            {coHosts.length > 0 && (
              <div className="px-4 py-2 border-b border-white/5 flex-shrink-0">
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar">
                  {coHosts.map(host => (
                    <div key={host.id} className="flex flex-col items-center gap-0.5 min-w-[48px]">
                      <div className="relative">
                        <AvatarRing src={host.avatar} alt={host.name} size={32} />
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#1a1a1a] ${
                          host.status === 'live' ? 'bg-[#C9A96E]' : host.status === 'accepted' ? 'bg-[#C9A96E]/60' : 'bg-[#C9A96E]/30 animate-pulse'
                        }`} />
                      </div>
                      <span className="text-white/50 text-[9px] truncate w-11 text-center">{host.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search */}
            <div className="px-4 py-2 flex-shrink-0">
              <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-1.5 border border-white/10">
                <Search className="w-3.5 h-3.5 text-white/30" strokeWidth={1.8} />
                <input
                  type="text"
                  placeholder="Search spectators..."
                  className="bg-transparent text-white text-xs outline-none flex-1 placeholder:text-white/25"
                  value={hostSearchQuery}
                  onChange={(e) => setHostSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Spectator List — show viewers watching this stream so creator can invite them */}
            <div className="flex-1 overflow-y-auto px-4 pb-3">
              {(() => {
                const spectators = activeViewers.filter(v =>
                  v.id !== user?.id &&
                  !coHosts.some(h => h.userId === v.id) &&
                  (hostSearchQuery.trim() === '' || v.displayName.toLowerCase().includes(hostSearchQuery.trim().toLowerCase()) || v.username.toLowerCase().includes(hostSearchQuery.trim().toLowerCase()))
                );
                const isJoinRequester = (vid: string) => pendingJoinRequest?.requesterId === vid;
                if (spectators.length === 0) {
                  return <div className="text-center text-white/30 text-sm py-8">{activeViewers.length <= 1 ? 'No spectators watching' : 'No spectators match your search'}</div>;
                }
                return (
                  <div className="space-y-0.5">
                    {spectators.map(viewer => {
                      const hostEntry = coHosts.find(h => h.userId === viewer.id);
                      const status = hostEntry?.status;
                      const showJoinReject = (status === ('pending_accept' as any) || isJoinRequester(viewer.id));
                      const rowClassName = 'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors active:scale-[0.98] ' + (showJoinReject ? '' : (!!status || coHosts.length >= MAX_CO_HOSTS ? 'opacity-80' : ''));
                      return (
                        showJoinReject ? (
                          <div key={viewer.id} className={rowClassName}>
                            <div className="relative flex-shrink-0">
                              <AvatarRing src={viewer.avatar} alt={viewer.displayName} size={30} />
                              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-[#1C1E24]" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-white text-xs font-semibold truncate">{viewer.displayName || viewer.username}</p>
                              <p className="text-white/40 text-[10px] truncate">Watching now</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                title="Reject"
                                className="px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30 flex items-center gap-0.5 active:scale-95 transition-transform cursor-pointer"
                                onClick={() => {
                                  if (isJoinRequester(viewer.id)) declineJoinRequest();
                                  else if (hostEntry) {
                                    const nid = (hostEntry as any)._notifId;
                                    removeCoHost(hostEntry.id);
                                    setCoHosts(prev => prev.filter(h => h.userId !== hostEntry.userId));
                                  }
                                }}
                              >
                                <span className="text-red-400 text-[9px] font-bold">Reject</span>
                              </button>
                              <button
                                type="button"
                                title="Join"
                                className="px-2.5 py-1 rounded-full bg-green-500 flex items-center gap-0.5 active:scale-95 transition-transform cursor-pointer"
                                onClick={() => {
                                  if (isJoinRequester(viewer.id)) acceptJoinRequest();
                                  else if (hostEntry) {
                                    const sk = (hostEntry as any)._streamKey;
                                    showToast(`Joining co-host...`);
                                    if (sk) navigate(`/live/${sk}?cohost=1`);
                                  }
                                }}
                              >
                                <span className="text-black text-[9px] font-bold">Join</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                        <button
                          key={viewer.id}
                          onClick={() => !status && coHosts.length < MAX_CO_HOSTS && inviteCoHost({ id: viewer.id, name: viewer.displayName || viewer.username, avatar: viewer.avatar })}
                          disabled={!!status || coHosts.length >= MAX_CO_HOSTS}
                          className={rowClassName}
                        >
                          <div className="relative flex-shrink-0">
                            <AvatarRing src={viewer.avatar} alt={viewer.displayName} size={30} />
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-[#1C1E24]" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-white text-xs font-semibold truncate">{viewer.displayName || viewer.username}</p>
                            <p className="text-white/40 text-[10px] truncate">Watching now</p>
                          </div>
                          {status === 'live' ? (
                            <div className="px-2 py-1 rounded-full bg-green-500/20 border border-green-500/40 flex items-center gap-0.5 flex-shrink-0">
                              <Check size={9} className="text-green-400" />
                              <span className="text-green-400 text-[9px] font-bold">Joined</span>
                            </div>
                          ) : status === 'accepted' ? (
                            <div className="px-2 py-1 rounded-full bg-[#C9A96E]/20 border border-[#C9A96E]/40 flex items-center gap-0.5 flex-shrink-0">
                              <span className="text-[#C9A96E] text-[9px] font-bold">Joining...</span>
                            </div>
                          ) : status === 'invited' ? (
                            <div className="px-2 py-1 rounded-full bg-white/5 border border-white/20 flex items-center gap-0.5 flex-shrink-0">
                              <span className="text-white/50 text-[9px] font-bold">Invited</span>
                            </div>
                          ) : (
                            <div className="px-2 py-1 rounded-full bg-[#C9A96E] flex items-center justify-center gap-0.5 flex-shrink-0">
                              <UserPlus size={9} className="text-black shrink-0 flex-shrink-0" strokeWidth={2} />
                              <span className="text-black text-[9px] font-bold">Invite</span>
                            </div>
                          )}
                        </button>
                        )
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
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


      {/* MODALS & OVERLAYS */}
      {isFindCreatorsOpen && (
        <div className="fixed inset-0 z-[99999] flex flex-col justify-end max-w-[480px] mx-auto" style={{ height: '100%' }}>
          <div 
            className="absolute inset-0 bg-black/40 pointer-events-auto" 
            onClick={() => {
              (document.activeElement as HTMLElement)?.blur();
              setIsFindCreatorsOpen(false);
              setCreatorQuery('');
            }}
          />
          <div
            className="bg-[#1C1E24]/95 backdrop-blur-md rounded-t-2xl flex flex-col shadow-2xl border-t border-[#C9A96E]/20 pointer-events-auto w-full relative z-10 overflow-hidden pb-safe"
            style={{ height: 'calc(40vh - 2cm)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>
            {/* Header */}
            <div className="flex items-center px-4 py-2 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#C9A96E]" strokeWidth={1.8} />
                <span className="text-white font-bold text-[13px]">Invite Creators</span>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-1 flex-shrink-0">
              <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-md px-2.5 py-1 border border-white/10">
                <Search className="w-3 h-3 text-white/25" strokeWidth={1.5} />
                <input
                  value={creatorQuery}
                  onChange={(e) => setCreatorQuery(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 bg-transparent outline-none text-white text-[11px] placeholder:text-white/20"
                />
              </div>
            </div>

            {/* Creator list */}
            <div className="flex-1 overflow-y-auto px-2" style={{ scrollbarWidth: 'none' }}>
              <div className="space-y-1 pb-4">
                {creatorsToInvite.length === 0 ? (
                  <p className="text-white/50 text-xs py-4 text-center">No live creators match your search.</p>
                ) : null}
                {creatorsToInvite.map((c) => {
                  const slotStatus = battleSlots.find(s => s.userId === c.id)?.status;
                  const isInvited = slotStatus === 'invited';
                  const isAccepted = slotStatus === 'accepted';
                  const isIncomingBattleInvite = !!(pendingInvite && pendingInvite.hostUserId === c.id);
                  const allFull = battleSlots.every(s => s.status !== 'empty');

                  const handleReject = (ev: React.MouseEvent) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    setBattleSlots(prev => prev.map(s => s.userId === c.id ? { userId: '', name: '', status: 'empty' as const, avatar: '' } : s));
                    if (pendingInvite && pendingInvite.hostUserId === c.id) declineBattleInvite();
                  };
                  const handleJoin = async (ev: React.MouseEvent) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (pendingInvite && pendingInvite.hostUserId === c.id) acceptBattleInvite();
                  };

                  return (
                    <div
                      key={c.id}
                      onClick={() => !slotStatus && !allFull && inviteCreatorToSlot(c.id)}
                      className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors active:scale-[0.98] cursor-pointer ${!!slotStatus || allFull ? 'opacity-70' : ''}`}
                    >
                      <div className="relative flex-shrink-0">
                        <AvatarRing src={c.avatar} alt={c.name} size={30} />
                        {c.isLive && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#1C1E24]" />}
                      </div>
                      <p className="flex-1 text-left text-white text-xs font-semibold truncate min-w-0">{c.name || c.username}</p>

                      {isAccepted ? (
                        <div className="px-2 py-1 rounded-full bg-green-500/20 border border-green-500/40 flex items-center gap-0.5 flex-shrink-0">
                          <Check size={9} className="text-green-400" />
                          <span className="text-green-400 text-[9px] font-bold">Joined</span>
                        </div>
                      ) : isIncomingBattleInvite ? (
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30 flex items-center gap-0.5 active:scale-95 transition-transform cursor-pointer"
                            onClick={handleReject}
                          >
                            <span className="text-red-400 text-[9px] font-bold">Reject</span>
                          </button>
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-full bg-green-500 flex items-center gap-0.5 active:scale-95 transition-transform cursor-pointer"
                            onClick={handleJoin}
                          >
                            <span className="text-black text-[9px] font-bold">Join</span>
                          </button>
                        </div>
                      ) : isInvited ? (
                        <div className="px-2 py-1 rounded-full bg-white/5 border border-white/20 flex items-center gap-0.5 flex-shrink-0">
                          <span className="text-white/50 text-[9px] font-bold">Invited</span>
                        </div>
                      ) : (
                        <div className="px-2 py-1 rounded-full bg-[#C9A96E] flex items-center justify-center gap-0.5 flex-shrink-0">
                          <UserPlus size={9} className="text-black shrink-0 flex-shrink-0" strokeWidth={2} />
                          <span className="text-black text-[9px] font-bold">Invite</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredCreators.length === 0 && (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#13151A] border border-[#C9A96E]/40 flex items-center justify-center mx-auto mb-3">
                      {creatorsLoading ? (
                        <div className="w-5 h-5 border-2 border-[#C9A96E]/40 border-t-transparent rounded-full animate-spin" />
                      ) : creatorsLoadFailed ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      ) : (
                        <Search className="w-5 h-5 text-[#C9A96E]/40" />
                      )}
                    </div>
                    <p className="text-white/40 text-xs font-medium">
                      {creatorsLoading ? 'Loading creators...' : creatorsLoadFailed ? "Couldn't load creators" : creators.some(c => c.isLive) ? 'No creators match your search' : 'No other creators are live right now. When someone else goes live, they\'ll appear here so you can invite them.'}
                    </p>
                    {creatorsLoadFailed && (
                      <button type="button" onClick={() => loadCreators()} className="mt-2 px-3 py-1.5 rounded-lg bg-[#C9A96E]/20 border border-[#C9A96E]/40 text-[#C9A96E] text-[10px] font-bold active:scale-95">
                        Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Start Match Button */}
            {battleSlots.some(s => s.status === 'accepted') && (
              <div className="px-4 py-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsFindCreatorsOpen(false);
                    const accepted = battleSlots.find(s => s.status === 'accepted');
                    websocket.send('battle_create', {
                      hostName: myCreatorName,
                      opponentUserId: accepted?.userId ?? '',
                      opponentName: accepted?.name ?? 'Opponent',
                    });
                  }}
                  className="w-full py-2.5 bg-[#C9A96E] text-black text-xs font-bold rounded-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Sword size={14} />
                  <span>Start Match</span>
                </button>
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
                    <AvatarRing src={typeof miniProfile.avatar === 'string' ? miniProfile.avatar : ''} alt={typeof miniProfile.username === 'string' ? miniProfile.username : 'User'} size={80} />
                  </div>
                  <div className="min-w-0 pt-1">
                    <div className="text-white font-black text-[16px] truncate">{typeof miniProfile.username === 'string' ? miniProfile.username : 'User'}</div>
                    <div className="text-white/70 text-[12px] font-bold">
                      {typeof miniProfile.level === 'number' ? (
                        <span className="inline-flex items-center gap-2">
                          <LevelBadge level={miniProfile.level} size={16} layout="fixed" avatar={miniProfile.avatar} />
                          <span>Level {miniProfile.level}</span>
                        </span>
                      ) : (
                        'Level —'
                      )}
                      {miniProfile.coins != null ? ` • 🪙 ${formatCoinsShort(miniProfile.coins)}` : ''}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-white/50">
                      <div className="flex items-center gap-1">
                        <span className="text-white font-bold tabular-nums">{formatCountShort(miniProfile.followers_count ?? 0)}</span>
                        <span>Followers</span>
                      </div>
                      <div className="w-px h-2 bg-white/20" />
                      <div className="flex items-center gap-1">
                        <span className="text-white font-bold tabular-nums">{formatCountShort(miniProfile.following_count ?? 0)}</span>
                        <span>Following</span>
                      </div>
                    </div>

                    {miniProfile.bio && (
                      <div className="mt-2 text-[11px] text-white/80 leading-snug line-clamp-2">
                        {miniProfile.bio}
                      </div>
                    )}

                    {miniProfile.donated != null && miniProfile.donated > 0 && (
                      <div className="text-white text-[11px] font-bold mt-2 pt-2 border-t border-white/10">
                        Donated: {formatCoinsShort(miniProfile.donated)} coins
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-4 gap-2">
                <button type="button" onClick={async () => {
                  if (!user?.id || !miniProfile?.id) return;
                  try {
                    const authToken = useAuthStore.getState().session?.access_token;
                    await fetch(apiUrl(`/api/profiles/${miniProfile.id}/follow`), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
                    });
                    setIsFollowing(true);
                    closeMiniProfile();
                  } catch {}
                }} className="h-9 rounded-lg bg-[#C9A96E] text-black text-[11px] font-black hover:bg-[#C9A96E]/90 active:scale-95 transition-all">
                  Follow
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    closeMiniProfile();
                    navigate(`/profile/${miniProfile.id ?? miniProfile.username}`);
                  }}
                  className="h-9 rounded-lg bg-white/10 text-white text-[11px] font-bold hover:bg-white/20 active:scale-95 transition-all"
                >
                  Profile
                </button>
                <button type="button" onClick={handleShare} className="h-9 rounded-lg bg-white/10 text-white text-[11px] font-bold hover:bg-white/20 active:scale-95 transition-all">
                  Share
                </button>
              </div>
              {/* Moderator actions — only creator and mods see these */}
              {(isBroadcast || (miniProfile?.id && moderators.has(user?.id || ''))) && miniProfile?.id && miniProfile.id !== user?.id && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {isBroadcast && (
                    <button type="button" onClick={() => {
                      if (!miniProfile?.id) return;
                      setModerators(prev => {
                        const next = new Set(prev);
                        if (next.has(miniProfile.id!)) { next.delete(miniProfile.id!); showToast(`@${miniProfile.username} removed as moderator`); }
                        else { next.add(miniProfile.id!); showToast(`@${miniProfile.username} is now a moderator`); }
                        return next;
                      });
                      closeMiniProfile();
                    }} className={`h-9 rounded-lg text-[11px] font-bold active:scale-95 transition-all ${miniProfile?.id && moderators.has(miniProfile.id) ? 'bg-purple-950/50 text-purple-400 border border-purple-900/50' : 'bg-purple-600 text-white'}`}>
                      {miniProfile?.id && moderators.has(miniProfile.id) ? 'Remove Mod' : 'Make Mod'}
                    </button>
                  )}
                  <button type="button" onClick={async () => {
                    if (!user?.id || !miniProfile?.id) return;
                    try {
                      const authToken = useAuthStore.getState().session?.access_token;
                      await fetch(apiUrl('/api/block-user'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
                        body: JSON.stringify({ blockedId: miniProfile.id }),
                      });
                      showToast(`@${miniProfile.username} blocked`);
                      closeMiniProfile();
                    } catch {}
                  }} className="h-9 rounded-lg bg-red-950/50 text-red-400 text-[11px] font-bold border border-red-900/50 hover:bg-red-900/50 active:scale-95 transition-all">
                    Block
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ VIEWER LIST PANEL (spectators only — no Join/Reject; use Invite Co-Host panel) ═══ */}
      {showViewerList && (
        <>
          <div
            className="fixed inset-0 bg-black/40 pointer-events-auto"
            style={{ zIndex: 99998 }}
            onClick={() => setShowViewerList(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[999999] pointer-events-auto max-w-[480px] mx-auto">
            <div className="bg-[#1C1E24]/95 backdrop-blur-md rounded-t-2xl h-[40vh] flex flex-col shadow-2xl border-t border-[#C9A96E]/20 overflow-hidden">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-4 pb-2">
                <h3 className="text-white font-bold text-sm">Spectators</h3>
                <div className="flex items-center gap-1">
                  <Users size={12} className="text-white/50" />
                  <span className="text-white/60 text-xs font-semibold">{formatCountShort(viewerCount)}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4">
                {activeViewers.length > 0 ? (
                  activeViewers.map((v, i) => (
                    <button
                      key={v.id}
                      type="button"
                      className="flex items-center gap-3 w-full py-2.5 active:bg-white/5 rounded-xl transition-colors"
                      onClick={() => { openMiniProfile(v.displayName); setShowViewerList(false); }}
                    >
                      <span className="text-white/30 text-xs font-bold w-5 text-right">{i + 1}</span>
                      <div className="w-10 h-10 rounded-full border-2 border-[#C9A96E]/30 overflow-hidden bg-[#13151A] flex-shrink-0">
                        {v.avatar ? (
                          <img src={v.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-[#C9A96E] font-bold text-sm">{v.displayName.slice(0, 1).toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-white text-sm font-semibold truncate">{v.displayName}</p>
                        <p className="text-white/40 text-[10px] font-medium">Level {v.level}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Users className="w-7 h-7 text-white/10 mb-2" />
                    <p className="text-white/50 text-sm">No spectators yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
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
            className="fixed inset-0 bg-black/40 pointer-events-auto" 
            style={{ zIndex: 99998 }}
            onClick={() => setShowTeamStatus(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 h-[40vh] z-[99999] pointer-events-auto max-w-[480px] mx-auto">
          <div
            className="bg-[#1C1E24]/95 backdrop-blur-md rounded-t-2xl p-3 pb-safe h-full flex flex-col shadow-2xl w-full overflow-hidden border-t border-[#C9A96E]/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Heart className="w-3 h-3 text-[#C9A96E]" strokeWidth={2} fill="#C9A96E" />
                <span className="text-gold-metallic font-bold text-sm">Your Team Status</span>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 no-scrollbar min-h-0">
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
            className="fixed inset-0 bg-black/40 pointer-events-auto" 
            style={{ zIndex: 99998 }}
            onClick={() => setShowFanClub(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[99999] pointer-events-auto max-w-[480px] mx-auto">
          <div
            className="bg-[#1C1E24]/95 rounded-t-2xl p-3 pb-safe max-h-[40vh] overflow-y-auto no-scrollbar shadow-2xl w-full"
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
                    <p className="text-[8px] text-white/30 text-center mt-1.5">Non-refundable. Cancel anytime in store settings.</p>
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
            className="fixed inset-0 bg-black/40 pointer-events-auto" 
            style={{ zIndex: 99998 }}
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[99999] pointer-events-auto max-w-[480px] mx-auto"
          >
          <div
            className="bg-[#1C1E24]/95 rounded-t-2xl p-3 pb-safe h-[40vh] overflow-y-auto no-scrollbar shadow-2xl w-full border-t border-[#C9A96E]/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center mb-2">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Content — luxury compact grid */}
            <div className="grid grid-cols-4 gap-y-4 gap-x-2 pt-1 pb-2 px-1">

              {!IS_STORE_BUILD && (
              <button type="button" onClick={() => { setShowTestCoinsModal(true); setTestCoinsStep(sessionStorage.getItem('elix_test_coins_unlocked') ? 'amount' : 'password'); setTestCoinsPwd(''); setTestCoinsError(''); setTestCoinsAmount(''); setIsMoreMenuOpen(false); }} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                <div className="w-11 h-11 rounded-full relative flex items-center justify-center">
                  <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1]" />
                  <Coins className="w-[18px] h-[18px] text-[#C9A96E] relative z-[2]" strokeWidth={1.8} />
                </div>
                <span className="text-[10px] font-semibold text-white/70">Test</span>
              </button>
              )}

              <button type="button" onClick={() => { setShowSharePanel(true); setIsMoreMenuOpen(false); }} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                <div className="w-11 h-11 rounded-full relative flex items-center justify-center">
                  <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1]" />
                  <Share2 className="w-[18px] h-[18px] text-[#C9A96E] relative z-[2]" strokeWidth={1.8} />
                </div>
                <span className="text-[10px] font-semibold text-white/70">Share</span>
              </button>

              <button type="button" disabled={!isBroadcast} onClick={() => { flipCamera(); setIsMoreMenuOpen(false); }} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40">
                <div className="w-11 h-11 rounded-full relative flex items-center justify-center">
                  <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1]" />
                  <RefreshCw className="w-[18px] h-[18px] text-[#C9A96E] relative z-[2]" strokeWidth={1.8} />
                </div>
                <span className="text-[10px] font-semibold text-white/70">Flip</span>
              </button>

              <button type="button" disabled={!isBroadcast} onClick={() => { toggleMic(); setIsMoreMenuOpen(false); }} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40">
                <div className="w-11 h-11 rounded-full relative flex items-center justify-center">
                  <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1]" />
                  {isMicMuted ? <MicOff className="w-[18px] h-[18px] text-[#C9A96E] relative z-[2]" strokeWidth={1.8} /> : <Mic className="w-[18px] h-[18px] text-[#C9A96E] relative z-[2]" strokeWidth={1.8} />}
                </div>
                <span className="text-[10px] font-semibold text-white/70">{isMicMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button type="button" disabled={!isBroadcast} onClick={() => { toggleCam(); setIsMoreMenuOpen(false); }} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40">
                <div className="w-11 h-11 rounded-full relative flex items-center justify-center">
                  <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1]" />
                  {isCamOff ? <CameraOff className="w-[18px] h-[18px] text-red-400 relative z-[2]" strokeWidth={1.8} /> : <Camera className="w-[18px] h-[18px] text-[#C9A96E] relative z-[2]" strokeWidth={1.8} />}
                </div>
                <span className="text-[10px] font-semibold text-white/70">{isCamOff ? 'Cam On' : 'Cam Off'}</span>
              </button>

              <button type="button" onClick={() => { setIsChatVisible((v) => !v); setIsMoreMenuOpen(false); }} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                <div className="w-11 h-11 rounded-full relative flex items-center justify-center">
                  <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1]" />
                  <MessageCircle className="w-[18px] h-[18px] text-[#C9A96E] relative z-[2]" strokeWidth={1.8} />
                </div>
                <span className="text-[10px] font-semibold text-white/70">{isChatVisible ? 'Hide Chat' : 'Show Chat'}</span>
              </button>

              <button type="button" onClick={() => { setIsReportModalOpen(true); setIsMoreMenuOpen(false); }} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                <div className="w-11 h-11 rounded-full relative flex items-center justify-center">
                  <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1]" />
                  <Flag className="w-[18px] h-[18px] text-red-400 relative z-[2]" strokeWidth={1.8} />
                </div>
                <span className="text-[10px] font-semibold text-red-400/70">Report</span>
              </button>

              {isBattleMode && battleWinner && isBroadcast && (
                <button type="button" onClick={() => { if (battleSlots[0]?.userId) { websocket.send('battle_create', { hostName: myCreatorName, opponentUserId: battleSlots[0].userId, opponentName: battleSlots[0].name }); } setBattleTime(300); setMyScore(0); setOpponentScore(0); setPlayer3Score(0); setPlayer4Score(0); setBattleWinner(null); setBattleCountdown(null); reachedThresholdsRef.current.clear(); setIsMoreMenuOpen(false); }} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                  <div className="w-11 h-11 rounded-full relative flex items-center justify-center">
                    <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1]" />
                    <RefreshCw className="w-[18px] h-[18px] text-[#C9A96E] relative z-[2]" strokeWidth={1.8} />
                  </div>
                  <span className="text-[10px] font-semibold text-white/70">Rematch</span>
                </button>
              )}

              {isBattleMode && isBroadcast && !battleWinner && battleTime > 0 && (
                <button type="button" onClick={() => { startSpeedChallenge(); setIsMoreMenuOpen(false); }} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                  <div className="w-11 h-11 rounded-full relative flex items-center justify-center">
                    <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1]" />
                    <Zap className="w-[18px] h-[18px] text-[#C9A96E] relative z-[2]" strokeWidth={1.8} />
                  </div>
                  <span className="text-[10px] font-semibold text-white/70">Speed</span>
                </button>
              )}

            </div>
          </div>
          </div>
        </>
      )}

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
                        // Fallback: simple comparison for non-secure contexts
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
                      const authToken = useAuthStore.getState().session?.access_token;
                      fetch(apiUrl('/api/test-coins'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
                        body: JSON.stringify({ amount }),
                      }).catch(() => {});
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
                    min="1"
                    max="100000000"
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
                          const authToken = useAuthStore.getState().session?.access_token;
                          fetch(apiUrl('/api/test-coins'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
                            body: JSON.stringify({ amount }),
                          }).catch(() => {});
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


      {/* Full-screen Gift Overlay Animation */}
      <GiftAnimationOverlay streamId={effectiveStreamId} />

      {/* Full-screen Video Effect Overlay (Behind controls but above video) */}
      <GiftOverlay 
        videoSrc={currentGift?.video ?? null}
        previewSrc={currentGift?.preview ?? null}
        onEnded={handleGiftEnded} 
        isBattleMode={isBattleMode}
      />
      
      {/* ═══ SHARE PANEL ═══ */}
      {showSharePanel && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 pointer-events-auto" 
            style={{ zIndex: 99998 }}
            onClick={() => setShowSharePanel(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[99999] pointer-events-auto max-w-[480px] mx-auto">
          <div className="bg-[#1C1E24]/95 backdrop-blur-md rounded-t-2xl p-3 pb-safe flex flex-col shadow-2xl w-full h-[40vh] overflow-hidden border-t border-[#C9A96E]/20">
            <div className="flex justify-center pt-1 pb-2">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Create + Followers row — Create first, then people to share to */}
            <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-3 flex-shrink-0 px-4 no-scrollbar" style={{ marginLeft: '-2mm' }}>
              <button
                type="button"
                onClick={() => { navigate('/create'); setShowSharePanel(false); }}
                className="flex flex-col items-center gap-1.5 min-w-[80px] active:scale-95 transition-transform flex-shrink-0"
              >
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <img src="/Icons/Profile icon.png" alt="" className="w-full h-full object-contain" />
                  <Plus size={28} className="text-[#C9A96E] absolute" strokeWidth={2.5} />
                </div>
                <span className="text-white/80 text-[11px] font-medium">Create</span>
              </button>
              {shareFollowers.filter(f => f.username?.toLowerCase().includes(shareQuery.toLowerCase())).map((f) => (
                <button
                  key={f.user_id}
                  className="flex flex-col items-center gap-1 min-w-[64px] active:scale-95 transition-transform"
                  style={{ marginTop: '6mm' }}
                  onClick={() => sendShareToFollower(f.user_id)}
                >
                  <AvatarRing src={f.avatar_url || '/Icons/Profile icon.png'} alt={f.username} size={56} />
                  <span className="text-white/60 text-[10px] font-medium truncate w-16 text-center">{shareSentTo.has(f.user_id) ? 'Sent' : f.username || 'User'}</span>
                </button>
              ))}
            </div>

            {/* Share options — same layout as ShareModal */}
            <div className="flex-1 overflow-y-scroll overflow-x-hidden min-h-0 px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:bg-[#C9A96E]/60 [&::-webkit-scrollbar-thumb]:rounded-full">
              <div className="grid grid-cols-5 gap-y-3 gap-x-1.5 pt-1">
                {[
                  { name: 'WhatsApp', icon: <MessageCircle size={22} className="text-white" />, action: () => { window.open(`https://wa.me/?text=${encodeURIComponent('Watch my LIVE on Elix! ' + window.location.href)}`); setShowSharePanel(false); } },
                  { name: 'Facebook', icon: <Share2 size={22} className="text-white" />, action: () => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`); setShowSharePanel(false); } },
                  { name: 'Copy Link', icon: <Copy size={22} className="text-white" />, action: () => { navigator.clipboard.writeText(`https://www.elixlive.co.uk/live/${effectiveStreamId}`); showToast('Link copied!'); setShowSharePanel(false); } },
                  { name: 'Promote', icon: <TrendingUp size={22} className="text-white" />, action: () => { setShowSharePanel(false); setShowPromotePanel(true); } },
                  { name: 'Report', icon: <Flag size={22} className="text-red-400" />, isRed: true, action: () => { setIsReportModalOpen(true); setShowSharePanel(false); } },
                  { name: 'Story', icon: <PlusCircle size={22} className="text-white" />, action: () => { navigate('/create'); setShowSharePanel(false); } },
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
          title: `Watch ${myCreatorName}'s LIVE on Elix!`,
          thumbnail: myAvatar,
          username: myCreatorName,
          avatar: myAvatar,
          postedAt: new Date().toLocaleDateString(),
        }}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        videoId={effectiveStreamId || ''}
        contentType="live"
      />

      {/* Battle invite modal: invitee always sees Join/Reject without opening any panel */}
      {pendingInvite && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/80 max-w-[480px] mx-auto">
          <div className="bg-[#1C1E24] border border-[#C9A96E]/40 rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <AvatarRing src={pendingInvite.hostAvatar} alt={pendingInvite.hostName} size={48} />
              <div className="flex-1 min-w-0">
                <p className="text-white/60 text-xs font-medium">Battle invite</p>
                <p className="text-white font-semibold truncate">{pendingInvite.hostName}</p>
              </div>
            </div>
            <p className="text-white/70 text-sm mb-5">invited you to a battle.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { declineBattleInvite(); }}
                className="flex-1 py-2.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-semibold text-sm active:scale-[0.98]"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => { acceptBattleInvite(); }}
                className="flex-1 py-2.5 rounded-lg bg-[#C9A96E] text-black font-semibold text-sm active:scale-[0.98]"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Moderation warning (AI flag + assist; first detection only) */}
      {showModerationWarning && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70" onClick={() => { setShowModerationWarning(false); setModerationWarningMessage(''); }}>
          <div className="bg-[#1C1E24] border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" />
              <h3 className="font-semibold text-white">Safety reminder</h3>
            </div>
            <p className="text-white/80 text-sm mb-4">{moderationWarningMessage}</p>
            <button
              type="button"
              onClick={() => { setShowModerationWarning(false); setModerationWarningMessage(''); }}
              className="w-full py-2.5 rounded-lg bg-[#C9A96E] text-black font-semibold"
            >
              OK
            </button>
          </div>
        </div>
      )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
