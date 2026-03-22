import React from 'react';
import { PROFILE_RING_INNER_RATIO } from '../lib/profileFrame';

/**
 * Golden ring from public asset `/Icons/Profile icon.png`, centered content (e.g. + icon or avatar).
 * Matches feed/video player framing — no CSS faux ring.
 */
export function GoldProfileFrame({
  size = 34,
  className = '',
  children,
}: {
  size?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/Icons/Profile icon.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      {children != null && (
        <div
          className="pointer-events-none absolute flex items-center justify-center"
          style={{
            width: `${PROFILE_RING_INNER_RATIO * 100}%`,
            height: `${PROFILE_RING_INNER_RATIO * 100}%`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
