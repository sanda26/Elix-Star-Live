import React, { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface SavedVideo {
  id: string;
  url: string;
  thumbnail?: string;
  views: number;
}

export default function SavedVideos() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedVideos();
  }, []);

  const loadSavedVideos = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from('saved_videos')
        .select('video_id, videos(id, url, thumbnail_url, views)')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        const mapped = data
          .filter((d: any) => d.videos)
          .map((d: any) => ({
            id: d.videos.id,
            url: d.videos.url,
            thumbnail: d.videos.thumbnail_url,
            views: d.videos.views || 0,
          }));
        setVideos(mapped);
      }
    } catch {
      // Table may not exist yet — show empty state
    } finally {
      setLoading(false);
    }
  };

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

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#C9A96E]/30 border-t-[#C9A96E] rounded-full animate-spin" />
        </div>
      ) : videos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/40 gap-2">
          <Bookmark size={40} />
          <p className="text-sm">No saved videos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 p-0.5 flex-1 overflow-y-auto">
          {videos.map((video) => (
            <div key={video.id} className="aspect-[3/4] bg-gray-900 relative cursor-pointer" onClick={() => navigate(`/video/${video.id}`)}>
               {video.thumbnail ? (
                 <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
               ) : (
                 <video
                   src={video.url}
                   className="w-full h-full object-cover"
                   muted
                   loop
                   onMouseOver={e => e.currentTarget.play()}
                   onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                 />
               )}
               <div className="absolute bottom-1 left-1 flex items-center gap-1 text-white text-xs drop-shadow-md">
                 <Bookmark size={12} fill="white" />
                 <span>{formatViews(video.views)}</span>
               </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
