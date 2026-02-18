import React from 'react';

import { useNavigate } from 'react-router-dom';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white p-4 flex justify-center">
      <div className="w-full max-w-[700px]">
        <header className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} aria-label="Back">
            <img src="/Icons/power-button.png" alt="Back" className="w-4 h-4" />
          </button>
          <h1 className="font-bold text-lg">Privacy Policy</h1>
          <div className="w-6" />
        </header>

        <div className="text-sm text-white/75 space-y-3 leading-6">
          <p>ElixStarLive respects your privacy.</p>
          <p>
            We collect basic account data (username, email, profile info) and usage data to operate the app.
          </p>
          <p>
            We do not sell personal data. Data is used only to provide app functionality, improve the service, and ensure
            safety.
          </p>
          <p>
            You may request account deletion at any time from Settings.
          </p>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="mt-2 inline-flex items-center justify-center px-3 py-2 rounded-xl bg-transparent border border-transparent hover:brightness-125 text-xs font-bold"
          >
            Open Settings
          </button>
        </div>
      </div>
    </div>
  );
}
