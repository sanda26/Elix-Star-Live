import React from 'react';

import { useNavigate } from 'react-router-dom';

export default function Copyright() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-[#13151A] text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] rounded-3xl overflow-hidden bg-[#13151A] flex flex-col pt-[calc(var(--safe-top)+46px)] pb-[calc(var(--safe-bottom)+70px)] overflow-y-auto p-4">
        <header className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} aria-label="Back">
            <img src="/Icons/power-button.png" alt="Back" className="w-4 h-4" />
          </button>
          <h1 className="font-bold text-lg">Copyright Notice</h1>
          <div className="w-6" />
        </header>

        <div className="text-sm text-white/75 space-y-3 leading-6">
          <p>© 2026 ElixStarLive. All rights reserved.</p>
          <p>
            All app content, design, branding, and software are the property of ElixStarLive unless otherwise stated.
          </p>
        </div>
      </div>
    </div>
  );
}
