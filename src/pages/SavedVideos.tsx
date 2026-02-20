import React from 'react';
import { Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SAVED_VIDEOS = [
  { id: 1, url: '/gifts/Elix Live Universe.webm', views: '1.2M' },
  { id: 2, url: '/gifts/Elix Gold Universe.webm', views: '850K' },
  { id: 3, url: '/gifts/Elix Global Universe.webm', views: '2.1M' },
  { id: 4, url: '/gifts/Frostwing Ascendant.webm', views: '500K' },
];

export default function SavedVideos() {
  const navigate = useNavigate();

  return (
    <div className="bg-[#13151A] text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] rounded-3xl overflow-hidden overflow-y-auto bg-[#13151A] flex flex-col">
        <div className="p-4 flex items-center gap-4">
          <button onClick={() => navigate('/feed')} className="p-1">
            <img src="/Icons/Gold power buton.png" alt="Back" className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Saved Videos</h1>
        </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-0.5 p-0.5 flex-1 overflow-y-auto">
        {SAVED_VIDEOS.map((video) => (
          <div key={video.id} className="aspect-[3/4] bg-[#13151A] relative cursor-pointer" onClick={() => navigate('/feed')}>
             <video 
               src={video.url} 
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
