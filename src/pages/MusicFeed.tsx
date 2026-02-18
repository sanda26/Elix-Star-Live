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
    <div className="min-h-screen bg-black text-white flex justify-center">
      <div className="w-full">
        {/* Header Info */}
        <div className="p-4 pt-6 bg-gradient-to-b from-gray-900 to-black">
         <button onClick={() => navigate('/feed')} className="p-2 mb-4" title="Back to For You">
           <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
         </button>
         <div className="flex gap-4">
         <div className="w-24 h-24 bg-gray-800 rounded-md flex items-center justify-center shrink-0">
            <Music size={40} className="text-white/50" />
         </div>
         <div className="flex-1">
            <h1 className="text-xl font-bold mb-1">Original Sound{songId ? ` #${songId}` : ''}</h1>
            <p className="text-white/60 text-sm mb-4">Trending</p>
            <button className="bg-[#FE2C55] text-white px-6 py-1.5 rounded-sm font-semibold flex items-center gap-2 text-sm w-fit">
               <Play size={14} fill="white" /> Use this sound
            </button>
         </div>
         </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-0.5 p-0.5">
        {loading ? (
          <div className="col-span-3 flex items-center justify-center h-[40vh]">
            <div className="w-8 h-8 border-2 border-[#E6B36A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="col-span-3 flex flex-col items-center justify-center h-[40vh] text-center opacity-60">
            <Music size={48} className="mb-4" />
            <p className="text-sm">No videos yet</p>
          </div>
        ) : (
          videos.map((video) => (
            <div key={video.id} className="aspect-[3/4] bg-gray-900 relative cursor-pointer" onClick={() => navigate('/')}>
               <video 
                 src={video.video_url} 
                 className="w-full h-full object-cover" 
                 muted 
                 loop 
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
