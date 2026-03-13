import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Radio } from "lucide-react";

interface LivePreviewCardProps {
  streamKey: string;
  name: string;
  avatar?: string;
  viewers: number;
  title?: string;
  thumbnail?: string;
  isActive: boolean;
}

export default function LivePreviewCard({
  streamKey,
  name,
  avatar,
  viewers,
  title,
  thumbnail,
  isActive,
}: LivePreviewCardProps) {
  const navigate = useNavigate();
  const [pulse, setPulse] = useState(false);

  // Pulse animation on mount and periodically while active
  useEffect(() => {
    if (!isActive) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 1200);
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 1200);
    }, 4000);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [isActive]);

  const handleTap = () => {
    navigate(`/watch/${streamKey}`);
  };

  const hasRealThumbnail =
    thumbnail && thumbnail.length > 0 && !thumbnail.includes("ui-avatars.com");

  const displayName = name || "Creator";
  const initial = displayName.charAt(0).toUpperCase();

  const formattedViewers =
    viewers >= 1_000_000
      ? (viewers / 1_000_000).toFixed(1) + "M"
      : viewers >= 1_000
        ? (viewers / 1_000).toFixed(1) + "K"
        : String(viewers);

  return (
    <button
      type="button"
      onClick={handleTap}
      className="w-full h-full relative overflow-hidden group"
      style={{ background: "#0A0B0E" }}
      title="Tap to join live"
    >
      {/* ---- Animated border glow ---- */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none rounded-none"
        style={{
          boxShadow: pulse
            ? "inset 0 0 60px rgba(239,68,68,0.25), inset 0 0 120px rgba(239,68,68,0.10)"
            : "inset 0 0 30px rgba(239,68,68,0.08)",
          transition: "box-shadow 0.8s ease-in-out",
        }}
      />

      {/* ---- Top red live border strip ---- */}
      <div
        className="absolute top-0 left-0 right-0 z-[3] h-[3px]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #ef4444 20%, #f87171 50%, #ef4444 80%, transparent 100%)",
          animation: "liveShimmer 2s ease-in-out infinite",
        }}
      />

      {/* ---- Background ---- */}
      {hasRealThumbnail ? (
        <>
          <img
            src={thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover z-[2]"
          />
          <div
            className="absolute inset-0 z-[2]"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.85) 100%)",
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0 z-[2]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, #1a1c24 0%, #0f1015 50%, #0A0B0E 100%)",
          }}
        />
      )}

      {/* ---- Ambient animated rings (no-thumbnail only) ---- */}
      {!hasRealThumbnail && (
        <div className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none overflow-hidden">
          <div
            className="absolute rounded-full border border-red-500/10"
            style={{
              width: 300,
              height: 300,
              animation: "livePulseRing 3s ease-out infinite",
            }}
          />
          <div
            className="absolute rounded-full border border-red-500/10"
            style={{
              width: 300,
              height: 300,
              animation: "livePulseRing 3s ease-out infinite 1s",
            }}
          />
          <div
            className="absolute rounded-full border border-red-500/10"
            style={{
              width: 300,
              height: 300,
              animation: "livePulseRing 3s ease-out infinite 2s",
            }}
          />
        </div>
      )}

      {/* ---- Top badges row: LIVE + Viewers ---- */}
      <div
        className="absolute z-[10] flex items-center gap-2"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 56px)",
          left: 16,
        }}
      >
        {/* LIVE badge */}
        <div
          className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-md"
          style={{
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            boxShadow:
              "0 2px 12px rgba(239,68,68,0.5), 0 0 20px rgba(239,68,68,0.2)",
          }}
        >
          <span
            className="block w-2 h-2 rounded-full bg-white"
            style={{ animation: "liveDot 1.2s ease-in-out infinite" }}
          />
          <span className="text-white text-[11px] font-extrabold tracking-wider">
            LIVE
          </span>
        </div>

        {/* Viewer count */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/50 backdrop-blur-md border border-white/10">
          <Eye size={12} className="text-white/80" />
          <span className="text-white text-[11px] font-semibold">
            {formattedViewers}
          </span>
        </div>
      </div>

      {/* ---- Center content ---- */}
      <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center px-8">
        {/* Avatar */}
        <div
          className="relative mb-5"
          style={{
            width: 110,
            height: 110,
          }}
        >
          {/* Pulsing red ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: "3px solid #ef4444",
              animation: "liveAvatarPulse 2s ease-in-out infinite",
            }}
          />

          {/* Inner avatar circle */}
          <div
            className="absolute rounded-full overflow-hidden bg-[#1C1E24]"
            style={{
              top: 6,
              left: 6,
              right: 6,
              bottom: 6,
            }}
          >
            {avatar ? (
              <img
                src={avatar}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span
                  className="font-bold"
                  style={{
                    fontSize: 40,
                    color: "#C9A96E",
                  }}
                >
                  {initial}
                </span>
              </div>
            )}
          </div>

          {/* Small LIVE tag below avatar */}
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-white text-[9px] font-bold tracking-wider"
            style={{
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              boxShadow: "0 2px 8px rgba(239,68,68,0.4)",
            }}
          >
            LIVE
          </div>
        </div>

        {/* Creator name */}
        <h3
          className="text-white font-bold text-lg mb-1.5 text-center truncate max-w-full drop-shadow-lg"
          style={{ textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}
        >
          {displayName}
        </h3>

        {/* Title if present */}
        {title && (
          <p className="text-white/70 text-sm text-center line-clamp-2 max-w-[280px] mb-4 drop-shadow">
            {title}
          </p>
        )}

        {/* CTA button */}
        <div
          className="mt-3 px-8 py-2.5 rounded-full flex items-center gap-2 transition-transform active:scale-95"
          style={{
            background:
              "linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)",
            boxShadow:
              "0 4px 20px rgba(239,68,68,0.4), 0 0 40px rgba(239,68,68,0.15)",
          }}
        >
          <Radio size={16} className="text-white" />
          <span className="text-white text-sm font-bold tracking-wide">
            Tap to Watch
          </span>
        </div>
      </div>

      {/* ---- Bottom gradient info bar (when thumbnail exists) ---- */}
      {hasRealThumbnail && (
        <div className="absolute bottom-0 left-0 right-0 z-[6] pointer-events-none">
          <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-24 pb-24 px-5">
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-10 h-10 rounded-full border-2 border-red-500/60 overflow-hidden bg-[#1a1a2e] flex-shrink-0">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[#C9A96E] font-bold text-sm">
                      {initial}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-white font-bold text-base drop-shadow-lg truncate">
                  {displayName}
                </span>
                {title && (
                  <span className="text-white/60 text-xs drop-shadow truncate">
                    {title}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Keyframe animations (injected once) ---- */}
      <style>{`
        @keyframes liveDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes livePulseRing {
          0% { transform: scale(0.4); opacity: 0.5; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes liveAvatarPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
        }
        @keyframes liveShimmer {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </button>
  );
}
