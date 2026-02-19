import React, { useState, useEffect } from 'react';
import { LevelBadge } from '../components/LevelBadge';
import { fetchGiftsFromDatabase } from '../lib/giftsCatalog';

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-transparent border border-transparent rounded-xl px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white">{name}</div>
        <div className="text-xs text-white/60 truncate">{value}</div>
      </div>
      <div className="w-10 h-10 rounded-lg border border-white/10" style={{ background: value }} />
    </div>
  );
}

export default function DesignSystem() {
  const [smallGifts, setSmallGifts] = useState<any[]>([]);

  useEffect(() => {
    fetchGiftsFromDatabase().then(gifts => {
      setSmallGifts(gifts.filter((g) => g.giftType === 'small'));
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-text pb-28 pt-6 flex justify-center">
      <div className="w-full max-w-[900px] px-4">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-2xl font-extrabold">Design System</div>
            <div className="text-sm text-text-muted">Preview tokens and UI components</div>
          </div>
          <div className="text-xs text-white/60">/design</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Swatch name="Background" value="var(--color-background)" />
          <Swatch name="Surface" value="var(--color-surface)" />
          <Swatch name="Text" value="var(--color-text)" />
          <Swatch name="Secondary" value="var(--color-secondary)" />
        </div>

        <div className="bg-transparent border border-transparent rounded-2xl p-5 mb-8">
          <div className="text-sm font-bold text-white mb-3">Level Badges</div>
          <div className="flex flex-wrap items-center gap-3">
            <LevelBadge level={11} size={10} layout="fixed" />
            <LevelBadge level={22} size={10} layout="fixed" />
            <LevelBadge level={39} size={10} layout="fixed" />
            <LevelBadge level={79} size={10} layout="fixed" />
            <LevelBadge level={116} size={10} layout="fixed" />
          </div>
          <div className="mt-4 text-xs text-white/60">
            Sizes: 40 (chat), 56 (standard), 64 (hero) • fixed vs fit
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <LevelBadge level={11} size={10} layout="fixed" />
            <LevelBadge level={79} size={10} layout="fixed" />
            <LevelBadge level={116} size={10} layout="fixed" />
            <LevelBadge level={22} size={10} layout="fixed" />
            <LevelBadge level={39} size={10} layout="fixed" />
          </div>
        </div>

        <div className="bg-transparent border border-transparent rounded-2xl p-5">
          <div className="flex items-end justify-between gap-4 mb-3">
            <div className="text-sm font-bold text-white">Small Gifts</div>
            <div className="text-xs text-white/60">{smallGifts.length} items</div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {smallGifts.map((g) => (
              <div key={g.id} className="flex flex-col items-center gap-1">
                <div className="w-14 h-14 rounded-2xl bg-[#13151A] border border-transparent flex items-center justify-center overflow-hidden">
                  <img src={g.icon} alt={g.name} className="w-full h-full object-contain" />
                </div>
                <div className="text-[11px] text-white/90 font-semibold text-center truncate w-full">{g.name}</div>
                <div className="text-[10px] text-secondary font-bold">{g.coins}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
