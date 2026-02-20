import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvatarRing } from '../components/AvatarRing';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
} from 'lucide-react';
import { useCallStore } from '../store/useCallStore';
import { useAuthStore } from '../store/useAuthStore';
import { useWebRTCCall } from '../hooks/useWebRTC';

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function VideoCall() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    callId,
    status,
    remoteUser,
    isAudioMuted,
    isVideoOff,
    callStartTime,
    endReason,
  } = useCallStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);

  const isCaller = status === 'outgoing' || (status === 'connecting' && !!callId);

  const {
    localStream,
    remoteStream,
    initCall,
    hangup,
    switchCamera,
    toggleAudio,
    toggleVideo,
  } = useWebRTCCall({
    callId: callId || '',
    localUserId: user?.id || '',
    remoteUserId: remoteUser?.id || '',
    isCaller,
  });

  useEffect(() => {
    if (callId && user?.id && remoteUser?.id && (status === 'connecting' || status === 'outgoing')) {
      initCall();
    }
  }, [callId, user?.id, remoteUser?.id, status, initCall]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (status !== 'connected' || !callStartTime) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - callStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [status, callStartTime]);

  useEffect(() => {
    if (status === 'ended') {
      const timer = setTimeout(() => {
        useCallStore.getState().reset();
        navigate(-1);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  if (!callId || !remoteUser) {
    return (
      <div className="min-h-[100dvh] h-[100dvh] bg-[#13151A] flex items-center justify-center text-white overflow-hidden">
        <p>No active call</p>
      </div>
    );
  }

  const handleHangup = async () => {
    await hangup();
    useCallStore.getState().endCall('You ended the call');
  };

  const statusLabel =
    status === 'outgoing'
      ? 'Calling...'
      : status === 'incoming'
        ? 'Incoming call...'
        : status === 'connecting'
          ? 'Connecting...'
          : status === 'reconnecting'
            ? 'Reconnecting...'
            : status === 'ended'
              ? endReason || 'Call ended'
              : formatDuration(elapsed);

  return (
    <div className="fixed inset-0 bg-[#13151A] z-50 flex flex-col">
      {/* Remote video (full screen) */}
      <div className="flex-1 relative">
        {remoteStream && status === 'connected' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            {remoteUser.avatar ? (
              <AvatarRing src={remoteUser.avatar} alt={remoteUser.username} size={96} />
            ) : (
              <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-3xl text-white">
                {remoteUser.username[0]?.toUpperCase()}
              </div>
            )}
            <p className="text-white text-lg font-semibold">
              {remoteUser.username}
            </p>
            <p className="text-white/60 text-sm">{statusLabel}</p>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          title="Go back"
          className="absolute top-12 left-4 w-10 h-10 rounded-full bg-[#13151A]/40 flex items-center justify-center"
        >
          <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
        </button>

        {/* Timer / Status */}
        {status === 'connected' && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-[#13151A]/50 px-4 py-1 rounded-full">
            <p className="text-white text-sm font-mono">{statusLabel}</p>
          </div>
        )}

        {/* Local video PiP */}
        {localStream && (
          <div className="absolute top-20 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/20 bg-[#13151A] shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
              <div className="w-full h-full flex items-center justify-center bg-[#1C1E24]">
                <VideoOff className="w-6 h-6 text-white/50" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-[#13151A]/80 backdrop-blur-sm pb-10 pt-6 px-6">
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={toggleAudio}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              isAudioMuted ? 'bg-red-500/80' : 'bg-white/20'
            }`}
          >
            {isAudioMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              isVideoOff ? 'bg-red-500/80' : 'bg-white/20'
            }`}
          >
            {isVideoOff ? (
              <VideoOff className="w-6 h-6 text-white" />
            ) : (
              <Video className="w-6 h-6 text-white" />
            )}
          </button>

          <button
            onClick={switchCamera}
            title="Switch camera"
            className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center"
          >
            <SwitchCamera className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={handleHangup}
            title="End call"
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
