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
    width: '100%',
    maxWidth: '100%',
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

  const messageStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    paddingLeft: '8px',
    marginLeft: '0px',
    marginTop: '0px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    justifyContent: 'flex-start', // Align content to the left
    width: 'auto',
    maxWidth: '90%',
    alignSelf: 'flex-start', // Push message bubble to the left edge
    pointerEvents: 'auto',
    background: 'transparent',
    borderRadius: '8px',
  };

  const usernameStyle: React.CSSProperties = {
    fontWeight: 'bold',
    color: '#B8BCC4',
    fontSize: '14px',
    lineHeight: '18px',
    flexShrink: 0,
    marginLeft: '0px',
    textShadow: 'none',
    WebkitTextStroke: '0px transparent',
  };

  const textStyle = (isGift?: boolean): React.CSSProperties => ({
    color: isGift ? '#facc15' : '#C8CCD4',
    fontWeight: isGift ? 'bold' : 'normal',
    fontSize: '14px',
    lineHeight: '18px',
    textShadow: 'none',
    WebkitTextStroke: '0px transparent',
  });

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
          <div key={msg.id} className="flex items-start gap-2 animate-in slide-in-from-left-2 duration-200">
            <div 
              className="flex-shrink-0 cursor-pointer mt-0.5"
              onClick={(e) => {
                e.stopPropagation();
                if (onProfileTap) onProfileTap(msg.username);
              }}
            >
              <LevelBadge level={msg.level || 1} size={28} layout="fixed" avatar={msg.avatar} />
            </div>
            
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[#B8BCC4] font-bold text-[13px] leading-tight cursor-pointer hover:underline" onClick={() => onProfileTap?.(msg.username)}>
                  {msg.username}
                </span>
                
                {/* Membership Icon in Chat */}
                {msg.membershipIcon && (
                  <div className="bg-[#FF2D55] px-1.5 py-0.5 rounded-full flex items-center gap-1 border border-white/10 shadow-sm">
                    <img src={msg.membershipIcon} alt="Member" className="w-3 h-3 object-contain" />
                    <span className="text-white text-[9px] font-bold uppercase tracking-wider">Member</span>
                  </div>
                )}
                
                {msg.isSystem && (
                  <span className="bg-white/10 text-white/60 text-[9px] px-1 rounded font-bold uppercase">System</span>
                )}
              </div>
              
              <span className={`text-[13px] leading-snug break-words ${msg.isGift ? 'text-[#facc15] font-bold' : 'text-white/90'}`}>
                {msg.text}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
