import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (
    location.pathname === '/live' ||
    location.pathname.startsWith('/live/') ||
    location.pathname === '/create' ||
    location.pathname.startsWith('/create/') ||
    location.pathname === '/upload' ||
    location.pathname === '/login' ||
    location.pathname === '/register'
  ) {
    return null;
  }

  return (
    <nav className="fixed left-0 right-0 z-bottom-nav pointer-events-none bg-transparent"
         style={{ bottom: '0', paddingBottom: 'var(--safe-bottom)' }}>
      <div className="flex justify-center px-1 bg-transparent">
        <div className="relative w-full max-w-[480px] mx-auto">
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-[200%] rounded-full pointer-events-none" style={{background:'radial-gradient(ellipse at center, rgba(201,169,110,0.15) 0%, rgba(201,169,110,0.05) 40%, transparent 70%)'}} />
          <img 
            src="/navbar-bg.png" 
            alt="" 
            className="relative w-full h-auto pointer-events-none block"
            draggable={false}
            style={{
              filter: 'drop-shadow(0 0 20px rgba(201,169,110,0.4)) drop-shadow(0 -4px 30px rgba(201,169,110,0.2)) drop-shadow(0 0 8px rgba(0,0,0,0.6))',
            }}
          />
          
          <div className="absolute inset-0 flex items-stretch pointer-events-auto">
            <button 
              onClick={() => navigate('/feed')} 
              className="flex-1 h-full bg-transparent border-0 p-0 m-0 appearance-none focus:outline-none active:opacity-70 transition-opacity"
              style={{ WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
              title="Home"
            />
            <button 
              onClick={() => navigate('/friends')} 
              className="flex-1 h-full bg-transparent border-0 p-0 m-0 appearance-none focus:outline-none active:opacity-70 transition-opacity"
              style={{ WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
              title="Friends"
            />
            <button 
              onClick={() => navigate('/create')} 
              className="flex-1 h-full bg-transparent border-0 p-0 m-0 appearance-none focus:outline-none active:opacity-70 transition-opacity"
              style={{ WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
              title="Create"
            />
            <button 
              onClick={() => navigate('/inbox')} 
              className="flex-1 h-full bg-transparent border-0 p-0 m-0 appearance-none focus:outline-none active:opacity-70 transition-opacity"
              style={{ WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
              title="Inbox"
            />
            <button 
              onClick={() => navigate('/profile')} 
              className="flex-1 h-full bg-transparent border-0 p-0 m-0 appearance-none focus:outline-none active:opacity-70 transition-opacity"
              style={{ WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
              title="Profile"
            />
          </div>
        </div>
      </div>
    </nav>
  );
};
