import React from 'react';

interface BattleOverlayReadOnlyProps {
  hostScore: number;
  opponentScore: number;
  player3Score?: number;
  player4Score?: number;
  timeLeft: number;
  active: boolean;
}

export function BattleOverlayReadOnly({
  hostScore,
  opponentScore,
  player3Score = 0,
  player4Score = 0,
  timeLeft,
  active
}: BattleOverlayReadOnlyProps) {
  if (!active) return null;

  const totalScore = hostScore + player3Score + opponentScore + player4Score;
  const leftScore = hostScore + player3Score;
  const rightScore = opponentScore + player4Score;
  const leftPercent = totalScore > 0 ? (leftScore / totalScore) * 100 : 50;

  return (
    <>
      {/* Battle Header - Same as LiveStream */}
      <div className="relative z-20 w-full flex-none overflow-hidden" style={{ height: '18px' }}>
        <div className="absolute inset-0 flex">
          <div className="h-full transition-all duration-500 ease-out" style={{ width: `${leftPercent}%`, backgroundImage: 'linear-gradient(90deg, #DC143C, #FF1744, #C41E3A)' }} />
          <div className="h-full flex-1 transition-all duration-500 ease-out" style={{ backgroundImage: 'linear-gradient(90deg, #1E90FF, #4169E1, #0047AB)' }} />
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-between px-2 pointer-events-none">
          <span className="text-white font-black text-[14px] tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{leftScore.toLocaleString()}</span>
          <span className="text-white font-black text-[14px] tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{rightScore.toLocaleString()}</span>
        </div>
      </div>
      
      {/* Battle timer — overlay on top of screen/video */}
      <div className="absolute top-0 left-0 right-0 z-[25] pointer-events-none flex justify-center w-full py-1.5 px-2" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4cm - 10.5mm)' }}>
        <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-full px-2 py-0.5 border border-white/10 shadow-sm">
          <div className="relative w-[16px] h-[16px] flex items-center justify-center">
            <svg viewBox="0 0 40 44" className="absolute inset-0 w-full h-full drop-shadow-md">
              <path d="M20 2 L36 10 L36 26 Q36 38 20 42 Q4 38 4 26 L4 10 Z" fill="url(#vsGradSpecShared)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
              <defs><linearGradient id="vsGradSpecShared" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#DC143C"/><stop offset="50%" stopColor="#8B0000"/><stop offset="100%" stopColor="#1E90FF"/></linearGradient></defs>
            </svg>
            <span className="relative z-10 text-white text-[5px] font-black italic drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">VS</span>
          </div>
          <span className="text-white text-[10px] font-black tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
        </div>
      </div>
    </>
  );
}