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
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Keyboard,
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
import { useLiveWebRTC } from '../hooks/useLiveWebRTC';

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
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const effectiveStreamId = streamId || '';

  const [hostName, setHostName] = useState('Creator');
  const [hostAvatar, setHostAvatar] = useState('');
  const [hostUserId, setHostUserId] = useState('');
  const [streamIsLive, setStreamIsLive] = useState<boolean | null>(null);
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
  const [showChatInput, setShowChatInput] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [showViewersPanel, setShowViewersPanel] = useState(false);
  const [viewersList, setViewersList] = useState<{ id: string; name: string; avatar: string; level?: number }[]>([]);

  const [userLevel, setUserLevel] = useState(user?.level || 1);
  const [userXP, setUserXP] = useState(0);

  const viewerName = user?.username || user?.name || 'Viewer';
  const viewerAvatar = user?.avatar || '';

  const [moderators, setModerators] = useState<Set<string>>(new Set());
  const isModerator = moderators.has(user?.id || '');

  const [hasJoinedToday, setHasJoinedToday] = useState(false);
  const [myHeartCount, setMyHeartCount] = useState(0);

  // ═══════════════════════════════════════════════════
  // CO-HOST STATE
  // ═══════════════════════════════════════════════════
  type PendingCoHostInvite = {
    notifId: string;
    hostName: string;
    hostAvatar: string;
    streamKey: string;
    hostUserId: string;
  };
  const [pendingCoHostInvite, setPendingCoHostInvite] = useState<PendingCoHostInvite | null>(null);
  const [isCoHosting, setIsCoHosting] = useState(false);
  const [coHostStream, setCoHostStream] = useState<MediaStream | null>(null);
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
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
      setCoHostStream(stream);
      setIsCoHosting(true);

      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
        myVideoRef.current.play().catch(() => {});
      }

      // Announce presence to host via Supabase broadcast
      const chan = supabase.channel(`cohost_presence_${effectiveStreamId}`);
      chan.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          chan.send({
            type: 'broadcast',
            event: 'cohost_joined',
            payload: {
              userId: user?.id,
              name: user?.username || user?.name || viewerName,
              avatar: user?.avatar || viewerAvatar,
            },
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
    setIsCoHosting(false);
    setIsMicMuted(false);
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

  // Listen for incoming co-host invites
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
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [user?.id]);

  const acceptCoHostInvite = async () => {
    if (!pendingCoHostInvite || !user?.id) return;
    const invite = pendingCoHostInvite;
    setPendingCoHostInvite(null);

    if (!invite.streamKey) {
      showToast('Invalid invite — missing stream key');
      return;
    }

    try {
      const myUsername = user.username || user.name || viewerName;
      supabase.from('notifications').update({ is_read: true }).eq('id', invite.notifId).then(() => {});
      supabase.from('notifications').insert({
        user_id: invite.hostUserId,
        type: 'cohost_accepted',
        title: 'Co-Host Accepted',
        body: `@${myUsername} accepted your co-host invite!`,
        data: {
          actor_id: user.id,
          accepted_name: myUsername,
          accepted_avatar: user.avatar || viewerAvatar,
          stream_key: invite.streamKey,
        },
      }).then(() => {});
    } catch {}

    // If already on this stream, start co-hosting in-place
    if (invite.streamKey === effectiveStreamId) {
      await startCoHosting();
    } else {
      showToast(`Joining @${invite.hostName}'s stream...`);
      window.location.href = `/watch/${invite.streamKey}?cohost=1`;
    }
  };

  const declineCoHostInvite = async () => {
    if (!pendingCoHostInvite) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', pendingCoHostInvite.notifId);
    } catch {}
    setPendingCoHostInvite(null);
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

  const { remotePeers, error: webrtcError } = useLiveWebRTC({
    roomId: effectiveStreamId,
    localUserId: user?.id || '',
    localStream: coHostStream,
    enabled: !!effectiveStreamId && !!user?.id,
  });

  useEffect(() => {
    if (remotePeers.length === 0) return;
    const broadcasterPeer = remotePeers[0];
    if (videoRef.current && broadcasterPeer.stream) {
      if (videoRef.current.srcObject !== broadcasterPeer.stream) {
        videoRef.current.srcObject = broadcasterPeer.stream;
        videoRef.current.play().catch(() => {});
        setHasStream(true);
      }
    }
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
      const { data: stream } = await supabase
        .from('live_streams')
        .select('user_id, title, viewer_count, is_live')
        .eq('stream_key', effectiveStreamId)
        .maybeSingle();
      if (!stream) {
        setStreamIsLive(false);
        return;
      }
      setStreamIsLive(!!stream.is_live);
      if (stream.user_id) {
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

  // Viewer count: increment on join, decrement on leave + realtime updates
  useEffect(() => {
    if (!effectiveStreamId) return;

    supabase.rpc('increment_viewer_count', { p_stream_key: effectiveStreamId }).then(() => {});

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

    return () => {
      supabase.removeChannel(chan);
      supabase.rpc('decrement_viewer_count', { p_stream_key: effectiveStreamId }).then(() => {});
    };
  }, [effectiveStreamId, navigate]);

  // WebSocket: connect to room for real-time chat, gifts, join/leave
  useEffect(() => {
    if (!effectiveStreamId || !user?.id) return;

    let mounted = true;

    const connect = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || '';
      if (!token || !mounted) return;
      websocket.connect(effectiveStreamId, token);
    };

    const handleUserJoined = (data: any) => {
      if (!mounted) return;
      if (data.user_id === user?.id) return;
      const joinName = data.username || 'User';
      setMessages(prev => [...prev, {
        id: `join-${Date.now()}`,
        username: joinName,
        text: 'joined the stream',
        isSystem: true,
        level: data.level || 1,
        avatar: data.avatar_url || '',
      }]);
      setViewerCount(prev => prev + 1);
    };

    const handleUserLeft = (data: any) => {
      if (!mounted) return;
      setViewerCount(prev => Math.max(0, prev - 1));
    };

    const handleChatMessage = (data: any) => {
      if (!mounted) return;
      if (data.user_id === user?.id) return;
      const msg: LiveMessage = {
        id: `ws-${Date.now()}-${Math.random()}`,
        username: data.username || 'User',
        text: data.text || '',
        level: data.level || 1,
        avatar: data.avatar || '',
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
          username: data.username || 'User',
          text: `sent ${giftDef.name}`,
          level: data.level || 1,
          avatar: data.avatar || '',
          isGift: true,
        };
        setMessages(prev => [...prev, msg]);
        if (giftDef.video) {
          setGiftQueue(prev => [...prev, giftDef.video]);
        }
      }
    };

    websocket.on('user_joined', handleUserJoined);
    websocket.on('user_left', handleUserLeft);
    websocket.on('chat_message', handleChatMessage);
    websocket.on('gift_sent', handleGiftSent);

    connect();

    return () => {
      mounted = false;
      websocket.off('user_joined', handleUserJoined);
      websocket.off('user_left', handleUserLeft);
      websocket.off('chat_message', handleChatMessage);
      websocket.off('gift_sent', handleGiftSent);
      websocket.disconnect();
    };
  }, [effectiveStreamId, user?.id]);

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

  // Send join request (co-host or battle)
  const sendJoinRequest = async (type: 'cohost' | 'battle') => {
    if (!user?.id || !effectiveStreamId) return;

    let targetUserId = hostUserId;
    if (!targetUserId) {
      const { data: stream } = await supabase
        .from('live_streams')
        .select('user_id')
        .eq('stream_key', effectiveStreamId)
        .maybeSingle();
      if (!stream?.user_id) { showToast('Stream not found'); return; }
      targetUserId = stream.user_id;
    }

    const myName = user.username || user.name || 'User';
    await supabase.from('notifications').insert({
      user_id: targetUserId,
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

  if (streamIsLive === false) {
    return (
      <div className="fixed inset-0 bg-[#0A0B0E] flex justify-center">
        <div className="relative w-full max-w-[480px] h-full bg-[#13151A] flex flex-col items-center justify-center gap-4 p-6">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
            <span className="text-3xl">📡</span>
          </div>
          <h2 className="text-white font-bold text-lg">Stream offline</h2>
          <p className="text-white/50 text-sm text-center">This stream has ended or is not available right now.</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
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
          {isCoHosting ? (
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
                {/* Co-host controls: mic, cam, leave */}
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
          ) : (
            /* NORMAL FULL SCREEN: host video only */
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
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
                    <span className="text-white/60 text-sm">Connecting to stream...</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* TOP BAR */}
        <div className="relative z-[110] pointer-events-none">
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
                    <span className="text-white/70 text-[8px] font-bold tabular-nums">{activeLikes.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Right: Viewer avatars + count + close */}
              <div className="pointer-events-auto flex items-center gap-2 flex-shrink-0">
                {/* Viewer avatar stack — tap to open viewers panel */}
                <button
                  type="button"
                  title="View top viewers"
                  className="flex items-center active:scale-95 transition-transform"
                  onClick={async () => {
                    setShowViewersPanel(true);
                    try {
                      const { data } = await supabase
                        .from('profiles')
                        .select('user_id, username, display_name, avatar_url, level')
                        .limit(50);
                      if (data) {
                        setViewersList(data.map((p: any) => ({
                          id: p.user_id,
                          name: p.display_name || p.username || 'User',
                          avatar: p.avatar_url || '',
                          level: p.level || 1,
                        })));
                      }
                    } catch {}
                  }}
                >
                  <div className="flex -space-x-2">
                    {[hostAvatar, viewerAvatar].filter(Boolean).slice(0, 3).map((av, i) => (
                      <div key={i} className="w-7 h-7 rounded-full border-2 border-[#0A0B0E] overflow-hidden bg-[#1a1a2e]">
                        <img src={av} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {viewerCount > 3 && (
                      <div className="w-7 h-7 rounded-full border-2 border-[#0A0B0E] bg-[#1a1a2e] flex items-center justify-center">
                        <span className="text-white/60 text-[8px] font-bold">+{viewerCount - 3}</span>
                      </div>
                    )}
                  </div>
                  <div className="ml-1.5 px-2 py-0.5 rounded-full bg-[#13151A]/70">
                    <span className="text-white text-[11px] font-bold tabular-nums">
                      {viewerCount >= 1000 ? (viewerCount / 1000).toFixed(1) + 'K' : viewerCount}
                    </span>
                  </div>
                </button>
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

        {/* CREATOR'S CHAT — spectator sees stream chat (read-only) */}
        <div className="flex-1 relative z-10 pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 max-h-[40vh] pointer-events-none px-3 pb-2">
            <ChatOverlay
              messages={messages}
              variant="overlay"
              compact
              isModerator={false}
            />
          </div>
        </div>

        {/* BOTTOM BAR — buttons only */}
        <div className="flex-none pointer-events-auto bg-transparent px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 min-h-[50px] relative z-[90]">
          <div className="flex items-center justify-center gap-3 translate-y-[4px]">
            {/* Keyboard icon — opens chat input */}
            <button
              type="button"
              title="Type a message"
              onClick={() => {
                setShowChatInput(true);
                setTimeout(() => chatInputRef.current?.focus(), 100);
              }}
              className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <Keyboard size={20} className="text-[#C9A96E]" />
            </button>

            {/* Request co-host */}
            {isCoHosting ? (
              <div className="h-10 px-3 rounded-full bg-[#C9A96E]/20 border border-[#C9A96E]/40 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#C9A96E] animate-pulse" />
                <span className="text-[#C9A96E] text-[10px] font-bold">Co-hosting</span>
              </div>
            ) : !joinRequestSent ? (
              <button type="button" title="Request co-host" onClick={() => sendJoinRequest('cohost')} className="w-10 h-10 rounded-full bg-[#C9A96E] flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                <UserPlus size={20} className="text-black" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#13151A] border border-green-500/40 flex items-center justify-center">
                <Check size={20} className="text-green-400" />
              </div>
            )}

            {/* Gift */}
            <button type="button" title="Send gift" onClick={() => setShowGiftPanel(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
              <Gift size={20} className="text-[#C9A96E]" />
            </button>

            {/* Share */}
            <button type="button" title="Share" onClick={() => setShowSharePanel(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
              <Share2 size={20} className="text-[#C9A96E]" />
            </button>

            {/* More (3 dots) */}
            <button type="button" title="More options" onClick={() => setIsMoreMenuOpen(true)} className="w-10 h-10 rounded-full bg-[#13151A] backdrop-blur-md border border-[#C9A96E]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
              <MoreVertical size={20} className="text-[#C9A96E]" />
            </button>
          </div>
        </div>

        {/* CHAT INPUT OVERLAY — appears when keyboard icon is tapped */}
        {showChatInput && (
          <div className="fixed inset-0 z-[100000] flex flex-col justify-end pointer-events-none max-w-[480px] mx-auto">
            <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => setShowChatInput(false)} />
            <div className="pointer-events-auto relative z-10 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              <form
                onSubmit={(e) => { handleSendMessage(e); setShowChatInput(false); }}
                className="flex items-center gap-2 bg-[#13151A]/95 backdrop-blur-md rounded-full px-4 py-2 border border-[#C9A96E]/40 h-12"
              >
                <input
                  ref={chatInputRef}
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
                <button type="submit" className="text-[#C9A96E] hover:text-[#C9A96E]/80 transition flex-shrink-0" title="Send">
                  <Send size={20} />
                </button>
              </form>
            </div>
          </div>
        )}

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
            videoId={hostUserId}
            contentType="live"
          />
        )}

        {/* INCOMING CO-HOST INVITE BANNER */}
        {pendingCoHostInvite && (
          <div className="fixed inset-0 z-[100002] flex flex-col justify-end pointer-events-none max-w-[480px] mx-auto">
            <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => declineCoHostInvite()} />
            <div className="pointer-events-auto relative z-10">
              <div className="bg-[#1C1E24]/95 backdrop-blur-md rounded-t-2xl border-t border-[#C9A96E]/30 shadow-2xl p-4 pb-safe">
                <div className="flex justify-center mb-3">
                  <div className="w-10 h-1 bg-white/20 rounded-full" />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-full border-2 border-[#C9A96E]/50 overflow-hidden bg-[#13151A] flex-shrink-0">
                    {pendingCoHostInvite.hostAvatar ? (
                      <img src={pendingCoHostInvite.hostAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#C9A96E] font-bold text-lg">
                        {pendingCoHostInvite.hostName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-base">Co-Host Invite</p>
                    <p className="text-white/60 text-sm truncate">
                      <span className="text-[#C9A96E]">@{pendingCoHostInvite.hostName}</span> wants you to co-host!
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); declineCoHostInvite(); }}
                    className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-bold active:scale-95 transition-all"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); acceptCoHostInvite(); }}
                    className="flex-1 py-3 rounded-xl bg-[#C9A96E] text-black text-sm font-bold active:scale-95 transition-all shadow-lg shadow-[#C9A96E]/20"
                  >
                    Accept
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
