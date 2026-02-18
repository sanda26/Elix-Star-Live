import React from 'react';

import { useNavigate } from 'react-router-dom';

export default function LegalDMCA() {
  const navigate = useNavigate();
  const dmcaEmail = 'dmca@elixstarlive.com';

  return (
    <div className="min-h-screen bg-black text-white p-4 flex justify-center">
      <div className="w-full max-w-[700px]">
        <header className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} aria-label="Back">
            <img src="/Icons/power-button.png" alt="Back" className="w-4 h-4" />
          </button>
          <h1 className="font-bold text-lg">DMCA / Copyright Report</h1>
          <div className="w-6" />
        </header>

        <div className="text-sm text-white/75 space-y-3 leading-6">
          <p>
            If you believe your copyrighted work has been used improperly, please contact:
          </p>
          <p>
            Email: <span className="text-[#E6B36A] font-semibold">{dmcaEmail}</span>
          </p>
          <p>Include:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your contact information</li>
            <li>Description of the copyrighted work</li>
            <li>Link to the content</li>
            <li>Statement of ownership</li>
          </ul>
          <div className="pt-2">
            <a
              className="inline-flex items-center justify-center rounded-xl bg-[#E6B36A] text-black font-bold px-4 py-2"
              href={`mailto:${dmcaEmail}?subject=DMCA%20Report%20-%20ElixStarLive`}
            >
              Email DMCA
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

