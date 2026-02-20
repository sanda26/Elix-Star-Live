import React from 'react';

import { useNavigate } from 'react-router-dom';

export default function LegalAffiliate() {
  const navigate = useNavigate();

  return (
    <div className="bg-[#13151A] text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] rounded-3xl overflow-hidden bg-[#13151A] flex flex-col overflow-y-auto p-4">
        <header className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} aria-label="Back">
            <img src="/Icons/Gold power buton.png" alt="Back" className="w-4 h-4" />
          </button>
          <h1 className="font-bold text-lg">Affiliate / Sponsored Content Disclosure</h1>
          <div className="w-6" />
        </header>

        <div className="text-sm text-white/75 space-y-3 leading-6">
          <p>Some content on ElixStarLive may include affiliate links or sponsored products.</p>
          <p>ElixStarLive may receive a commission from such content.</p>
        </div>
      </div>
    </div>
  );
}

