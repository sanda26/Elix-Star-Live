import React from 'react';

import { useNavigate } from 'react-router-dom';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white p-4 flex justify-center">
      <div className="w-full max-w-[700px]">
        <header className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} aria-label="Back">
            <img src="/Icons/power-button.png" alt="Back" className="w-4 h-4" />
          </button>
          <h1 className="font-bold text-lg">Terms & Conditions</h1>
          <div className="w-6" />
        </header>

        <div className="text-sm text-white/75 space-y-3 leading-6">
          <p>By using ElixStarLive, you agree to these Terms.</p>
          <p>
            Users are responsible for the content they upload and confirm they own or have all necessary rights to their
            videos and audio.
          </p>
          <p>
            ElixStarLive does not claim ownership over user content. We reserve the right to remove any content that
            violates our policies, copyright laws, or applicable regulations.
          </p>
          <p>
            ElixStarLive may disable audio, video, live streaming, or accounts at any time to comply with legal
            requirements.
          </p>
        </div>
      </div>
    </div>
  );
}
