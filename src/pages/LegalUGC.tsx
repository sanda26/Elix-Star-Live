import React from 'react';

import { useNavigate } from 'react-router-dom';

export default function LegalUGC() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white p-4 flex justify-center">
      <div className="w-full max-w-[700px]">
        <header className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} aria-label="Back">
            <img src="/Icons/power-button.png" alt="Back" className="w-4 h-4" />
          </button>
          <h1 className="font-bold text-lg">UGC Disclaimer</h1>
          <div className="w-6" />
        </header>

        <div className="text-sm text-white/75 space-y-3 leading-6">
          <p>ElixStarLive is a user-generated content platform.</p>
          <p>
            Users are solely responsible for the content they upload. ElixStarLive does not endorse or verify user
            content.
          </p>
        </div>
      </div>
    </div>
  );
}

