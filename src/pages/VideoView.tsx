import React from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import EnhancedVideoPlayer from '../components/EnhancedVideoPlayer';

export default function VideoView() {
  const navigate = useNavigate();
  const { videoId } = useParams<{ videoId: string }>();

  if (!videoId) {
    return (
      <div className="min-h-[100dvh] bg-[#13151A] text-white p-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/80">
          <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
          Back
        </button>
        <div className="mt-6 text-white/70">Video not found.</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#13151A] flex justify-center">
      <div
        className="w-full max-w-[480px] relative overflow-hidden bg-[#13151A] border-b border-[#C9A96E]/20"
        style={{ height: 'calc(100vh - 3.6cm)', marginTop: 0 }}
      >
        <div className="absolute left-3 top-3 z-[250]">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-transparent border border-transparent text-white"
            aria-label="Back"
          >
            <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
          </button>
        </div>
        <EnhancedVideoPlayer videoId={videoId} isActive={true} />
      </div>
    </div>
  );
}
