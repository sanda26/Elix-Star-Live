import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LivePreviewCard from "../components/LivePreviewCard";
import EnhancedVideoPlayer from "../components/EnhancedVideoPlayer";
import { useVideoStore } from "../store/useVideoStore";
import { useAuthStore } from "../store/useAuthStore";
import { apiUrl, getWsUrl } from "../lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type LiveStreamCard = {
  streamKey: string;
  name: string;
  avatar?: string;
  viewers: number;
  title?: string;
  thumbnail?: string;
  userId?: string;
};

/** Backend may return snake_case (Express) or camelCase (Fastify); we accept both. */
interface RawStream {
  stream_key?: string;
  streamKey?: string;
  room_id?: string;
  roomId?: string;
  id?: string;
  user_id?: string;
  userId?: string;
  hostUserId?: string;
  title?: string;
  display_name?: string;
  displayName?: string;
  viewer_count?: number;
  viewerCount?: number;
}

type FeedItem =
  | { kind: "live"; stream: LiveStreamCard }
  | { kind: "video"; videoId: string };

/* When a live item is focused in For You, immediately join the live room */
function AutoJoinLiveSlide({
  streamKey,
  index,
  activeIndex,
}: {
  streamKey: string;
  index: number;
  activeIndex: number;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (activeIndex === index && streamKey) {
      navigate(`/watch/${streamKey}`, { replace: false });
    }
  }, [activeIndex, index, navigate, streamKey]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  Lightweight per-room WebSocket monitor                             */
/*  Opens a subscribe-only WS to each active room so we receive       */
/*  "stream_ended" the instant the host disconnects — no polling lag.  */
/* ------------------------------------------------------------------ */

class RoomMonitor {
  private sockets = new Map<string, WebSocket>();
  private onStreamEnded: (streamKey: string) => void;
  private token: string;

  constructor(token: string, onStreamEnded: (streamKey: string) => void) {
    this.token = token;
    this.onStreamEnded = onStreamEnded;
  }

  /** Reconcile: open sockets for new rooms, close sockets for removed rooms */
  sync(activeKeys: string[]) {
    const desired = new Set(activeKeys);

    // Close sockets for rooms no longer active
    for (const [key, ws] of this.sockets) {
      if (!desired.has(key)) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        this.sockets.delete(key);
      }
    }

    // Open sockets for new rooms
    for (const key of activeKeys) {
      if (this.sockets.has(key)) continue;
      this.openSocket(key);
    }
  }

  private openSocket(roomKey: string) {
    if (!this.token) return;
    try {
      const wsUrl = getWsUrl();
      const ws = new WebSocket(
        `${wsUrl}/live/${roomKey}?token=${encodeURIComponent(this.token)}`,
      );

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.event === "stream_ended") {
            this.onStreamEnded(msg.data?.stream_key || roomKey);
          }
        } catch {
          /* malformed frame */
        }
      };

      ws.onerror = () => {
        /* silent */
      };

      ws.onclose = () => {
        // Only delete if this exact socket is still the one we're tracking
        if (this.sockets.get(roomKey) === ws) {
          this.sockets.delete(roomKey);
        }
      };

      // Send keepalive to prevent server-side timeout
      const keepAlive = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        } else {
          clearInterval(keepAlive);
        }
      }, 25_000);

      this.sockets.set(roomKey, ws);
    } catch {
      /* connection failed — polling is still the fallback */
    }
  }

  destroy() {
    for (const [, ws] of this.sockets) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    this.sockets.clear();
  }
}

