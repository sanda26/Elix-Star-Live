import React from 'react';

import { useNavigate } from 'react-router-dom';

export default function LegalSafety() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-[#121212] text-[#00f2ea] flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] rounded-3xl overflow-hidden bg-[#121212] flex flex-col pt-[var(--safe-top)] pb-[calc(var(--safe-bottom)+12mm)] overflow-y-auto p-4">
        <header className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} aria-label="Back">
            <img src="/Icons/power-button.png" alt="Back" className="w-4 h-4" />
          </button>
          <h1 className="font-bold text-lg">Safety</h1>
          <div className="w-6" />
        </header>

        <div className="text-sm text-[#00f2ea]/75 space-y-3 leading-6">
          <p>Report content that violates our rules.</p>
          <p>Audio may be muted or removed automatically.</p>
        </div>
      </div>
    </div>
  );
}

