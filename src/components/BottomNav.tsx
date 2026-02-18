import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (
    location.pathname === '/upload' ||
    location.pathname === '/create' ||
    location.pathname.startsWith('/create/') ||
    location.pathname === '/live' ||
    location.pathname.startsWith('/live/') ||
    location.pathname === '/login' ||
    location.pathname === '/register'
  ) {
    return null;
  }

  return (
    <nav className="fixed left-0 right-0 z-bottom-nav pointer-events-none bg-transparent"
         style={{ bottom: '-1mm', paddingBottom: 'var(--safe-bottom)' }}>
      <div className="flex justify-center px-2 bg-transparent">
        <div
          className="relative w-full max-w-[480px] mx-auto"
          style={{ width: 'calc(100% + 8mm)', marginLeft: '0mm' }}
        >
          {/* Background bar with LUXURY GLOW */}
          <img 
            src="/navbar-bg.png" 
            alt="" 
            className="w-full h-auto pointer-events-none block"
            draggable={false}
            style={{
              filter: 'drop-shadow(0 -4px 20px rgba(230,179,106,0.3)) drop-shadow(0 0 40px rgba(0,0,0,0.8))',
              clipPath: 'inset(8mm 0 0 0)',
            }}
          />
          
          {/* Plus button in center circle - LUXURY STYLE */}
          <button
            onClick={() => navigate('/create')}
            className="absolute left-[49.8%] top-[4%] -translate-x-1/2 -translate-y-[5px] w-[19.2%] hover:scale-110 active:scale-95 transition-all duration-300 pointer-events-auto bg-transparent active:bg-transparent appearance-none border-0 p-0 m-0 focus:outline-none focus-visible:outline-none rounded-full overflow-hidden"
            style={{ WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
          >
            <div className="relative">
              <img src="/nav-icons/plus.png" alt="Create" className="w-full h-auto rounded-full object-cover relative z-10" draggable={false} />
            </div>
          </button>
          
          {/* Icons Overlay Container - ABSOLUTE for specific image alignment */}
          <div className="absolute inset-0 pointer-events-none">
            
            {/* Home - Left Slot */}
            <button 
              onClick={() => navigate('/feed')} 
              className="absolute left-[5%] top-[22%] translate-y-[15px] translate-x-[4px] w-[11%] hover:scale-110 active:scale-90 transition-all duration-300 pointer-events-auto bg-transparent active:bg-transparent appearance-none border-0 p-0 m-0 focus:outline-none focus-visible:outline-none rounded-full overflow-hidden"
              style={{ WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            >
              <img src="/nav-icons/home.png" alt="Home" className="w-full h-auto rounded-full object-cover" draggable={false} />
            </button>
            
            {/* Friends - Center-Left Slot */}
            <button 
              onClick={() => navigate('/friends')} 
              className="absolute left-[25%] top-[22%] -translate-x-[12px] translate-y-[15px] w-[11%] hover:scale-110 active:scale-90 transition-all duration-300 pointer-events-auto bg-transparent active:bg-transparent appearance-none border-0 p-0 m-0 focus:outline-none focus-visible:outline-none rounded-full overflow-hidden"
              style={{ WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            >
              <img src="/nav-icons/friends.png" alt="Friends" className="w-full h-auto rounded-full object-cover" draggable={false} />
            </button>

            {/* Inbox - Center-Right Slot */}
            <button 
              onClick={() => navigate('/inbox')} 
              className="absolute right-[25%] top-[22%] translate-x-[4px] translate-y-[15px] w-[11%] hover:scale-110 active:scale-90 transition-all duration-300 pointer-events-auto bg-transparent active:bg-transparent appearance-none border-0 p-0 m-0 focus:outline-none focus-visible:outline-none rounded-full overflow-hidden"
              style={{ WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            >
              <img src="/nav-icons/inbox.png" alt="Inbox" className="w-full h-auto rounded-full object-cover" draggable={false} />
            </button>
            
            {/* Profile - Right Slot */}
            <button 
              onClick={() => navigate('/profile')} 
              className="absolute right-[5%] top-[22%] -translate-x-[6px] translate-y-[15px] w-[11%] hover:scale-110 active:scale-90 transition-all duration-300 pointer-events-auto bg-transparent active:bg-transparent appearance-none border-0 p-0 m-0 focus:outline-none focus-visible:outline-none rounded-full overflow-hidden"
              style={{ WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            >
              <img src="/nav-icons/profile.png" alt="Profile" className="w-full h-auto rounded-full object-cover" draggable={false} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
