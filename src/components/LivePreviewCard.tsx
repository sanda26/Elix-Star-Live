import React from 'react';
import { useNavigate } from 'react-router-dom';

interface LivePreviewCardProps {
  streamKey: string;
  name: string;
  avatar?: string;
  viewers: number;
  title?: string;
  isActive: boolean;
}

export default function LivePreviewCard({
  streamKey,
  name,
  avatar,
  viewers,
  title,
}: LivePreviewCardProps) {
  const navigate = useNavigate();

  const handleTap = () => {
    navigate(`/watch/${streamKey}`);
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      className="w-full h-full relative bg-black overflow-hidden"
      title="Tap to join live"
    >
      {/* Full-screen background with creator avatar */}
      <div className="absolute inset-0 flex items-center justify-center">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="w-full h-full object-cover blur-2xl scale-110 opacity-40"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-[#1a1a2e] to-[#0a0b0e]" />
        )}
      </div>

      {/* Center: Creator avatar + LIVE pulse */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-5">
        <div className="relative">
          <div className="absolute -inset-3 rounded-full border-2 border-red-500/40 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute -inset-1.5 rounded-full border border-red-500/60 animate-pulse" />
          <div className="w-28 h-28 rounded-full border-[3px] border-red-500 overflow-hidden shadow-[0_0_40px_rgba(239,68,68,0.4)] relative z-10 bg-[#1a1a2e]">
            {avatar ? (
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[#C9A96E] font-bold text-4xl">{name.slice(0, 1).toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-white font-bold text-lg drop-shadow-lg">{name}</p>
          {title && (
            <p className="text-white/70 text-sm max-w-[250px] text-center line-clamp-2 drop-shadow-md">{title}</p>
          )}
        </div>

        {/* Tap to watch label */}
        <div className="mt-2 px-6 py-2.5 rounded-full bg-red-500/90 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
          <span className="text-white text-sm font-bold tracking-wide">Tap to watch LIVE</span>
        </div>
      </div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-[2] pointer-events-none" />

      {/* Bottom info bar */}
      <div className="absolute bottom-16 left-0 right-0 z-[5] px-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/90">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-white text-[11px] font-bold">LIVE</span>
          </div>
          {viewers > 0 && (
            <div className="px-2.5 py-1 rounded bg-white/15 backdrop-blur-sm">
              <span className="text-white text-[11px] font-semibold">
                {viewers >= 1000 ? (viewers / 1000).toFixed(1) + 'K' : viewers} watching
              </span>
            </div>
          )}
        </div>
        <p className="text-white font-bold text-[15px] drop-shadow-lg">{name}</p>
        {title && (
          <p className="text-white/80 text-[13px] mt-0.5 drop-shadow-md line-clamp-2">{title}</p>
        )}
      </div>
    </button>
  );
}
