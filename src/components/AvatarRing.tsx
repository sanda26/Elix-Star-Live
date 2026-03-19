interface AvatarRingProps {
  src: string;
  alt?: string;
  size: number;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function AvatarRing({ src, alt = '', size, className = '', onClick }: AvatarRingProps) {
  const innerSize = size * 0.65;
  const safeSrc = (typeof src === 'string' && src.length > 0) ? src : '/Icons/Profile icon.png';
  const safeAlt = typeof alt === 'string' ? alt : '';
  return (
    <div
      className={`relative flex-shrink-0 rounded-full ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      <div
        className="absolute rounded-full bg-[#1a1c22]"
        style={{
          width: innerSize,
          height: innerSize,
          top: '45%',
          left: '51%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1,
        }}
      />
      <img
        src={safeSrc}
        alt={safeAlt}
        className="absolute rounded-full object-cover"
        style={{
          width: innerSize,
          height: innerSize,
          top: '45%',
          left: '51%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2,
        }}
      />
      <img
        src="/Icons/Profile icon.png"
        alt=""
        className="absolute w-full h-full object-contain pointer-events-none rounded-full"
        style={{ top: 0, left: 0, zIndex: 3 }}
      />
    </div>
  );
}
