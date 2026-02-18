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
    // Listen for gift events 
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

    // Remove after animation completes 
    setTimeout(() => { 
      setActiveGifts(prev => prev.filter(g => g.id !== animation.id)); 
    }, 4000); 
  }; 

  return ( 
    <div className="fixed inset-0 pointer-events-none z-gift-animations"> 
      {/* Gift Notifications (top-right) */} 
      <div className="absolute top-20 right-4 space-y-2"> 
        {activeGifts.slice(-3).map(gift => ( 
          <div 
            key={gift.id} 
            className="animate-slide-in-right bg-gradient-to-r from-[#E6B36A]/90 to-[#B8935C]/90  rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 min-w-[200px]" 
          > 
            <div className="text-4xl animate-bounce">{gift.giftIcon}</div> 
            <div className="flex-1"> 
              <p className="text-sm font-bold text-white">{gift.username}</p> 
              <p className="text-xs text-white/90"> 
                sent {gift.giftName} x{gift.quantity} 
              </p> 
            </div> 
            <Sparkles className="w-5 h-5 text-white animate-spin" /> 
          </div> 
        ))} 
      </div> 

      {/* Full-Screen Gift Animation (for large gifts) */} 
      {activeGifts.filter(g => g.quantity >= 100).slice(-1).map(gift => ( 
        <div 
          key={`fullscreen-${gift.id}`} 
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#E6B36A]/20 to-[#B8935C]/20 animate-fade-in-out" 
        > 
          <div className="text-center"> 
            <div className="text-9xl animate-bounce-slow mb-4">{gift.giftIcon}</div> 
            <div className="bg-black  rounded-2xl px-8 py-6"> 
              <p className="text-3xl font-bold text-[#E6B36A] mb-2">{gift.username}</p> 
              <p className="text-xl text-white"> 
                sent {gift.giftName} x{gift.quantity} 
              </p> 
            </div> 
          </div> 
        </div> 
      ))} 
    </div> 
  ); 
}
