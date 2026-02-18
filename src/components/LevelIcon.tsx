import React from 'react';

export interface LevelIconProps {
  level: number;
  size?: number;
  className?: string;
  avatarUrl?: string;
  barColor?: string;
  text?: 'lv' | 'level';
}

export const LevelIcon: React.FC<LevelIconProps> = ({
  level,
  size = 40,
  className = '',
  avatarUrl,
  barColor,
  text = 'lv',
}) => {
  const safeLevel = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
  const circleSize = Math.max(16, Math.floor(size));
  const barHeight = Math.round(circleSize * 0.72);
  const barWidth = Math.round(circleSize * 1.95);
  const overlap = Math.round(circleSize * 0.52);
  const ringThickness = Math.max(2, Math.round(circleSize * 0.09));

  const getBarGradient = () => {
    if (barColor) return barColor;
    if (safeLevel >= 90) return 'linear-gradient(180deg, #ff2d55 0%, #7a1027 55%, #ff2d55 100%)';
    if (safeLevel >= 60) return 'linear-gradient(180deg, #a855f7 0%, #4c1d95 55%, #a855f7 100%)';
    if (safeLevel >= 30) return 'linear-gradient(180deg, #3b82f6 0%, #1e3a8a 55%, #3b82f6 100%)';
    return 'linear-gradient(180deg, #22c55e 0%, #14532d 55%, #22c55e 100%)';
  };

  const ringGlow = 'rgba(0, 242, 234, 0.35)';
  const ringMetal =
    'conic-gradient(from 210deg, rgba(255,255,255,0.08), rgba(0,0,0,0.55), rgba(255,255,255,0.18), rgba(0,0,0,0.55), rgba(255,255,255,0.08))';

  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: circleSize,
          height: circleSize,
          borderRadius: 999,
          padding: ringThickness,
          background: ringMetal,
          boxShadow: `0 0 0 1px rgba(0,0,0,0.8), 0 6px 14px rgba(0,0,0,0.55), 0 0 10px ${ringGlow}`,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: 999,
            overflow: 'hidden',
            background: 'rgba(0,0,0,0.55)',
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : null}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.22) 0%, transparent 55%)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          height: barHeight,
          width: barWidth,
          marginLeft: -overlap,
          borderRadius: barHeight / 2,
          background: getBarGradient(),
          border: '1px solid rgba(255,255,255,0.22)',
          boxShadow: '0 6px 14px rgba(0,0,0,0.55), inset 0 1px 1px rgba(255,255,255,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: Math.round(barHeight * 0.35),
          paddingLeft: Math.round(barHeight * 0.9),
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: barHeight / 2,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, transparent 58%, rgba(0,0,0,0.18) 100%)',
            pointerEvents: 'none',
            opacity: 0.75,
          }}
        />
        <span
          style={{
            position: 'relative',
            color: 'white',
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: '0.02em',
            fontSize: Math.max(10, Math.round(barHeight * 0.52)),
            textShadow: '0 2px 6px rgba(0,0,0,0.75)',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {text === 'level' ? `Level ${safeLevel}` : `LV ${safeLevel}`}
        </span>
      </div>
    </div>
  );
};