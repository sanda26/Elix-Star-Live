import React from "react";
import { useNavigate } from "react-router-dom";
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
 * Shows a static LIVE preview card in the feed. Tapping opens the full spectator page.
 * NO LiveKit connection — avoids consuming minutes just for feed thumbnails.
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

  const formattedViewers =
    viewerCount >= 1_000_000
      ? (viewerCount / 1_000_000).toFixed(1) + "M"
      : viewerCount >= 1_000
        ? (viewerCount / 1_000).toFixed(1) + "K"
        : String(viewerCount);

  return (
    <div
      className={`relative w-full h-full bg-[#13151A] cursor-pointer ${className}`}
      style={{ background: "#13151A" }}
      onClick={() => navigate(`/watch/${streamKey}`)}
    >
      {/* Static preview: avatar + name */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#13151A] gap-4 pointer-events-none">
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
        <span className="text-white/60 text-sm">Tap to watch live</span>
      </div>

      {/* Top: LIVE badge + viewer count */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 pt-2 pointer-events-none"
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

      {/* Bottom: creator name + tap hint */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3 pb-safe bg-gradient-to-t from-black/80 to-transparent pt-12 pointer-events-none">
        <p className="text-white font-bold text-sm truncate mb-1">{creatorName}</p>
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-red-400" />
          <span className="text-white/70 text-xs font-semibold">Tap to join live</span>
        </div>
      </div>
    </div>
  );
}
