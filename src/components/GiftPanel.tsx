import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Gift, Coins } from 'lucide-react';
import { IS_STORE_BUILD } from '@/config/build';
import { BuyCoinsModal } from './BuyCoinsModal';
import { GIFTS } from '../lib/gifts';

interface GiftPanelProps {
  onSelectGift: (gift: typeof GIFTS[0]) => void;
  userCoins: number;
  onRechargeSuccess?: (newBalance: number) => void;
}

function useInView<T extends Element>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, options);

    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  return { ref, inView };
}

export function GiftPanel({ onSelectGift, userCoins, onRechargeSuccess }: GiftPanelProps) {
  const [activeTab, setActiveTab] = useState<'exclusive' | 'small' | 'big'>('big');
  const [_activeGiftId, setActiveGiftId] = useState<string | null>(null);
  const [poppedGiftId, setPoppedGiftId] = useState<string | null>(null);
  const [showRecharge, setShowRecharge] = useState(false);
  const { ref: panelRef, inView } = useInView<HTMLDivElement>({ root: null, threshold: 0.05 });

  const universeGift = useMemo(() => GIFTS.find((g) => g.giftType === 'universe'), []);
  const bigGifts = useMemo(() => GIFTS.filter((g) => g.giftType === 'big'), []);
  const smallGifts = useMemo(() => GIFTS.filter((g) => g.giftType === 'small'), []);

  const posterByGiftId = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const g of GIFTS) {
      // Use icon as the primary static image for the panel
      // Video is only used for overlay playback
      map.set(g.id, g.icon);
    }
    return map;
  }, []);

  useEffect(() => {
    if (!inView) return;
    const first = activeTab === 'exclusive' ? (universeGift ?? bigGifts[0]) : smallGifts[0];
    if (!first) return;
    setActiveGiftId((prev) => prev ?? first.id);
  }, [bigGifts, inView, universeGift, smallGifts, activeTab]);

  return (
    <div ref={panelRef} className="bg-[#1a1a1a]/95 rounded-t-2xl p-3 pb-safe max-h-[40dvh] overflow-y-auto no-scrollbar shadow-2xl w-full relative z-[99999]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Gift className="text-yellow-400" size={16} /> 
          Send Gift
        </h3>
        <div className="flex items-center gap-2 bg-black px-2.5 py-0.5 rounded-full border border-secondary/20">
            <Coins size={13} className="text-secondary" />
            <span className="text-secondary font-bold text-xs">{userCoins.toLocaleString()}</span>
            {!IS_STORE_BUILD && (
                <button 
                onClick={() => setShowRecharge(true)}
                className="bg-secondary text-black text-[9px] font-bold px-1.5 py-0.5 rounded ml-2 hover:bg-white transition"
                >
                Top Up
                </button>
            )}
            </div>
      </div>

      <BuyCoinsModal
        isOpen={showRecharge}
        onClose={() => setShowRecharge(false)}
        onSuccess={(coins) => {
          if (onRechargeSuccess) onRechargeSuccess(userCoins + coins);
        }}
      />

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-2 px-1">
        <button 
            className={`text-xs font-medium pb-1.5 transition-colors relative ${activeTab === 'small' ? 'text-yellow-400' : 'text-white/50 hover:text-white/80'}`}
            onClick={() => setActiveTab('small')}
        >
            Small Gift
            {activeTab === 'small' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-400 rounded-t-full" />}
        </button>
        <button 
            className={`text-xs font-medium pb-1.5 transition-colors relative ${activeTab === 'exclusive' ? 'text-yellow-400' : 'text-white/50 hover:text-white/80'}`}
            onClick={() => setActiveTab('exclusive')}
        >
            Exclusive Gift
            {activeTab === 'exclusive' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-secondary rounded-t-full" />}
        </button>
        <button 
            className={`text-sm font-bold pb-2 transition-colors relative ${activeTab === 'big' ? 'text-secondary' : 'text-white/50 hover:text-white/80'}`}
            onClick={() => setActiveTab('big')}
        >
            Big Gift
            {activeTab === 'big' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-secondary rounded-t-full" />}
        </button>
      </div>

      {activeTab === 'exclusive' && (
        <div className="animate-fade-in">
          {universeGift && (
            <div className="mb-4">
              <div className="grid grid-cols-4 gap-2">
                <button
                  key={universeGift.id}
                  onClick={() => {
                    if (!universeGift) return;
                    setPoppedGiftId(universeGift.id);
                    window.setTimeout(() => setPoppedGiftId((v) => (v === universeGift.id ? null : v)), 520);
                    onSelectGift(universeGift);
                  }}
                  onMouseEnter={() => universeGift && setActiveGiftId(universeGift.id)}
                  onMouseLeave={() => universeGift && setActiveGiftId((v) => (v === universeGift.id ? null : v))}
                  className="group flex flex-col items-center gap-1.5 p-1 rounded-xl hover:brightness-125 border border-secondary/30 transition-all duration-300 active:scale-95 relative overflow-hidden z-[99999]"
                >
                  <div
                    className={[
                      "w-full aspect-square flex items-center justify-center bg-transparent rounded-2xl shadow-inner group-hover:shadow-secondary/20 transition-all overflow-hidden relative elix-gift-idle border border-transparent",
                      poppedGiftId === universeGift.id ? "elix-gift-pop" : "",
                    ].join(" ")}
                  >
                    <img
                      src={posterByGiftId.get(universeGift.id) || ""}
                      alt=""
                      className="w-full h-full object-contain p-1 pointer-events-none"
                    />
                  </div>
                  <div className="text-center z-10">
                    <p className="text-[10px] text-white/90 font-medium truncate w-full mb-0.5 group-hover:text-white">
                      {universeGift.name}
                    </p>
                    <div className="flex items-center justify-center gap-1">
                      <Coins size={9} className="text-secondary" />
                      <p className="text-[10px] text-secondary font-bold">{universeGift.coins.toLocaleString()}</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'big' && (
        <div className="animate-fade-in">
          <div>
            <div className="grid grid-cols-4 gap-2">
              {bigGifts.map((gift, idx) => (
                <button
                  key={gift.id}
                  onClick={() => {
                    setPoppedGiftId(gift.id);
                    window.setTimeout(() => setPoppedGiftId((v) => (v === gift.id ? null : v)), 520);
                    onSelectGift(gift);
                  }}
                  onMouseEnter={() => setActiveGiftId(gift.id)}
                  onMouseLeave={() => setActiveGiftId((v) => (v === gift.id ? null : v))}
                  className="group flex flex-col items-center gap-1.5 p-1 rounded-xl hover:brightness-125 border border-transparent hover:border-secondary/30 transition-all duration-300 active:scale-95 relative overflow-hidden z-[99999]"
                >
                  <div
                    className={[
                      "w-full aspect-square flex items-center justify-center bg-transparent rounded-2xl shadow-inner group-hover:shadow-secondary/20 transition-all overflow-hidden relative elix-gift-idle border border-transparent",
                      poppedGiftId === gift.id ? "elix-gift-pop" : "",
                    ].join(" ")}
                  >
                    {false ? (
                      <div className="absolute inset-0">
                        <img
                          src={posterByGiftId.get(gift.id) || ""}
                          alt=""
                          className="absolute inset-0 w-full h-full object-contain p-1 pointer-events-none z-10"
                        />
                        {inView && (
                          <video
                            className="absolute inset-0 w-full h-full object-contain p-1 pointer-events-none z-0 opacity-80"
                            src={gift.video}
                            muted
                            playsInline
                            autoPlay
                            loop
                            preload="metadata"
                          />
                        )}
                      </div>
                    ) : (
                      <img
                        src={posterByGiftId.get(gift.id) || ""}
                        alt=""
                        className="w-full h-full object-contain p-1 pointer-events-none"
                      />
                    )}
                  </div>
                  <div className="text-center z-10">
                    <p className="text-[10px] text-white/90 font-medium truncate w-full mb-0.5 group-hover:text-white">{gift.name}</p>
                    <div className="flex items-center justify-center gap-1">
                      <Coins size={9} className="text-secondary" />
                      <p className="text-[10px] text-secondary font-bold">{gift.coins.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity pointer-events-none" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'small' && smallGifts.length > 0 && (
        <div className="mt-2 animate-fade-in">
          <div className="grid grid-cols-4 gap-2">
            {smallGifts.map((gift) => (
              <button
                key={gift.id}
                onClick={() => {
                    setPoppedGiftId(gift.id);
                    window.setTimeout(() => setPoppedGiftId((v) => (v === gift.id ? null : v)), 520);
                    onSelectGift(gift);
                  }}
                onMouseEnter={() => setActiveGiftId(gift.id)}
                onMouseLeave={() => setActiveGiftId((v) => (v === gift.id ? null : v))}
                className="group flex flex-col items-center gap-1.5 p-1 rounded-xl hover:brightness-125 border border-transparent hover:border-secondary/30 transition-all duration-300 active:scale-95 relative overflow-hidden z-[99999]"
              >
                <div
                    className={[
                      "w-full aspect-square flex items-center justify-center bg-transparent rounded-2xl shadow-inner group-hover:shadow-secondary/20 transition-all overflow-hidden relative elix-gift-idle border border-transparent",
                      poppedGiftId === gift.id ? "elix-gift-pop" : "",
                    ].join(" ")}
                  >
                    <img
                      src={gift.icon}
                      alt=""
                      className="w-full h-full object-contain p-1 pointer-events-none"
                    />
                    <div className="elix-gift-sparkle" />
                  </div>
                <div className="text-center z-10">
                  <p className="text-[10px] text-white/90 font-medium truncate w-full mb-0.5 group-hover:text-white">{gift.name}</p>
                  <div className="flex items-center justify-center gap-1">
                    <Coins size={9} className="text-secondary" />
                    <p className="text-[10px] text-secondary font-bold">{gift.coins.toLocaleString()}</p>
                  </div>
                </div>
                <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity pointer-events-none" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
