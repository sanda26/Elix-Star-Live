import React, { useState, useEffect } from 'react'; 
import { websocket } from '../lib/websocket'; 
import { Sparkles } from 'lucide-react'; 

interface GiftAnimation { 
  id: string; 
  username: string; 
  giftIcon: string; 
  giftName: string; 
  quantity: number; 
  timestamp: number; 
} 

interface GiftAnimationOverlayProps { 
  streamId: string; 
} 

export default function GiftAnimationOverlay({ streamId: _streamId }: GiftAnimationOverlayProps) { 
  const [activeGifts, setActiveGifts] = useState<GiftAnimation[]>([]); 

  useEffect(() => { 
    websocket.on('gift_sent', handleGiftSent); 

    return () => { 
      websocket.off('gift_sent', handleGiftSent); 
    }; 
  }, []); 

  // eslint-disable-next-line @typescript-eslint/no-explicit-any 
  const handleGiftSent = (data: any) => { 
    const animation: GiftAnimation = { 
      id: Date.now().toString() + Math.random(), 
      username: data.username, 
      giftIcon: data.gift_icon, 
      giftName: data.gift_name, 
      quantity: data.quantity, 
      timestamp: Date.now(), 
    }; 

    setActiveGifts(prev => [...prev, animation]); 

    setTimeout(() => { 
      setActiveGifts(prev => prev.filter(g => g.id !== animation.id)); 
    }, 4000); 
  }; 

  return ( 
    <div className="fixed inset-0 pointer-events-none z-gift-animations flex justify-center"> 
      <div className="w-full max-w-[480px] relative">
        {/* Gift banner — thin bar, full width, just below creator header, above Weekly Ranking */}
        <div className="absolute left-0 right-0 space-y-[2px] px-1" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 68px)' }}>
          {activeGifts.slice(-3).map(gift => ( 
            <div 
              key={gift.id} 
              className="animate-slide-in-right w-full bg-black/50 backdrop-blur-sm rounded-full flex items-center gap-1 overflow-hidden px-2" 
              style={{ height: '7mm', maxHeight: '7mm' }}
            > 
              <div className="w-4 h-4 flex-shrink-0">
                {gift.giftIcon && (gift.giftIcon.startsWith('http') || gift.giftIcon.startsWith('/')) ? (
                  <img src={gift.giftIcon} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs">{gift.giftIcon || '🎁'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar"> 
                <p className="text-[8px] font-bold text-white whitespace-nowrap leading-none">
                  <span className="text-[#C9A96E]">{gift.username}</span>
                  {' '}sent{' '}
                  <span className="text-[#C9A96E]">{gift.giftName}</span>
                  {gift.quantity > 1 && <span className="text-white"> x{gift.quantity}</span>}
                </p> 
              </div> 
            </div> 
          ))} 
        </div>
      </div>
    </div> 
  ); 
}
