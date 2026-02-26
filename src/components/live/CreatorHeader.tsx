import React from 'react';
import { Heart, Eye, UserPlus, Trophy, X } from 'lucide-react';
import { AvatarRing } from '../AvatarRing';

interface CreatorHeaderProps {
  hostName: string;
  hostAvatar: string;
  activeLikes: number;
  viewerCount: number;
  isFollowing: boolean;
  onFollow: () => void;
  onProfileClick: () => void;
  onShowRanking: () => void;
  onShowFanClub: () => void;
  onShowViewers: () => void;
  onClose?: () => void;
}

export function CreatorHeader({
  hostName,
  hostAvatar,
  activeLikes,
  viewerCount,
  isFollowing,
  onFollow,
  onProfileClick,
  onShowRanking,
  onShowFanClub,
  onShowViewers,
  onClose
}: CreatorHeaderProps) {
  return (
    <div className="absolute top-0 left-0 right-0 z-[110] pointer-events-none">
      <div className="px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}>
        <div className="flex items-center justify-between gap-2">
          {/* Left: Creator info */}
          <div className="pointer-events-auto flex items-center gap-0 -ml-1 flex-shrink min-w-0">
            <div
              className="relative z-10 flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
              onClick={onProfileClick}
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
                <span className="text-white/70 text-[8px] font-bold tabular-nums">{(typeof activeLikes === 'number' && Number.isFinite(activeLikes) ? activeLikes : 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Right: viewer count + close */}
          <div className="pointer-events-auto flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#13151A]/70 border border-white/10 active:scale-95 transition-transform"
              onClick={onShowViewers}
            >
              <Eye size={12} className="text-white/60" />
              <span className="text-white text-[11px] font-bold tabular-nums">
                {viewerCount >= 1000 ? (viewerCount / 1000).toFixed(1) + 'K' : viewerCount}
              </span>
              <UserPlus size={10} className="text-[#C9A96E]" />
            </button>
            {onClose && (
              <button
                type="button"
                title="Leave stream"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#13151A]/60 border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
              >
                <X size={16} className="text-white/80" />
              </button>
            )}
          </div>
        </div>

        {/* Weekly Ranking + Membership + Follow */}
        <div className="flex items-center gap-2 mt-1 ml-1 pointer-events-auto flex-wrap px-1">
          <div
            className="flex items-center gap-1 bg-[#13151A] rounded-full px-2 py-0.5 border border-[#C9A96E]/40 shadow-sm cursor-pointer active:scale-95 transition-transform"
            onClick={onShowRanking}
          >
            <Trophy className="w-2.5 h-2.5 text-[#C9A96E]" />
            <span className="text-[#C9A96E] text-[9px] font-bold whitespace-nowrap">Weekly Ranking &gt;</span>
          </div>
          <div
            className="flex items-center gap-1 bg-[#13151A] rounded-full px-2 py-0.5 border border-[#C9A96E]/40 shadow-sm cursor-pointer active:scale-95 transition-transform"
            onClick={onShowFanClub}
          >
            <Heart className="w-2.5 h-2.5 text-[#C9A96E] fill-[#C9A96E]" />
            <span className="text-[#C9A96E] text-[9px] font-bold whitespace-nowrap">Membership</span>
          </div>
          {!isFollowing && (
            <button
              type="button"
              className="flex items-center gap-1 bg-[#FF2D55] rounded-full px-2 py-0.5 shadow-sm border border-white/20 active:scale-95 transition-transform"
              onClick={onFollow}
            >
              <UserPlus size={10} className="text-white" strokeWidth={3} />
              <span className="text-white text-[9px] font-bold">Follow</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}