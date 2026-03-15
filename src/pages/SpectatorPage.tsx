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
import { GIFTS, resolveGiftAssetUrl } from '../lib/gifts';
import { GiftOverlay } from '../components/GiftOverlay';
import GiftAnimationOverlay from '../components/GiftAnimationOverlay';
import { ChatOverlay } from '../components/ChatOverlay';
import { AvatarRing } from '../components/AvatarRing';
import { useAuthStore } from '../store/useAuthStore';
import { apiUrl, getLiveKitUrl } from '../lib/api';
import { apiStub } from '../lib/apiStub';
import ReportModal from '../components/ReportModal';
import PromotePanel from '../components/PromotePanel';
import { RankingPanel } from '../components/RankingPanel';
import { websocket } from '../lib/websocket';
import { IS_STORE_BUILD } from '../config/build';
import { Room, RoomEvent } from 'livekit-client';

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

type SpectatorCoHostSlot = { id: string; userId: string; name: string; avatar: string; status: string };

function SpectatorCoHostGrid({
  spectatorCoHosts,
  coHostVideoRefs,
  hostName,
}: {
  spectatorCoHosts: SpectatorCoHostSlot[];
  coHostVideoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  hostName: string;
}) {
  const live = spectatorCoHosts.filter((h) => h.status === 'live' || h.status === 'accepted');
  const invited = spectatorCoHosts.filter((h) => h.status === 'invited' || h.status === 'pending_accept');
  const firstLive = live[0];
  const restLive = live.slice(1);
  const smallSlots: { type: 'live' | 'invited' | 'empty'; host?: SpectatorCoHostSlot }[] = [
    ...restLive.map((h) => ({ type: 'live' as const, host: h })),
    ...invited.map((h) => ({ type: 'invited' as const, host: h })),
  ];
  while (smallSlots.length < 8) smallSlots.push({ type: 'empty' });

  const setRef = (userId: string, el: HTMLVideoElement | null) => {
    if (el) coHostVideoRefs.current.set(userId, el);
  };

  const renderCell = (slot: { type: string; host?: SpectatorCoHostSlot }, isBig: boolean) => {
    if (slot.type === 'live' && slot.host) {
      const host = slot.host;
      return (
        <>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#13151A] z-0 rounded-sm pointer-events-none">
            {host.avatar ? (
              <img src={host.avatar} alt="" className={`rounded-full border-2 border-[#C9A96E]/40 object-cover opacity-80 ${isBig ? 'w-16 h-16' : 'w-10 h-10'}`} />
            ) : (
              <div className={`rounded-full border-2 border-[#C9A96E]/40 bg-[#1C1E24] flex items-center justify-center ${isBig ? 'w-16 h-16' : 'w-10 h-10'}`}>
                <span className="text-[#C9A96E]/60 text-sm font-bold">{(host.name || '?').charAt(0)}</span>
              </div>
            )}
            <span className="text-white/70 text-[8px] font-bold truncate max-w-full px-1">{host.name}</span>
          </div>
          <video
            ref={(el) => setRef(host.userId, el)}
            className="absolute inset-0 w-full h-full object-cover rounded-sm z-[1]"
            autoPlay
            playsInline
            muted
          />
          <div className="absolute bottom-0 left-0 right-0 z-10 px-1.5 py-0.5 rounded-b-sm bg-black/60 backdrop-blur-sm pointer-events-none">
            <span className="text-white text-[9px] font-bold truncate">{host.name}</span>
          </div>
        </>
      );
    }
    if (slot.type === 'invited' && slot.host) {
      const host = slot.host;
      return (
        <>
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#C9A96E]/40 bg-[#1C1E24]">
            {host.avatar ? (
              <img src={host.avatar} alt="" className="w-full h-full object-cover opacity-60" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#C9A96E]/60 text-base font-bold">{(host.name || '?').charAt(0)}</div>
            )}
          </div>
          <p className="text-white/60 text-[9px] font-bold mt-0.5 truncate max-w-[95%] text-center">{host.name}</p>
          <span className="text-[#C9A96E]/70 text-[8px] font-semibold">Invited</span>
        </>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
          <span className="text-white/30 text-2xl font-light">+</span>
        </div>
        <p className="text-white/30 text-[9px] font-semibold mt-0.5">Slot</p>
      </div>
    );
  };

  if (firstLive) {
    return (
      <div className="w-1/2 h-full flex flex-col min-w-0">
        <div className="flex-1 min-h-0 relative bg-[#13151A]">
          <div className="absolute inset-0 flex flex-col items-center justify-center p-0.5">
            {renderCell({ type: 'live', host: firstLive }, true)}
          </div>
        </div>
        {(restLive.length > 0 || invited.length > 0) && (
          <div className="flex-[0_0_auto] grid grid-cols-4 grid-rows-2 gap-[1px] bg-[#1a1c22]" style={{ maxHeight: '35%' }}>
            {smallSlots.slice(0, 8).map((slot, i) => (
              <div key={i} className="relative bg-[#13151A] flex flex-col items-center justify-center p-0.5">
                {renderCell(slot, false)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-1/2 h-full grid grid-cols-2 grid-rows-4 gap-[1px] bg-[#1a1c22]">
      {smallSlots.slice(0, 8).map((slot, i) => (
        <div key={i} className="relative bg-[#13151A] flex flex-col items-center justify-center p-1">
          {renderCell(slot, false)}
        </div>
      ))}
    </div>
  );
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
  const [streamRetryKey, setStreamRetryKey] = useState(0);
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
  const [currentGift, setCurrentGift] = useState<{video: string} | null>(null);
  const [giftQueue, setGiftQueue] = useState<{video: string}[]>([]);
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
  const [spectatorBattle, setSpectatorBattle] = useState<{ active: boolean; hostScore: number; opponentScore: number; timeLeft: number; opponentName?: string; winner?: string } | null>(null);

  // ═══════════════════════════════════════════════════
  // CO-HOST STATE (synced from host so spectators see same layout)
  // ═══════════════════════════════════════════════════
  type SpectatorCoHost = { id: string; userId: string; name: string; avatar: string; status: string };
  const [spectatorCoHosts, setSpectatorCoHosts] = useState<SpectatorCoHost[]>([]);
  const coHostVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const [isCoHosting, setIsCoHosting] = useState(false);
  const [coHostStream, setCoHostStream] = useState<MediaStream | null>(null);
  const coHostChanRef = useRef<ReturnType<typeof apiStub.channel> | null>(null);
  const [pendingCoHostInvite, setPendingCoHostInvite] = useState<{ notifId: string; hostName: string; hostAvatar: string; streamKey: string; hostUserId: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    // Cohost invite uses explicit navigation / WebSocket.
    return () => {};
  }, [user?.id]);
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [isCamOff, setIsCamOff] = useState(false);

  const isCoHostFromUrl = new URLSearchParams(location.search).get('cohost') === '1';

  // Spectators should not create their own co-host layout; co-hosting is controlled by the creator's room.
  // We intentionally do NOT auto-start co-hosting on ?cohost=1 for the spectator route.
  useEffect(() => {
    // #region agent log
    if (isCoHostFromUrl) {
      fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'SpectatorPage.tsx:cohostQueryIgnored',
          message: 'spectator-cohost-query-param-ignored',
          data: { pathname: location.pathname, streamId: effectiveStreamId?.slice(0, 20) },
          timestamp: Date.now(),
          runId: 'spectator-cohost-fix',
          hypothesisId: 'H-cohost-dup',
        }),
      }).catch(() => {});
    }
    // #endregion
  }, [isCoHostFromUrl, effectiveStreamId, location.pathname]);

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
      apiStub.removeChannel(coHostChanRef.current);
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

  // Video ref for live stream (LiveKit)
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStream, setHasStream] = useState(false);
  const [liveConnectRetryKey, setLiveConnectRetryKey] = useState(0);
  const retryJoinRoom = () => {
    setHasStream(false);
    setLiveConnectRetryKey((k) => k + 1);
  };
  const [showRetryButton, setShowRetryButton] = useState(false);
  useEffect(() => {
    if (hasStream) { setShowRetryButton(false); return; }
    const t = setTimeout(() => { if (!hasStream) setShowRetryButton(true); }, 10000);
    return () => clearTimeout(t);
  }, [hasStream]);

  // Fetch host / stream state from backend
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'spectator-mount', data: { effectiveStreamId, hasUser: Boolean(user?.id), userId: user?.id?.slice(0, 8), pathname: location.pathname }, timestamp: Date.now(), hypothesisId: 'H8' }) }).catch(() => {});
    // #endregion
    if (!effectiveStreamId) return;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/live/streams'), { method: 'GET', credentials: 'include' });
        if (!res.ok) {
          setStreamIsLive(false);
          showToast('Stream is offline');
          return;
        }

        const json = await res.json();
        const streams = Array.isArray(json.streams) ? json.streams : [];
        const stream =
          streams.find((s: any) => s.stream_key === effectiveStreamId) ||
          streams.find((s: any) => s.room_id === effectiveStreamId);

        if (!stream) {
          setStreamIsLive(false);
          showToast('Stream is offline');
          return;
        }

        setStreamIsLive(true);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'spectator-stream-found', data: { streamKey: stream.stream_key, userId: stream.user_id, viewerCount: stream.viewer_count, totalStreams: streams.length }, timestamp: Date.now(), hypothesisId: 'H9' }) }).catch(() => {});
        // #endregion
        if (stream.user_id) {
          const uid = String(stream.user_id);
          setHostUserId(uid);
          hostUserIdRef.current = uid;
          actualViewersRef.current.delete(uid);
          setViewerCount(stream.viewer_count || 0);

          // First guess: title from live stream or short id label
          const label = uid.slice(0, 8);
          const initialName = stream.title || label || 'Creator';
          setHostName(initialName);
          setHostAvatar('');

          // Try to match Live page exactly by loading creator profile
          // (same source as the creator page uses for display name / avatar).
          try {
            const profileRes = await fetch(apiUrl(`/api/profiles/${encodeURIComponent(uid)}`), {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            });
            if (profileRes.ok) {
              const body = await profileRes.json().catch(() => ({}));
              const profile = body?.profile || body?.data || {};
              const profileName =
                (typeof profile.displayName === 'string' && profile.displayName.trim()) ||
                (typeof profile.username === 'string' && profile.username.trim()) ||
                initialName;
              const profileAvatar =
                (typeof profile.avatarUrl === 'string' && profile.avatarUrl.trim()) || '';
              setHostName(profileName);
              if (profileAvatar) setHostAvatar(profileAvatar);
            }
          } catch {
            // Non-fatal: keep initialName/empty avatar
          }
        }
      } catch {
        setStreamIsLive(false);
        showToast('Stream is offline');
      }
    })();
  }, [effectiveStreamId, navigate, streamRetryKey]);

  // LiveKit: connect as viewer and attach host video to videoRef
  const liveKitRoomRef = useRef<Room | null>(null);
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'spectator-livekit-guard', data: { streamIsLive, effectiveStreamId: effectiveStreamId?.slice(0, 12), hasUserId: Boolean(user?.id), retryKey: liveConnectRetryKey }, timestamp: Date.now(), hypothesisId: 'H8' }) }).catch(() => {});
    // #endregion
    if (!streamIsLive || !effectiveStreamId || !user?.id) return;

    let mounted = true;
    const room = new Room({ adaptiveStream: true });
    liveKitRoomRef.current = room;

    (async () => {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'spectator-livekit-start', data: { streamId: effectiveStreamId, userId: user?.id }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
        // #endregion
        const res = await fetch(apiUrl(`/api/live/token?room=${encodeURIComponent(effectiveStreamId)}`), { method: 'GET', credentials: 'include' });
        if (!res.ok || !mounted) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'spectator-token-fail', data: { status: res.status, mounted }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
          // #endregion
          if (res.status === 401) showToast('Please log in to watch');
          else if (res.status === 503) showToast('Live video is not configured on server');
          return;
        }
        const data = await res.json();
        let url = (data?.url ?? '').trim();
        if (!url) url = getLiveKitUrl();
        const token = data?.token;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'spectator-token-ok', data: { hasUrl: Boolean(url), urlPrefix: url?.slice(0, 30), hasToken: Boolean(token), tokenLen: token?.length || 0 }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
        // #endregion
        if (!url || !token || !mounted) {
          showToast('Missing LiveKit URL. Set LIVEKIT_URL on server.');
          return;
        }

        const hostId = hostUserIdRef.current || effectiveStreamId;
        const onTrackSubscribed = (track: import('livekit-client').RemoteTrack, publication?: import('livekit-client').TrackPublication, participant?: import('livekit-client').RemoteParticipant) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'spectator-track-subscribed', data: { kind: track.kind }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
          // #endregion
          if (!mounted) return;
          if (track.kind === 'audio') {
            track.attach();
            return;
          }
          if (track.kind === 'video' && participant) {
            const identity = participant.identity || '';
            const isHost = identity === hostId || identity === effectiveStreamId;
            if (isHost && videoRef.current) {
              track.attach(videoRef.current);
              setHasStream(true);
            } else {
              const el = coHostVideoRefs.current.get(identity);
              if (el) track.attach(el);
              else setHasStream(true);
            }
          }
        };

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          onTrackSubscribed(track, publication, participant);
        });
        await room.connect(url, token);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'spectator-room-connected', data: { remoteParticipants: room.remoteParticipants.size }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
        // #endregion
        if (!mounted) {
          room.disconnect();
          return;
        }
        for (const [, participant] of room.remoteParticipants) {
          const identity = participant.identity || '';
          const isHost = identity === hostId || identity === effectiveStreamId;
          for (const [, publication] of participant.videoTrackPublications) {
            if (publication.track && publication.isSubscribed) {
              if (isHost && videoRef.current) {
                publication.track.attach(videoRef.current);
                setHasStream(true);
              } else {
                const el = coHostVideoRefs.current.get(identity);
                if (el) publication.track.attach(el);
                else setHasStream(true);
              }
            }
          }
          for (const [, publication] of participant.audioTrackPublications) {
            if (publication.track && publication.isSubscribed) publication.track.attach();
          }
        }
      } catch (err) {
        if (mounted) {
          setHasStream(false);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'spectator-livekit-error', data: { error: String(err), stack: (err as Error)?.stack?.slice(0, 300) }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
          // #endregion
          console.error('[LiveKit] Viewer connect failed:', err);
          showToast('Could not connect to stream. Is the host live?');
        }
      }
    })();

    return () => {
      mounted = false;
      liveKitRoomRef.current = null;
      room.disconnect();
    };
  }, [streamIsLive, effectiveStreamId, user?.id, liveConnectRetryKey]);

  // If we're still "connecting" after 18s, hint that host may not be publishing
  useEffect(() => {
    if (!streamIsLive || hasStream) return;
    const t = setTimeout(() => {
      showToast('Stream not loading? Make sure the host is live and try again.');
    }, 18000);
    return () => clearTimeout(t);
  }, [streamIsLive, hasStream]);

  // Load user profile (coins, level, XP)
  // Note: Without a database, we use persisted test coins and user data
  useEffect(() => {
    if (!user?.id) return;
    
    const persisted = getPersistedTestCoinsBalance(user.id);
    setCoinBalance(Math.max(0, persisted));
    setUserLevel(user.level || 1);
    setUserXP(0);
  }, [user?.id, user?.level]);

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
      apiStub
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
      const { data: session } = await apiStub.auth.getSession();
      if (!user?.id) {
        navigate('/login');
        return;
      }
      const res = await fetch(apiUrl('/api/create-subscription'), {
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

    // Viewer count from WebSocket/backend events.
    return () => {};
  }, [effectiveStreamId, navigate]);

  // WebSocket: connect to room for real-time chat, gifts, join/leave
  // Only connect after stream is verified live — avoids reconnect loop from racing with stream fetch
  useEffect(() => {
    if (!effectiveStreamId || !user?.id || !streamIsLive) return;

    let mounted = true;

    const connect = async () => {
      const token = useAuthStore.getState().session?.access_token || '';
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
        if (giftDef.video && giftDef.video.trim()) {
          const raw = giftDef.video;
          const videoUrl =
            raw.startsWith('http://') || raw.startsWith('https://')
              ? raw
              : resolveGiftAssetUrl(raw.startsWith('/') ? raw : `/${raw}`);
          setGiftQueue(prev => [...prev, { video: videoUrl }]);
        }
      }
    };

    const handleStreamEnded = (data?: any) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpectatorPage.tsx:handleStreamEnded',message:'stream-ended-event',data:{effectiveStreamId,reason:data?.reason||null,hostUserId:data?.host_user_id||null},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion

      if (!mounted) return;
      setStreamEndedReceived(true);
      setStreamIsLive(false);
      websocket.disconnect();
      setTimeout(() => { if (mounted) navigate('/feed', { replace: true }); }, 2000);
    };

    const handleBattleStateSync = (data: any) => {
      if (!mounted) return;
      if (data.status === 'active' || data.status === 'IN_BATTLE') {
        setSpectatorBattle(prev => ({
          active: true,
          hostScore: prev?.hostScore || 0,
          opponentScore: prev?.opponentScore || 0,
          timeLeft: prev?.timeLeft || 300,
          opponentName: data.opponentName || data.opponent_name || prev?.opponentName,
        }));
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
      } : null);
    };

    const handleBattleScore = (data: any) => {
      if (!mounted) return;
      setSpectatorBattle(prev => prev ? {
        ...prev,
        hostScore: data.hostScore ?? prev.hostScore,
        opponentScore: data.opponentScore ?? prev.opponentScore,
      } : null);
    };

    const handleBattleEnded = (data: any) => {
      if (!mounted) return;
      setSpectatorBattle(prev => prev ? {
        ...prev,
        active: false,
        hostScore: data.hostScore ?? prev.hostScore,
        opponentScore: data.opponentScore ?? prev.opponentScore,
        winner: data.winner || (data.hostScore > data.opponentScore ? 'host' : data.hostScore < data.opponentScore ? 'opponent' : 'draw'),
      } : null);
      setTimeout(() => setSpectatorBattle(null), 5000);
    };

    const handleHeartSent = (data: any) => {
      if (!mounted) return;
      if (data.user_id === user?.id) return;
      setActiveLikes(prev => prev + 1);
    };

    const handleCohostLayoutSync = (data: any) => {
      if (!mounted) return;
      const list = Array.isArray(data.coHosts) ? data.coHosts : [];
      setSpectatorCoHosts(list.map((h: any) => ({
        id: String(h.id ?? h.userId ?? ''),
        userId: String(h.userId ?? ''),
        name: String(h.name ?? 'User'),
        avatar: String(h.avatar ?? ''),
        status: String(h.status ?? 'invited'),
      })));
      if (typeof data.hostUserId === 'string' && data.hostUserId) {
        setHostUserId(data.hostUserId);
        hostUserIdRef.current = data.hostUserId;
      }
    };

    const handleCohostRequestAccepted = (data: any) => {
      if (!mounted || !user?.id) return;
      const hostName = data.hostName || 'Creator';
      const streamKey = data.streamKey || effectiveStreamId;
      showToast(`@${hostName} accepted your co-host request!`);
      navigate(`/live/${streamKey}?cohost=1`);
    };

    websocket.on('room_state', handleRoomState);
    websocket.on('user_joined', handleUserJoined);
    websocket.on('user_left', handleUserLeft);
    websocket.on('chat_message', handleChatMessage);
    websocket.on('gift_sent', handleGiftSent);
    websocket.on('heart_sent', handleHeartSent);
    websocket.on('stream_ended', handleStreamEnded);
    websocket.on('battle_state_sync', handleBattleStateSync);
    websocket.on('battle_tick', handleBattleTick);
    websocket.on('battle_score', handleBattleScore);
    websocket.on('battle_ended', handleBattleEnded);
    websocket.on('cohost_layout_sync', handleCohostLayoutSync);
    websocket.on('cohost_request_accepted', handleCohostRequestAccepted);

    connect();

    const goOffline = async () => {
      if (!mounted) return;
      try {
        const url = apiUrl('/api/live/streams');
        const res = await fetch(url, { method: 'GET', credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          const streams = Array.isArray(json.streams) ? json.streams : [];
          const stillLive = streams.some((s: any) => (s.stream_key === effectiveStreamId || s.room_id === effectiveStreamId));
          if (stillLive) return;
        }
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
      websocket.off('heart_sent', handleHeartSent);
      websocket.off('stream_ended', handleStreamEnded);
      websocket.off('battle_state_sync', handleBattleStateSync);
      websocket.off('battle_tick', handleBattleTick);
      websocket.off('battle_score', handleBattleScore);
      websocket.off('battle_ended', handleBattleEnded);
      websocket.off('cohost_layout_sync', handleCohostLayoutSync);
      websocket.off('cohost_request_accepted', handleCohostRequestAccepted);
      websocket.disconnect();
    };
  }, [effectiveStreamId, user?.id, streamIsLive]);

  // Fetch share followers (people you follow / who follow you)
  // Note: Without a database, we return an empty list
  useEffect(() => {
    if (!user?.id) return;
    setShareContacts([]);
  }, [user?.id]);

  // Gift queue processor
  const [giftKey, setGiftKey] = useState(0);
  useEffect(() => {
    if (giftQueue.length > 0 && !currentGift) {
      setCurrentGift(giftQueue[0]);
      setGiftKey(k => k + 1);
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
      // In local/dev builds, still preview the gift animation so video gifts can play even without balance.
      if (
        import.meta.env.MODE !== 'production' &&
        gift.video &&
        gift.video.trim()
      ) {
        const raw = gift.video;
        const videoUrl =
          raw.startsWith('http://') || raw.startsWith('https://')
            ? raw
            : resolveGiftAssetUrl(raw.startsWith('/') ? raw : `/${raw}`);
        setGiftQueue(prev => [...prev, { video: videoUrl }]);
      }
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

    // Calculate XP and level up
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

    setShowGiftPanel(false);

    if (gift.video && gift.video.trim()) {
      const raw = gift.video;
      const videoUrl =
        raw.startsWith('http://') || raw.startsWith('https://')
          ? raw
          : resolveGiftAssetUrl(raw.startsWith('/') ? raw : `/${raw}`);
      setGiftQueue(prev => [...prev, { video: videoUrl }]);
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

  // Heart tap handler — send to creator via WebSocket
  const handleLikeTap = () => {
    setActiveLikes(prev => prev + 1);
    const connected = websocket.isConnected();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpectatorPage.tsx:handleLikeTap',message:'spectator-heart-tap',data:{wsConnected:connected,username:viewerName},timestamp:Date.now(),hypothesisId:'H14'})}).catch(()=>{});
    // #endregion
    if (connected) {
      websocket.send('heart_sent', { username: viewerName, avatar: viewerAvatar });
    }
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
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            {!streamEndedReceived && (
              <button
                type="button"
                onClick={() => { setStreamIsLive(null); setStreamRetryKey(k => k + 1); }}
                className="px-6 py-2.5 rounded-lg bg-[#C9A96E]/20 border border-[#C9A96E]/50 text-[#C9A96E] font-semibold"
              >
                Retry connection
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/feed', { replace: true })}
              className="px-6 py-2.5 rounded-lg bg-[#C9A96E] text-black font-semibold"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0A0B0E] flex justify-center">
      <div className="relative w-full max-w-[480px] h-full bg-[#13151A] overflow-hidden flex flex-col">

        {/* Spectator: single full-screen video only. No live-stream panel, no battle panel — only creator feed + own bottom buttons. */}
        <div className="absolute inset-0 z-0 bg-[#13151A]">
            <>
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                autoPlay
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
                  {!user?.id ? (
                    <>
                      <span className="text-white/80 text-sm text-center">Log in to watch the live stream</span>
                      <button
                        type="button"
                        onClick={() => navigate('/login', { state: { from: `/watch/${effectiveStreamId}` } })}
                        className="mt-2 px-5 py-2.5 rounded-lg bg-[#C9A96E] text-black font-semibold text-sm"
                      >
                        Log in
                      </button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              )}
            </>
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

            {/* Spectator: no co-host panel. When creator invites, show one-line accept so they join creator panel. */}
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
                      // In memory-only mode, just update local state
                      console.log(`[Follow] User ${user.id} followed ${hostUserId}`);
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

        {/* CHAT — behind buttons, behind gift overlay, same as creator page */}
        <div className="chat-zone fixed left-0 right-0 bottom-[calc(58px+max(12px,env(safe-area-inset-bottom)))] z-[5] flex justify-center pointer-events-none">
          <div className="w-full max-w-[480px] h-[25dvh] max-h-[25dvh] overflow-y-auto pointer-events-auto bg-transparent">
            <ChatOverlay
              messages={messages}
              variant="panel"
              compact
              isModerator={isModerator}
              onLike={handleLikeTap}
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

          <button
              type="button"
              title={joinRequested ? 'Request sent' : 'Co-Host'}
              disabled={!hostUserId || !user?.id || joinRequested}
              onClick={() => {
                if (!user?.id || !hostUserId || joinRequested) return;
                setJoinRequested(true);
                const requesterName = user?.username || user?.name || 'User';
                websocket.send('cohost_request_send', {
                  hostUserId,
                  requesterName,
                  requesterAvatar: user?.avatar || '',
                });
                showToast('Co-host request sent!');
              }}
              className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg relative flex-shrink-0 active:scale-95 transition-transform disabled:opacity-60"
            >
              <span className="flex items-center justify-center w-full h-full relative z-[2]">
                <UserPlus size={20} className="text-[#C9A96E] shrink-0" strokeWidth={2} />
              </span>
              <img
                src="/Icons/Music Icon.png"
                alt=""
                className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[3] scale-125 translate-y-0.5"
              />
            </button>

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
        <GiftOverlay key={`gift-${giftKey}`} videoSrc={currentGift?.video ?? null} onEnded={handleGiftEnded} isBattleMode={!!spectatorBattle?.active} />

        {/* Spectator has no battle panel; single video only. spectatorBattle still used for gift overlay. */}

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
                      // In memory-only mode, coins are persisted locally
                      console.log(`[Test Coins] Added ${amount} to user ${user?.id}`);
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
                          // In memory-only mode, coins are persisted locally
                          console.log(`[Test Coins] Added ${amount} to user ${user?.id}`);
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

      </div>
    </div>
  );
}
