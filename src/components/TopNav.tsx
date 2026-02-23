import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const TopNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoveredTopTabIndex, setHoveredTopTabIndex] = useState<number | null>(null);

  if (
    location.pathname === '/live' ||
    location.pathname.startsWith('/live/') ||
    location.pathname.startsWith('/watch/') ||
    location.pathname === '/create' ||
    location.pathname.startsWith('/create/') ||
    location.pathname === '/upload' ||
    location.pathname === '/login' ||
    location.pathname === '/register'
  ) {
    return null;
  }

  const tabWidths = [13, 12, 15, 18, 12, 15, 15];
  let hoveredTopTabLeft = 0;
  let hoveredTopTabRight = 0;
  if (hoveredTopTabIndex !== null) {
    let left = 0;
    for (let i = 0; i < hoveredTopTabIndex; i++) left += tabWidths[i];
    hoveredTopTabLeft = left;
    hoveredTopTabRight = 100 - left - tabWidths[hoveredTopTabIndex];
  }

  return (
    <div className="fixed left-0 right-0 z-[9999] flex justify-center pointer-events-none"
         style={{ top: 'calc(var(--safe-top) + 0.5mm)' }}>
      <div className="w-full max-w-[480px] relative px-2">
        <div className="relative w-full" style={{ transform: 'scaleY(0.80)', transformOrigin: 'top' }}>
          <img 
            src="/Icons/topbar.png" 
            alt="Navigation" 
            className="w-full h-auto pointer-events-none"
            style={{ 
              filter: 'drop-shadow(0 0 20px rgba(201,169,110,0.5)) drop-shadow(0 4px 15px rgba(0,0,0,0.6))',
            }}
          />
          <img
            src="/Icons/topbar.png"
            alt=""
            className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-200"
            style={{
              opacity: hoveredTopTabIndex === null ? 0 : 1,
              filter: 'brightness(1.25) saturate(1.4) contrast(1.15)',
              clipPath:
                hoveredTopTabIndex === null
                  ? 'inset(0 100% 0 0)'
                  : `inset(0 ${hoveredTopTabRight}% 0 ${hoveredTopTabLeft}%)`,
            }}
          />
          
          <div className="absolute inset-0 flex items-center pointer-events-auto">
            <button
              onClick={() => navigate('/live', { replace: true })}
              onMouseEnter={() => setHoveredTopTabIndex(0)}
              onMouseLeave={() => setHoveredTopTabIndex(null)}
              className="h-full bg-transparent focus:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
              style={{ width: '13%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
              title="Live"
            />
            <button
              onClick={() => navigate('/discover')}
              onMouseEnter={() => setHoveredTopTabIndex(1)}
              onMouseLeave={() => setHoveredTopTabIndex(null)}
              className="h-full bg-transparent focus:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
              style={{ width: '12%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
              title="STEM"
            />
            <button
              onClick={() => navigate('/discover')}
              onMouseEnter={() => setHoveredTopTabIndex(2)}
              onMouseLeave={() => setHoveredTopTabIndex(null)}
              className="h-full bg-transparent focus:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
              style={{ width: '15%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
              title="Explore"
            />
            <button
              onClick={() => navigate('/following')}
              onMouseEnter={() => setHoveredTopTabIndex(3)}
              onMouseLeave={() => setHoveredTopTabIndex(null)}
              className="h-full bg-transparent focus:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
              style={{ width: '18%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
              title="Following"
            />
            <button
              onClick={() => navigate('/shop')}
              onMouseEnter={() => setHoveredTopTabIndex(4)}
              onMouseLeave={() => setHoveredTopTabIndex(null)}
              className="h-full bg-transparent focus:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
              style={{ width: '12%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
              title="Shop"
            />
            <button
              onClick={() => navigate('/feed')}
              onMouseEnter={() => setHoveredTopTabIndex(5)}
              onMouseLeave={() => setHoveredTopTabIndex(null)}
              className="h-full bg-transparent focus:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
              style={{ width: '15%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
              title="For You"
            />
            <button
              onClick={() => navigate('/search')}
              onMouseEnter={() => setHoveredTopTabIndex(6)}
              onMouseLeave={() => setHoveredTopTabIndex(null)}
              className="h-full bg-transparent focus:outline-none active:bg-transparent appearance-none border-0 p-0 m-0"
              style={{ width: '15%', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
              title="Search"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
