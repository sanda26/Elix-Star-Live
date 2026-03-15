import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';

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
  name,
  avatar,
  viewers,
  title,
  thumbnail,
}: LivePreviewCardProps) {
  const navigate = useNavigate();
  const [liveThumb, setLiveThumb] = useState(thumbnail || '');

  useEffect(() => {
    if (thumbnail) setLiveThumb(thumbnail);
  }, [thumbnail]);

  const handleTap = () => {
    navigate(`/watch/${streamKey}`);
  };

  const previewImg = liveThumb || avatar;
  const displayName = name || 'Creator';
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <button
      type="button"
      onClick={handleTap}
      className="w-full h-full relative bg-black overflow-hidden"
      title="Tap to join live"
    >
      {/* Live thumbnail — full screen */}
      {previewImg ? (
        <img
          src={previewImg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover z-[1]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e] to-[#0a0b0e] z-[1] flex items-center justify-center">
          <div className="w-20 h-20 rounded-full border-[3px] border-red-500 overflow-hidden bg-[#1a1a2e]">
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[#C9A96E] font-bold text-2xl">{initial}</span>
            </div>
          </div>
        </div>
      )}

      {/* LIVE badge + viewers */}
      <div className="absolute top-[calc(env(safe-area-inset-top,0px)+50px)] left-3 z-[10] flex items-center gap-1.5">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/90">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-white text-[10px] font-bold">LIVE</span>
        </div>
        {viewers > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm">
            <Eye size={10} className="text-white/70" />
            <span className="text-white text-[10px] font-semibold">
              {viewers >= 1000 ? (viewers / 1000).toFixed(1) + 'K' : viewers}
            </span>
          </div>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 z-[5] pointer-events-none">
        <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 pb-20 px-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full border border-white/30 overflow-hidden bg-[#1a1a2e] flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[#C9A96E] font-bold text-xs">{initial}</span>
                </div>
              )}
            </div>
            <span className="text-white font-bold text-sm drop-shadow-lg">{displayName}</span>
          </div>
          {title && (
            <p className="text-white/80 text-xs mt-0.5 drop-shadow-md line-clamp-2 ml-10">{title}</p>
          )}
        </div>
      </div>
    </button>
  );
}
