import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Room, RoomEvent } from "livekit-client";
import { apiUrl, getLiveKitUrl } from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";
import { Radio } from "lucide-react";

interface InlineLiveViewerProps {
  streamKey: string;
  isActive: boolean;
  creatorName?: string;
  creatorAvatar?: string;
  viewerCount?: number;
  className?: string;
}

/**
 * Embeds the real live creator video in the feed. Only connects to LiveKit when isActive.
 * Tap "Watch full screen" to go to /watch/:streamKey.
 */
export default function InlineLiveViewer({
  streamKey,
  isActive,
  creatorName = "Creator",
  creatorAvatar,
  viewerCount = 0,
  className = "",
}: InlineLiveViewerProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const connectedKeyRef = useRef<string>("");
  const [hasStream, setHasStream] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    const token = useAuthStore.getState().session?.access_token;
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  };

  useEffect(() => {
    if (!isActive || !streamKey) return;
    const connKey = `${streamKey}-${isActive}`;
    if (connectedKeyRef.current === connKey && roomRef.current) return;
    connectedKeyRef.current = connKey;

    let mounted = true;
    const room = new Room({ adaptiveStream: true });
    roomRef.current = room;

    (async () => {
      setConnecting(true);
      setHasStream(false);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'InlineLiveViewer.tsx:connect',message:'inline-viewer-start',data:{streamKey,isActive},timestamp:Date.now(),hypothesisId:'H11'})}).catch(()=>{});
      // #endregion
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        };
        const res = await fetch(
          apiUrl(`/api/live/token?room=${encodeURIComponent(streamKey)}`),
          { method: "GET", credentials: "include", headers }
        );
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'InlineLiveViewer.tsx:token',message:'inline-viewer-token-res',data:{ok:res.ok,status:res.status},timestamp:Date.now(),hypothesisId:'H11'})}).catch(()=>{});
        // #endregion
        if (!res.ok || !mounted) return;

        const data = await res.json().catch(() => ({}));
        let url = (data?.url ?? "").trim();
        if (!url) url = getLiveKitUrl();
        const token = data?.token;
        if (!url || !token || !mounted) return;

        const onTrackSubscribed = (track: import("livekit-client").RemoteTrack) => {
          if (!mounted || track.kind !== "video") return;
          const el = videoRef.current;
          if (el) {
            track.attach(el);
            setHasStream(true);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'InlineLiveViewer.tsx:track',message:'inline-viewer-video-attached',data:{streamKey,trackSid:track.sid},timestamp:Date.now(),hypothesisId:'H13'})}).catch(()=>{});
            // #endregion
          }
        };

        room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
        await room.connect(url, token);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'InlineLiveViewer.tsx:connected',message:'inline-viewer-connected',data:{streamKey,remoteParticipants:room.remoteParticipants.size},timestamp:Date.now(),hypothesisId:'H11'})}).catch(()=>{});
        // #endregion
        if (!mounted) {
          room.disconnect();
          return;
        }

        for (const [, participant] of room.remoteParticipants) {
          for (const [, publication] of participant.videoTrackPublications) {
            if (publication.track && publication.isSubscribed) {
              publication.track.attach(videoRef.current!);
              setHasStream(true);
              return;
            }
          }
        }
      } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'InlineLiveViewer.tsx:error',message:'inline-viewer-error',data:{streamKey,error:String(err)},timestamp:Date.now(),hypothesisId:'H11'})}).catch(()=>{});
        // #endregion
        if (mounted) setHasStream(false);
      } finally {
        if (mounted) setConnecting(false);
      }
    })();

    return () => {
      mounted = false;
      connectedKeyRef.current = "";
      roomRef.current = null;
      room.disconnect();
      setHasStream(false);
      setConnecting(false);
    };
  }, [isActive, streamKey]);

  const formattedViewers =
    viewerCount >= 1_000_000
      ? (viewerCount / 1_000_000).toFixed(1) + "M"
      : viewerCount >= 1_000
        ? (viewerCount / 1_000).toFixed(1) + "K"
        : String(viewerCount);

  return (
    <div
      className={`relative w-full h-full bg-[#13151A] ${className}`}
      style={{ background: "#13151A" }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        playsInline
        muted
        style={{
          opacity: hasStream ? 1 : 0,
          transition: "opacity 0.35s ease",
        }}
      />

      {!hasStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#13151A] gap-4">
          {creatorAvatar ? (
            <img
              src={creatorAvatar}
              alt=""
              className="w-24 h-24 rounded-full object-cover border-2 border-[#C9A96E]/50 shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#C9A96E]/20 flex items-center justify-center shrink-0">
              <span className="text-3xl font-bold text-[#C9A96E]/80">
                {(creatorName || "C").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <p className="text-white font-semibold text-base truncate max-w-[80%]">{creatorName}</p>
          {connecting ? (
            <>
              <div className="w-8 h-8 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
              <span className="text-white/60 text-sm">Connecting to live...</span>
            </>
          ) : (
            <span className="text-white/50 text-sm">Connecting to live...</span>
          )}
        </div>
      )}

      {/* Top: LIVE badge + viewer count */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 pt-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 8px) + 8px)" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/90">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white text-[10px] font-bold">LIVE</span>
          </div>
          <div className="px-2 py-1 rounded-md bg-black/50 text-white/90 text-[10px] font-semibold">
            {formattedViewers} watching
          </div>
        </div>
      </div>

      {/* Bottom: creator name + Tap to Watch full screen */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3 pb-safe bg-gradient-to-t from-black/80 to-transparent pt-12">
        <p className="text-white font-bold text-sm truncate mb-2">{creatorName}</p>
        <button
          type="button"
          onClick={() => navigate(`/watch/${streamKey}`)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-500 hover:bg-red-600 active:scale-[0.98] transition-all shadow-lg"
        >
          <Radio size={16} className="text-white" />
          <span className="text-white text-sm font-bold">Watch full screen</span>
        </button>
      </div>
    </div>
  );
}
