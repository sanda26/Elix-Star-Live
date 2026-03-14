import React from 'react';

/** Small "LIVE" badge to overlay on avatars when the user is live (TikTok-style). */
export function LiveBadge({
  className = '',
  size = 'sm',
}: {
  className?: string;
  size?: 'sm' | 'md';
}) {
  const isSm = size === 'sm';
  return (
    <span
      className={
        `absolute bottom-0 right-0 rounded bg-[#FF2D55] text-white font-bold leading-none flex items-center justify-center ${className}`
      }
      style={{
        fontSize: isSm ? 9 : 10,
        padding: isSm ? '2px 5px' : '3px 6px',
        minWidth: isSm ? 28 : 32,
        boxShadow: '0 0 6px rgba(255,45,85,0.6)',
      }}
    >
      LIVE
    </span>
  );
}

/** Wraps an avatar (or any content) with a relative container and shows LIVE badge when isLive. */
export function AvatarWithLiveBadge({
  children,
  isLive,
  badgeSize = 'sm',
  className = '',
}: {
  children: React.ReactNode;
  isLive: boolean;
  badgeSize?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={`relative inline-block ${className}`}>
      {children}
      {isLive && <LiveBadge size={badgeSize} />}
    </div>
  );
}
