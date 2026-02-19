// 🔒 LOCKED FILE: DO NOT MODIFY.
// This file is locked to preserve the gift animation behavior.
import React, { useState, useEffect, useRef } from 'react'; 
import { websocket } from '../lib/websocket'; 
import { Sparkles } from 'lucide-react'; 

interface GiftAnimation { 
  id: string; 
  username: string; 
  giftIcon: string; 
  giftName: string; 
  quantity: number; 
  timestamp: number; 
  videoUrl?: string; // Optional: If gift has a video effect
} 

interface GiftAnimationOverlayProps { 
  streamId: string; 
} 

export default function GiftAnimationOverlay({ streamId: _streamId }: GiftAnimationOverlayProps) { 
  const [activeGifts, setActiveGifts] = useState<GiftAnimation[]>([]); 
  const [activeVideoGift, setActiveVideoGift] = useState<GiftAnimation | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
      videoUrl: data.video_url, // Assuming backend sends this if applicable
    }; 

    setActiveGifts(prev => [...prev, animation]); 

    // If it's a large gift with video, trigger video overlay
    if (data.video_url) {
        setActiveVideoGift(animation);
        setTimeout(() => setActiveVideoGift(null), 8000); // Hide after 8s
    }

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
            className="animate-slide-in-right bg-gradient-to-r from-[#00f2ea]/90 to-[#00c2be]/90  rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 min-w-[200px]" 
          > 
            <div className="text-4xl animate-bounce" style={{ filter: 'drop-shadow(0 0 10px rgba(0, 242, 234, 0.6))' }}>{gift.giftIcon}</div> 
            <div className="flex-1"> 
              <p className="text-sm font-bold text-[#00f2ea]">{gift.username}</p> 
              <p className="text-xs text-black font-extrabold uppercase tracking-wide">Sent {gift.giftName}</p> 
            </div> 
            <div className="text-3xl font-black italic text-[#00f2ea] drop-shadow-lg animate-pulse"> 
              x{gift.quantity} 
            </div> 
          </div> 
        ))} 
      </div> 

      {/* --- FULLSCREEN VIDEO OVERLAY --- */} 
      {activeVideoGift && ( 
        <div className="absolute inset-0 z-[50] pointer-events-none flex items-center justify-center bg-[#121212]/40 backdrop-blur-sm animate-in fade-in duration-300"> 
          <div className="relative w-full h-full max-w-md max-h-[60vh] flex flex-col items-center justify-center"> 
             
            <div className="absolute top-10 text-center animate-bounce-slow z-20"> 
              <h2 className="text-3xl font-black text-[#00f2ea] drop-shadow-[0_0_15px_rgba(0,242,234,0.8)] italic transform -skew-x-12"> 
                {activeVideoGift.username} 
              </h2> 
              <p className="text-[#00f2ea] text-lg font-bold uppercase tracking-widest drop-shadow-md mt-1"> 
                SENT {activeVideoGift.giftName} 
              </p> 
            </div> 

            {/* Video Element */} 
            <video 
              ref={videoRef} 
              src={activeVideoGift.videoUrl} 
              className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(0,242,234,0.4)]" 
              autoPlay 
              playsInline 
              muted={false} 
            /> 
          </div> 
        </div> 
      )} 
    </div> 
  ); 
}
