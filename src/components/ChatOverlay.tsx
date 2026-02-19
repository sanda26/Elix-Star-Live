import React, { useEffect, useRef } from 'react';
import { LevelBadge } from './LevelBadge';

interface Message {
  id: string;
  username: string;
  text: string;
  isGift?: boolean;
  level?: number;
  isSystem?: boolean;
  avatar?: string;
  membershipIcon?: string;
}

interface ChatOverlayProps {
  messages: Message[];
  variant?: 'panel' | 'overlay';
  compact?: boolean;
  className?: string;
  onLike?: () => void;
  onHeartSpawn?: (clientX: number, clientY: number) => void;
  onProfileTap?: (username: string) => void;
}

export function ChatOverlay({ messages, variant = 'panel', compact = false, className, onLike, onHeartSpawn, onProfileTap }: ChatOverlayProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    position: variant === 'overlay' ? 'absolute' : 'relative',
    bottom: variant === 'overlay' ? 0 : undefined,
    left: variant === 'overlay' ? 0 : undefined,
    width: variant === 'overlay' ? '100%' : '360px',
    maxWidth: variant === 'overlay' ? '100%' : 'calc(100% - 24px)',
    height: variant === 'overlay' ? (compact ? '30dvh' : '40dvh') : '100%',
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '8px',
    boxSizing: 'border-box',
    background: 'transparent',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    pointerEvents: 'none',
    alignItems: 'flex-start', // Align messages to the left
    zIndex: 90, // Explicitly set z-index lower than video gift (100)
  };

  const scrollStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    paddingLeft: '0px',
    marginLeft: '0px',
    alignItems: 'flex-start', // Align children to the left
    width: '100%',
    pointerEvents: 'auto',
  };

  return (
    <div
      style={containerStyle}
      className={className}
    >
      <div
        className="chat-scroll space-y-2 px-2"
        style={scrollStyle}
      >
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
            {/* Level Icon with Avatar - Fixed size container but allows overflow for bar */}
            <div 
              className="flex-shrink-0 cursor-pointer relative z-10"
              onClick={(e) => {
                e.stopPropagation();
                if (onProfileTap) onProfileTap(msg.username);
              }}
            >
              <LevelBadge level={msg.level || 1} size={28} layout="fixed" avatar={msg.avatar} />
            </div>
            
            {/* Content Container - Auto arrange name and text */}
            <div className="flex flex-col min-w-0 justify-center">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span 
                    className="text-white font-bold text-[13px] leading-tight cursor-pointer hover:underline whitespace-nowrap" 
                    onClick={() => onProfileTap?.(msg.username)}
                >
                  {msg.username}
                </span>
                
                {/* Membership Icon in Chat */}
                {msg.membershipIcon && (
                  <div className="bg-[#C9A96E] px-1.5 py-0.5 rounded-full flex items-center gap-1 border border-white/10 shadow-sm inline-flex align-middle">
                    <img src={msg.membershipIcon} alt="Member" className="w-3 h-3 object-contain" />
                    <span className="text-white text-[9px] font-bold uppercase tracking-wider">Member</span>
                  </div>
                )}
                
                <span className={`text-[13px] leading-snug break-words ${msg.isGift ? 'text-white font-bold' : 'text-white/90'}`}>
                    {msg.text}
                </span>
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}