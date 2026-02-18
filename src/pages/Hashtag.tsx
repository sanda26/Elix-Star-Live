import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Hash, TrendingUp } from 'lucide-react';
import { trackEvent } from '../lib/analytics';

interface Video {
  id: string;
  thumbnail_url: string;
  views_count: number;
  likes_count: number;
}

export default function Hashtag() {
  const navigate = useNavigate();
  const { tag } = useParams<{ tag: string }>();
  const [videos, setVideos] = useState<Video[]>([]);
  const [hashtagInfo, setHashtagInfo] = useState<{ use_count: number; trending_score: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tag) {
      loadHashtagData();
      trackEvent('hashtag_view', { hashtag: tag });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  const loadHashtagData = async () => {
    if (!tag) return;

    setLoading(true);
    try {
      // Load hashtag info
      const { data: hashtagData } = await supabase
        .from('hashtags')
        .select('use_count, trending_score')
        .eq('tag', tag.toLowerCase())
        .single();

      setHashtagInfo(hashtagData);

      // Load videos with this hashtag
      const { data: videoHashtags } = await supabase
        .from('video_hashtags')
        .select('video_id, videos(*)')
        .eq('hashtag', tag.toLowerCase())
        .limit(50);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const videos = videoHashtags?.map(vh => (vh as any).videos).filter(Boolean) || [];
      setVideos(videos);
    } catch {
      console.error('Failed to load hashtag');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/feed')} className="p-1 hover:brightness-125 transition" title="Back to For You">
            <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
          </button>
          <div className="w-16 h-16 bg-gradient-to-br from-[#E6B36A] to-[#B8935C] rounded-full flex items-center justify-center">
            <Hash className="w-8 h-8 text-black" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">#{tag}</h1>
            {hashtagInfo && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-white/60">{formatNumber(hashtagInfo.use_count)} videos</span>
                {hashtagInfo.trending_score > 50 && (
                  <div className="flex items-center gap-1 text-xs text-[#E6B36A]">
                    <TrendingUp className="w-3 h-3" />
                    Trending
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Videos Grid */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="text-center py-12 text-white/40">Loading...</div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {videos.map(video => (
              <a
                key={video.id}
                href={`/video/${video.id}`}
                className="relative aspect-[9/16] bg-gray-800 rounded overflow-hidden"
              >
                <img
                  src={video.thumbnail_url || '/placeholder-video.png'}
                  alt="Video"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 text-white text-xs font-semibold">
                  {formatNumber(video.views_count)} views
                </div>
              </a>
            ))}
          </div>
        )}

        {!loading && videos.length === 0 && (
          <div className="text-center py-12 text-white/40">No videos found for this hashtag</div>
        )}
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}
