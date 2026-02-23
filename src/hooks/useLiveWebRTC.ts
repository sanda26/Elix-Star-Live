import { useEffect, useRef, useCallback, useState } from 'react';
import { websocket } from '../lib/websocket';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

export type PeerState = 'connecting' | 'connected' | 'disconnected' | 'failed';

export interface RemotePeer {
  userId: string;
  stream: MediaStream;
  state: PeerState;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  stream: MediaStream;
  state: PeerState;
  iceCandidateBuffer: RTCIceCandidateInit[];
  hasRemoteDesc: boolean;
}

interface UseLiveWebRTCOptions {
  roomId: string;
  localUserId: string;
  localStream: MediaStream | null;
  enabled: boolean;
}

const MAX_PEERS = 15;

const BITRATE_CAP = 1_200_000; // 1.2 Mbps — good quality without overloading mobile

async function capSenderBitrate(pc: RTCPeerConnection) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== 'video') continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = BITRATE_CAP;
      await sender.setParameters(params);
    } catch { /* not all browsers support this */ }
  }
}

export function useLiveWebRTC({ roomId, localUserId, localStream, enabled }: UseLiveWebRTCOptions) {
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const enabledRef = useRef(enabled);
  const localStreamRef = useRef(localStream);
  const roomIdRef = useRef(roomId);
  const localUserIdRef = useRef(localUserId);

  enabledRef.current = enabled;
  localStreamRef.current = localStream;
  roomIdRef.current = roomId;
  localUserIdRef.current = localUserId;

  const updateRemotePeers = useCallback(() => {
    const peers: RemotePeer[] = [];
    peersRef.current.forEach((entry, userId) => {
      peers.push({ userId, stream: entry.stream, state: entry.state });
    });
    setRemotePeers([...peers]);
  }, []);

  const createPeerConnection = useCallback((remoteUserId: string, isCaller: boolean): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    const remoteStream = new MediaStream();

    const entry: PeerEntry = {
      pc,
      stream: remoteStream,
      state: 'connecting',
      iceCandidateBuffer: [],
      hasRemoteDesc: false,
    };
    peersRef.current.set(remoteUserId, entry);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
      const e = peersRef.current.get(remoteUserId);
      if (e) {
        e.stream = new MediaStream(remoteStream.getTracks());
        updateRemotePeers();
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        websocket.send('rtc_ice_candidate', {
          target_user_id: remoteUserId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const e = peersRef.current.get(remoteUserId);
      if (!e) return;
      const s = pc.connectionState;
      if (s === 'connected') {
        e.state = 'connected';
      } else if (s === 'failed' || s === 'closed') {
        pc.close();
        peersRef.current.delete(remoteUserId);
        setError(s === 'failed' ? 'Connection to peer failed' : null);
      } else if (s === 'disconnected') {
        e.state = 'disconnected';
      } else {
        e.state = 'connecting';
      }
      updateRemotePeers();
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    updateRemotePeers();

    if (isCaller) {
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          websocket.send('rtc_offer', {
            target_user_id: remoteUserId,
            sdp: offer,
          });
          await capSenderBitrate(pc);
        } catch (err) {
          setError('Failed to create offer');
        }
      })();
    }

    return pc;
  }, [updateRemotePeers]);

  const flushIceCandidates = useCallback(async (userId: string) => {
    const entry = peersRef.current.get(userId);
    if (!entry || !entry.hasRemoteDesc) return;
    while (entry.iceCandidateBuffer.length > 0) {
      const candidate = entry.iceCandidateBuffer.shift()!;
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch { /* ignore */ }
    }
  }, []);

  const handleRtcJoin = useCallback((data: any) => {
    if (!enabledRef.current) return;
    const remoteUserId = data.user_id;
    if (remoteUserId === localUserIdRef.current) return;
    if (peersRef.current.has(remoteUserId)) return;
    if (peersRef.current.size >= MAX_PEERS) return;
    createPeerConnection(remoteUserId, true);
  }, [createPeerConnection]);

  const handleRtcLeave = useCallback((data: any) => {
    const remoteUserId = data.user_id;
    const entry = peersRef.current.get(remoteUserId);
    if (entry) {
      entry.pc.close();
      peersRef.current.delete(remoteUserId);
      updateRemotePeers();
    }
  }, [updateRemotePeers]);

  const handleRtcOffer = useCallback(async (data: any) => {
    if (!enabledRef.current) return;
    const fromUserId = data.from_user_id;
    if (fromUserId === localUserIdRef.current) return;

    let entry = peersRef.current.get(fromUserId);
    if (!entry) {
      createPeerConnection(fromUserId, false);
      entry = peersRef.current.get(fromUserId);
    }
    if (!entry) return;

    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      entry.hasRemoteDesc = true;
      const answer = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      websocket.send('rtc_answer', {
        target_user_id: fromUserId,
        sdp: answer,
      });
      await capSenderBitrate(entry.pc);
      await flushIceCandidates(fromUserId);
    } catch (err) {
      setError('Failed to handle offer');
    }
  }, [createPeerConnection, flushIceCandidates]);

  const handleRtcAnswer = useCallback(async (data: any) => {
    const fromUserId = data.from_user_id;
    const entry = peersRef.current.get(fromUserId);
    if (!entry) return;
    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      entry.hasRemoteDesc = true;
      await flushIceCandidates(fromUserId);
    } catch (err) {
      setError('Failed to handle answer');
    }
  }, [flushIceCandidates]);

  const handleRtcIceCandidate = useCallback(async (data: any) => {
    const fromUserId = data.from_user_id;
    const entry = peersRef.current.get(fromUserId);
    if (!entry) return;
    const candidate = data.candidate;
    if (entry.hasRemoteDesc) {
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch { /* ignore */ }
    } else {
      entry.iceCandidateBuffer.push(candidate);
    }
  }, []);

  const joinRoom = useCallback(() => {
    websocket.send('rtc_join', {
      user_id: localUserIdRef.current,
    });
  }, []);

  const leaveRoom = useCallback(() => {
    websocket.send('rtc_leave', {
      user_id: localUserIdRef.current,
    });
    peersRef.current.forEach((entry) => {
      entry.pc.close();
    });
    peersRef.current.clear();
    setRemotePeers([]);
  }, []);

  // When localStream becomes available (e.g. co-host camera starts after peer connections exist),
  // add tracks to all existing peer connections and renegotiate
  useEffect(() => {
    if (!localStream || peersRef.current.size === 0) return;
    peersRef.current.forEach((entry, remoteUserId) => {
      const pc = entry.pc;
      const senders = pc.getSenders();
      const existingTrackIds = new Set(senders.map(s => s.track?.id).filter(Boolean));
      let added = false;
      localStream.getTracks().forEach(track => {
        if (!existingTrackIds.has(track.id)) {
          pc.addTrack(track, localStream);
          added = true;
        }
      });
      if (added) {
        (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            websocket.send('rtc_offer', { target_user_id: remoteUserId, sdp: offer });
            await capSenderBitrate(pc);
          } catch { /* renegotiation failed */ }
        })();
      }
    });
  }, [localStream]);

  useEffect(() => {
    if (!enabled || !roomId || !localUserId) return;

    const handleConnected = () => {
      joinRoom();
    };

    let roomFullReceived = false;
    const retryTimerIds: ReturnType<typeof setTimeout>[] = [];

    const handleRoomFull = (data: any) => {
      roomFullReceived = true;
      retryTimerIds.forEach(clearTimeout);
      setError(data?.message || 'Live is full (max 15 viewers). Try again later.');
    };

    websocket.on('connected', handleConnected);
    websocket.on('rtc_join', handleRtcJoin);
    websocket.on('rtc_leave', handleRtcLeave);
    websocket.on('rtc_offer', handleRtcOffer);
    websocket.on('rtc_answer', handleRtcAnswer);
    websocket.on('rtc_ice_candidate', handleRtcIceCandidate);
    websocket.on('room_full', handleRoomFull);

    joinRoom();

    // Retry rtc_join if no peers connect (handles race where
    // broadcaster wasn't ready). Stops if room_full was received.
    retryTimerIds.push(
      setTimeout(() => { if (!roomFullReceived && peersRef.current.size === 0) joinRoom(); }, 5000),
      setTimeout(() => { if (!roomFullReceived && peersRef.current.size === 0) joinRoom(); }, 12000),
      setTimeout(() => { if (!roomFullReceived && peersRef.current.size === 0) joinRoom(); }, 25000),
    );

    return () => {
      retryTimerIds.forEach(clearTimeout);
      websocket.off('connected', handleConnected);
      websocket.off('rtc_join', handleRtcJoin);
      websocket.off('rtc_leave', handleRtcLeave);
      websocket.off('rtc_offer', handleRtcOffer);
      websocket.off('rtc_answer', handleRtcAnswer);
      websocket.off('rtc_ice_candidate', handleRtcIceCandidate);
      websocket.off('room_full', handleRoomFull);
      leaveRoom();
    };
  }, [enabled, roomId, localUserId, handleRtcJoin, handleRtcLeave, handleRtcOffer, handleRtcAnswer, handleRtcIceCandidate, joinRoom, leaveRoom]);

  return {
    remotePeers,
    error,
    joinRoom,
    leaveRoom,
  };
}
