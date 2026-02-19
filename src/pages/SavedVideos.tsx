import React, { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface SavedVideo {
  id: string;
  video_url: string;
  views: string;
}

export default function SavedVideos() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<SavedVideo[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('saved_videos')
          .select('video_id, videos:video_id(id, video_url, views_count)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (data) {
          setVideos(data.map((s: any) => ({
            id: s.videos?.id || s.video_id,
            video_url: s.videos?.video_url || '',
            views: formatViews(s.videos?.views_count || 0),
          })));
        }
      } catch { /* silent */ }
    })();
  }, []);

  const formatViews = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <div className="min-h-[100dvh] bg-[#13151A] text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] rounded-3xl overflow-hidden overflow-y-auto bg-[#13151A] flex flex-col pt-[var(--safe-top)] pb-[calc(var(--safe-bottom)+12mm)]">
        <div className="p-4 flex items-center gap-4">
          <button onClick={() => navigate('/feed')} className="p-1">
            <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Saved Videos</h1>
        </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-0.5 p-0.5 flex-1 overflow-y-auto">
        {videos.length === 0 ? (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 gap-2 text-white/30">
            <Bookmark size={32} />
            <p className="text-sm">No saved videos yet</p>
          </div>
        ) : videos.map((video) => (
          <div key={video.id} className="aspect-[3/4] bg-gray-900 relative cursor-pointer" onClick={() => navigate('/feed')}>
             <video 
               src={video.video_url} 
               className="w-full h-full object-cover" 
               muted 
               loop 
               onMouseOver={e => e.currentTarget.play()} 
               onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
             />
             <div className="absolute bottom-1 left-1 flex items-center gap-1 text-white text-xs drop-shadow-md">
               <Bookmark size={12} fill="white" />
             </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
