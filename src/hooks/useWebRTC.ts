import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useCallStore } from '../store/useCallStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
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

interface UseWebRTCCallOptions {
  callId: string;
  localUserId: string;
  remoteUserId: string;
  isCaller: boolean;
}

export function useWebRTCCall({ callId, localUserId, remoteUserId, isCaller }: UseWebRTCCallOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const iceCandidateBuffer = useRef<RTCIceCandidateInit[]>([]);
  const hasRemoteDescRef = useRef(false);
  const cleanedUpRef = useRef(false);

  const { setStatus } = useCallStore.getState();

  const sendSignal = useCallback(
    async (type: string, payload: Record<string, unknown>) => {
      await supabase.from('call_signals').insert({
        caller_id: localUserId,
        callee_id: remoteUserId,
        call_id: callId,
        type,
        payload,
      });
    },
    [callId, localUserId, remoteUserId]
  );

  const flushIceCandidates = useCallback(async () => {
    if (!pcRef.current || !hasRemoteDescRef.current) return;
    while (iceCandidateBuffer.current.length > 0) {
      const candidate = iceCandidateBuffer.current.shift()!;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Failed to add buffered ICE candidate:', e);
      }
    }
  }, []);

  const startLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        useCallStore.getState().endCall('Camera/microphone permission denied');
      } else if (err.name === 'NotFoundError') {
        useCallStore.getState().endCall('No camera or microphone found');
      } else {
        useCallStore.getState().endCall('Failed to access camera/microphone');
      }
      throw err;
    }
  }, []);

  const createPeerConnection = useCallback(
    (stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const remoteMs = new MediaStream();
      setRemoteStream(remoteMs);

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          remoteMs.addTrack(track);
        });
        setRemoteStream(new MediaStream(remoteMs.getTracks()));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal('ice-candidate', { candidate: event.candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
        if (pc.connectionState === 'connected') {
          setStatus('connected');
        } else if (pc.connectionState === 'disconnected') {
          setStatus('reconnecting');
        } else if (pc.connectionState === 'failed') {
          setStatus('ended');
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          pc.restartIce();
        }
      };

      return pc;
    },
    [sendSignal, setStatus]
  );

  const handleSignal = useCallback(
    async (type: string, payload: Record<string, unknown>) => {
      const pc = pcRef.current;
      if (!pc) return;

      switch (type) {
        case 'offer': {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit));
          hasRemoteDescRef.current = true;
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal('answer', { sdp: answer });
          await flushIceCandidates();
          break;
        }
        case 'answer': {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit));
          hasRemoteDescRef.current = true;
          await flushIceCandidates();
          break;
        }
        case 'ice-candidate': {
          const candidate = payload.candidate as RTCIceCandidateInit;
          if (hasRemoteDescRef.current) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn('Failed to add ICE candidate:', e);
            }
          } else {
            iceCandidateBuffer.current.push(candidate);
          }
          break;
        }
        case 'hangup': {
          useCallStore.getState().endCall('Remote user ended the call');
          break;
        }
      }
    },
    [sendSignal, flushIceCandidates]
  );

  const subscribeToSignals = useCallback(() => {
    const channel = supabase
      .channel(`call:${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          const row = payload.new as { caller_id: string; type: string; payload: Record<string, unknown> };
          if (row.caller_id === localUserId) return;
          handleSignal(row.type, row.payload);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return channel;
  }, [callId, localUserId, handleSignal]);

  const initCall = useCallback(async () => {
    setStatus('connecting');
    try {
      const stream = await startLocalMedia();
      const pc = createPeerConnection(stream);
      pcRef.current = pc;

      subscribeToSignals();

      if (isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal('offer', { sdp: offer });
      }
    } catch {
      // Permission denied or media error — endCall already called in startLocalMedia
    }
  }, [isCaller, startLocalMedia, createPeerConnection, subscribeToSignals, sendSignal, setStatus]);

  const hangup = useCallback(async () => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;

    await sendSignal('hangup', {}).catch(() => {});

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setRemoteStream(null);
    hasRemoteDescRef.current = false;
    iceCandidateBuffer.current = [];
  }, [sendSignal]);

  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    const currentTrack = localStreamRef.current.getVideoTracks()[0];
    const facingMode = currentTrack?.getSettings().facingMode === 'user' ? 'environment' : 'user';
    currentTrack?.stop();

    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    const newVideoTrack = newStream.getVideoTracks()[0];

    if (pcRef.current) {
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && newVideoTrack) {
        await sender.replaceTrack(newVideoTrack);
      }
    }

    localStreamRef.current.removeTrack(currentTrack);
    localStreamRef.current.addTrack(newVideoTrack);
    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
  }, []);

  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    useCallStore.getState().toggleAudio();
  }, []);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    useCallStore.getState().toggleVideo();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = false; });
      } else if (document.visibilityState === 'visible' && localStreamRef.current) {
        const { isVideoOff } = useCallStore.getState();
        if (!isVideoOff) {
          localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = true; });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (!cleanedUpRef.current) {
        hangup();
      }
    };
  }, [hangup]);

  return {
    localStream,
    remoteStream,
    connectionState,
    initCall,
    hangup,
    switchCamera,
    toggleAudio,
    toggleVideo,
  };
}
