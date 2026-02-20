interface AvatarRingProps {
  src: string;
  alt?: string;
  size: number;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function AvatarRing({ src, alt = '', size, className = '', onClick }: AvatarRingProps) {
  const innerSize = size * 0.6;
  return (
    <div
      className={`relative flex-shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      <img
        src={src}
        alt={alt}
        className="absolute rounded-full object-cover"
        style={{
          width: innerSize,
          height: innerSize,
          top: '42%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <img
        src="/Icons/Profile icon.png"
        alt=""
        className="relative z-10 w-full h-full object-contain pointer-events-none"
      />
    </div>
  );
}
