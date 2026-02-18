import React from 'react';
import { LevelIcon } from './LevelIcon';

interface LevelBadgeProps {
  level: number;
  className?: string;
  size?: number;
  layout?: 'fit' | 'fixed';
  variant?: 'clean' | 'default' | 'chat';
  avatar?: string;
}

export const LevelBadge: React.FC<LevelBadgeProps> = ({
  level,
  className = '',
  size = 40,
  layout: _layout = 'fit',
  variant: _variant = 'clean',
  avatar,
}) => {
  const safeLevel = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
  const dim = Math.max(16, Math.floor(size));

  return (
    <div className={className}>
      <LevelIcon level={safeLevel} size={dim} avatarUrl={avatar} />
    </div>
  );
};