import React, { useEffect, useState } from 'react';
import { Music, Play } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface MusicVideo {
  id: string;
  video_url: string;
  thumbnail_url?: string;
}

export default function MusicFeed() {
  const navigate = useNavigate();
  const { songId } = useParams();
  const [videos, setVideos] = useState<MusicVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('id, video_url, thumbnail_url')
          .order('created_at', { ascending: false })
          .limit(30);

        if (!error && data) {
          setVideos(data);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, [songId]);

  return (
    <div className="bg-[#13151A] text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] rounded-3xl overflow-hidden bg-[#13151A] flex flex-col overflow-y-auto">
        {/* Header Info */}
        <div className="p-4 pt-6 bg-gradient-to-b from-[#13151A] to-black">
         <button onClick={() => navigate('/feed')} className="p-2 mb-4" title="Back to For You">
           <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
         </button>
         <div className="flex gap-4">
         <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shrink-0 relative">
            <img src="/Icons/Music Icon.png" alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            <Music size={20} className="text-white/90 relative z-[1]" />
         </div>
         <div className="flex-1">
            <h1 className="text-xl font-bold mb-1">Original Sound{songId ? ` #${songId}` : ''}</h1>
            <p className="text-white/60 text-sm mb-4">Trending</p>
            <button onClick={() => navigate('/create')} className="bg-[#C9A96E] text-black px-6 py-1.5 rounded-sm font-semibold flex items-center gap-2 text-sm w-fit active:scale-95 transition-transform">
               <Play size={8} fill="black" /> Use this sound
            </button>
         </div>
         </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-0.5 p-0.5">
        {loading ? (
          <div className="col-span-3 flex items-center justify-center h-[40vh]">
            <div className="w-8 h-8 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="col-span-3 flex flex-col items-center justify-center h-[40vh] text-center opacity-60">
            <Music size={48} className="mb-4" />
            <p className="text-sm">No videos yet</p>
          </div>
        ) : (
          videos.map((video) => (
            <div key={video.id} className="aspect-[3/4] bg-[#13151A] relative cursor-pointer" onClick={() => navigate('/')}>
               <video
                 src={video.video_url}
                 className="w-full h-full object-cover"
                 muted
                 loop
                 playsInline
                 preload="auto"
                 onMouseOver={e => e.currentTarget.play()}
                 onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
               />
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