/** Map stream_started payload from server to LiveStreamCard */
function streamStartedToCard(data: Record<string, unknown>): LiveStreamCard {
  const key = (data.stream_key ?? data.room_id ?? "") as string;
  const userId = (data.user_id ?? "") as string;
  const title = (data.title ?? data.display_name ?? "") as string;
  const label = userId ? String(userId).slice(0, 8) : "Creator";
  return {
    streamKey: key,
    name: title || label,
    avatar: userId
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=121212&color=C9A96E`
      : "",
    viewers: 0,
    title: title || undefined,
    thumbnail: "",
    userId,
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function VideoFeed() {
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [liveStreams, setLiveStreams] = useState<LiveStreamCard[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const removedKeysRef = useRef<Set<string>>(new Set());
  const monitorRef = useRef<RoomMonitor | null>(null);

  const session = useAuthStore((s) => s.session);
  const token = session?.access_token || "";

  const { videos, fetchVideos, loading: videosLoading } = useVideoStore();

  /* ---- Remove a live stream instantly ---- */
  const removeLiveStream = useCallback((streamKey: string) => {
    removedKeysRef.current.add(streamKey);
    setLiveStreams((prev) => prev.filter((s) => s.streamKey !== streamKey));
    // Keep it suppressed for 20s so polling doesn't re-add a stale entry
    setTimeout(() => removedKeysRef.current.delete(streamKey), 20_000);
  }, []);

  /* ---- Fetch live streams from REST ---- */
  const fetchLiveStreams = useCallback(async () => {
    try {
      const url = apiUrl("/api/live/streams");
      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        setLiveStreams([]);
        setLiveLoading(false);
        return;
      }

      const body = await res
        .json()
        .catch(() => ({ streams: [] as RawStream[] }));
      const streams: RawStream[] = Array.isArray(body.streams)
        ? (body.streams as RawStream[])
        : [];

      // When API returns [], still merge with prev so streams from stream_started stay visible
      const removed = removedKeysRef.current;
      const mapped: LiveStreamCard[] = streams
        .filter((s: RawStream) => {
          const key =
            s.stream_key ?? s.streamKey ?? s.room_id ?? s.roomId ?? s.id;
          return key && !removed.has(key);
        })
        .map((s: RawStream) => {
          const key =
            s.stream_key ?? s.streamKey ?? s.room_id ?? s.roomId ?? s.id;
          const userId =
            s.user_id ?? s.userId ?? s.hostUserId ?? "";
          const title =
            s.title ?? s.display_name ?? s.displayName ?? undefined;
          const label = userId ? String(userId).slice(0, 8) : "Creator";
          const viewers = Number(
            s.viewer_count ?? s.viewerCount ?? 0
          );
          return {
            streamKey: key,
            name: title || label,
            avatar: userId
              ? `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=121212&color=C9A96E`
              : "",
            viewers,
            title: title || undefined,
            thumbnail: "",
            userId,
          } as LiveStreamCard;
        });

      // Merge with current list so streams added by stream_started (realtime) don't disappear
      // when the poll runs before LiveKit has the room (creator still connecting)
      setLiveStreams((prev) => {
        const fromApi = new Set(mapped.map((s) => s.streamKey));
        const keptFromPrev = prev.filter(
          (s) => !fromApi.has(s.streamKey) && !removed.has(s.streamKey)
        );
        const merged = [...mapped, ...keptFromPrev];
        if (monitorRef.current) {
          monitorRef.current.sync(merged.map((s) => s.streamKey));
        }
        return merged;
      });
    } catch {
      setLiveStreams([]);
    }
    setLiveLoading(false);
  }, []);

  /* ---- Bootstrap: polling + WebSocket monitor ---- */
  useEffect(() => {
    // Initial loads
    setLiveLoading(true);
    fetchLiveStreams();
    fetchVideos();

    // Poll every 3 seconds for fast discovery of NEW streams
    const poll = setInterval(fetchLiveStreams, 3_000);

    // Create room monitor for instant stream_ended detection
    if (token) {
      monitorRef.current = new RoomMonitor(token, (endedKey) => {
        removeLiveStream(endedKey);
      });
    }

    return () => {
      clearInterval(poll);
      monitorRef.current?.destroy();
      monitorRef.current = null;
    };
  }, [fetchLiveStreams, fetchVideos, removeLiveStream, token]);

  /* ---- Feed channel: when a creator starts live, they appear on For You immediately; reconnect on close ---- */
  useEffect(() => {
    if (!token) return;
    const wsUrl = getWsUrl();
    const url = `${wsUrl}/live/__feed__?token=${encodeURIComponent(token)}`;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      try {
        ws = new WebSocket(url);
      } catch {
        reconnectTimer = setTimeout(connect, 3000);
        return;
      }
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const event = msg?.event;
          const data = msg?.data || {};
          if (event === "stream_started") {
            const key = (data.stream_key ?? data.room_id) as string;
            if (!key) return;
            if (removedKeysRef.current.has(key)) return;
            setLiveStreams((prev) => {
              if (prev.some((s) => s.streamKey === key)) return prev;
              const next = [streamStartedToCard(data), ...prev];
              const keys = next.map((s) => s.streamKey);
              queueMicrotask(() => monitorRef.current?.sync(keys));
              return next;
            });
          } else if (event === "stream_ended") {
            const key = (data.stream_key ?? data.room_id) as string;
            if (key) removeLiveStream(key);
          }
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        ws = null;
        if (!cancelled) reconnectTimer = setTimeout(connect, 3000);
      };
    }
    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        if (ws) ws.close();
      } catch {}
    };
  }, [token, removeLiveStream]);

  /* ---- Re-fetch when navigating back to /feed ---- */
  useEffect(() => {
    if (location.pathname === "/feed") {
      setActiveIndex(0);
      fetchLiveStreams();
      fetchVideos();
      setTimeout(() => {
        containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
      }, 0);
    }
  }, [location.pathname, fetchLiveStreams, fetchVideos]);

  /* ---- Build unified feed: live streams first, then videos ---- */
  const feedItems: FeedItem[] = [
    ...liveStreams.map((stream): FeedItem => ({ kind: "live", stream })),
    ...videos.map((v): FeedItem => ({ kind: "video", videoId: v.id })),
  ];

  /* ---- Scroll handling ---- */
  const handleScroll = () => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const index = Math.round(container.scrollTop / container.clientHeight);
    if (index >= 0 && index < feedItems.length) {
      setActiveIndex(index);
    }
  };

  const handleVideoEnd = (index: number) => {
    if (!containerRef.current || index >= feedItems.length - 1) return;
    containerRef.current.scrollTo({
      top: (index + 1) * containerRef.current.clientHeight,
      behavior: "smooth",
    });
  };

  /* ---- Keep activeIndex in bounds when items are removed ---- */
  const prevCountRef = useRef(feedItems.length);
  useEffect(() => {
    const prev = prevCountRef.current;
    const cur = feedItems.length;
    prevCountRef.current = cur;
    if (cur < prev && activeIndex >= cur && cur > 0) {
      setActiveIndex(cur - 1);
      containerRef.current?.scrollTo({
        top: (cur - 1) * (containerRef.current?.clientHeight || 0),
        behavior: "smooth",
      });
    }
  }, [feedItems.length, activeIndex]);

  const loading = liveLoading && videosLoading;

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */
  return (
    <div
      ref={containerRef}
      className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory relative bg-[#0A0B0E]"
      style={{ scrollSnapType: "y mandatory" }}
      onScroll={handleScroll}
    >
      {/* ---- Top Navigation Bar ---- */}
      <div
        className="fixed left-0 right-0 z-[9999] flex justify-center pointer-events-none"
        style={{ top: "calc(var(--safe-top) + 2px)" }}
      >
        <div className="w-full max-w-[480px] relative px-2">
          <div
            className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-[200%] rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(201,169,110,0.15) 0%, rgba(201,169,110,0.05) 40%, transparent 70%)",
            }}
          />
          <div className="relative w-full">
            <img
              src="/Icons/topbar.png"
              alt="Navigation"
              className="w-full h-auto pointer-events-none"
              style={{
                filter:
                  "drop-shadow(0 0 20px rgba(201,169,110,0.4)) drop-shadow(0 4px 30px rgba(201,169,110,0.2)) drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
              }}
            />
            <div className="absolute inset-0 flex items-center pointer-events-auto z-10">
              <button
                type="button"
                onClick={() => navigate("/live", { replace: true })}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "13%", minWidth: 0 }}
                title="Live"
              />
              <button
                type="button"
                onClick={() => navigate("/stem")}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "12%", minWidth: 0 }}
                title="STEM"
              />
              <button
                type="button"
                onClick={() => navigate("/discover")}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "15%", minWidth: 0 }}
                title="Explore"
              />
              <button
                type="button"
                onClick={() => navigate("/following")}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "18%", minWidth: 0 }}
                title="Following"
              />
              <button
                type="button"
                onClick={() => navigate("/shop")}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "12%", minWidth: 0 }}
                title="Shop"
              />
              <button
                type="button"
                onClick={() => navigate("/feed", { replace: true })}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "15%", minWidth: 0 }}
                title="For You"
              />
              <button
                type="button"
                onClick={() => navigate("/search")}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "15%", minWidth: 0 }}
                title="Search"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Feed items: live streams first, then videos                  */}
      {/* ============================================================ */}
      {feedItems.map((item, index) => {
        if (item.kind === "live") {
          return (
            <div
              key={`live-${item.stream.streamKey}`}
              className="h-[100dvh] w-full snap-start relative flex justify-center bg-[#0A0B0E]"
              style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
            >
              {/* As soon as this slide is focused, jump straight into the live room */}
              <AutoJoinLiveSlide
                streamKey={item.stream.streamKey}
                index={index}
                activeIndex={activeIndex}
              />
              <div className="w-full max-w-[480px] h-full relative flex items-center justify-center">
                <LivePreviewCard
                  streamKey={item.stream.streamKey}
                  name={item.stream.name}
                  avatar={item.stream.avatar}
                  viewers={item.stream.viewers}
                  title={item.stream.title}
                  thumbnail={item.stream.thumbnail}
                  isActive={activeIndex === index}
                />
              </div>
            </div>
          );
        }

        return (
          <div
            key={`video-${item.videoId}-${index}`}
            className="h-[100dvh] w-full snap-start relative flex justify-center bg-[#0A0B0E]"
            style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
          >
            <div className="w-full max-w-[480px] h-full relative">
              <EnhancedVideoPlayer
                videoId={item.videoId}
                isActive={activeIndex === index}
                onVideoEnd={() => handleVideoEnd(index)}
              />
            </div>
          </div>
        );
      })}

      {/* ---- Loading spinner ---- */}
      {loading && feedItems.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ---- Empty state: For You is for watching only — no "go live" here ---- */}
      {!loading && feedItems.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
          <div className="w-20 h-20 rounded-full bg-[#13151A] border border-white/10 flex items-center justify-center mb-4 pointer-events-none">
            <span className="text-3xl">📡</span>
          </div>
          <p className="text-white/60 font-semibold text-base mb-1 text-center">
            Nothing here yet
          </p>
          <p className="text-white/30 text-sm mb-4 text-center">
            No live streams or videos right now. When creators go live, they appear here in real time. Check back soon!
          </p>
          <button
            type="button"
            onClick={() => {
              setLiveLoading(true);
              fetchLiveStreams();
              fetchVideos();
            }}
            className="px-5 py-2 bg-white/10 border border-white/20 rounded-full text-white/80 text-sm font-bold active:scale-95 transition-transform"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
