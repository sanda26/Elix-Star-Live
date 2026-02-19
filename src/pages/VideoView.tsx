import React from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import EnhancedVideoPlayer from '../components/EnhancedVideoPlayer';

export default function VideoView() {
  const navigate = useNavigate();
  const { videoId } = useParams<{ videoId: string }>();

  if (!videoId) {
    return (
      <div className="min-h-[100dvh] bg-[#121212] text-[#00f2ea] p-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#00f2ea]/80">
          <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
          Back
        </button>
        <div className="mt-6 text-[#00f2ea]/70">Video not found.</div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-[#121212] flex justify-center">
      <div className="w-full h-full relative">
        <div className="absolute left-3 top-3 z-[250]">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-[#121212] border border-transparent text-[#00f2ea]"
            aria-label="Back"
          >
            <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
          </button>
        </div>
        <EnhancedVideoPlayer videoId={videoId} isActive={true} />
      </div>
    </div>
  );
}
