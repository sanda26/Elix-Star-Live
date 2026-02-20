import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type LiveCreator = {
  id: string;
  name: string;
  viewers: number;
  thumbnail?: string;
};

type LiveStreamRow = {
  stream_key: string;
  title: string | null;
  viewer_count: number | null;
};

export default function LiveDiscover() {
  const navigate = useNavigate();
  const [creators, setCreators] = useState<LiveCreator[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLiveStreams = async () => {
    setLoading(true);
    try {
      // Fetch active streams from Supabase
      const { data, error } = await supabase
        .from('live_streams')
        .select('*')
        .eq('is_live', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = (data as any[]).map((s: any) => s.user_id).filter(Boolean);
        const { data: profiles } = userIds.length > 0
          ? await supabase.from('profiles').select('user_id, username, display_name, avatar_url').in('user_id', userIds)
          : { data: [] };
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

        const mapped: LiveCreator[] = (data as any[]).map((stream: any) => {
          const profile: any = profileMap.get(stream.user_id);
          return {
            id: stream.stream_key || stream.id,
            name: profile?.display_name || profile?.username || stream.title || 'Creator',
            viewers: stream.viewer_count || 0,
            thumbnail: profile?.avatar_url || stream.thumbnail_url,
          };
        });
        setCreators(mapped);
      } else {
        setCreators([]);
      }
    } catch (err) {

      // NO FALLBACK/DEMO DATA - Real data only
      setCreators([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStreams();
    
    // Realtime subscription for new streams
    const channel = supabase
      .channel('public:live_streams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => {
        fetchLiveStreams();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#13151A] flex justify-center px-2">
      <div className="relative w-full max-w-[480px] h-[100dvh] bg-[#13151A] overflow-hidden rounded-3xl pt-[var(--safe-top)] pb-[calc(var(--safe-bottom)+12mm)]">
        <div className="absolute inset-0 bg-[#13151A]" />

        <div className="relative z-10 px-4 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/feed')} className="p-1 hover:brightness-125 transition" title="Back to For You">
                <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
              </button>
              <div>
                <p className="text-white font-extrabold text-xl">Live</p>
                <p className="text-white/60 text-xs font-semibold">Cine e live acum</p>
              </div>
            </div>
            <button 
              onClick={fetchLiveStreams}
              className="p-2 text-white hover:brightness-125 rounded-full"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {loading && creators.length === 0 ? (
               <div className="text-white/50 text-center py-10 text-sm">Loading streams...</div>
            ) : creators.length > 0 ? (
              creators.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(`/live/${c.id}`)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-extrabold text-lg">
                      {c.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-extrabold truncate max-w-[150px]">{c.name}</p>
                        <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold animate-pulse">LIVE</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/70 text-xs font-semibold">
                        <User className="w-4 h-4" strokeWidth={2} />
                        {c.viewers.toLocaleString()} viewers
                      </div>
                    </div>
                  </div>
                  <div className="text-white text-xs font-extrabold px-3 py-1.5 rounded-full">
                    Watch
                  </div>
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-white/20" />
                </div>
                <div>
                  <p className="text-white font-bold">No one is live</p>
                  <p className="text-white/50 text-xs mt-1">Go live to be the first!</p>
                </div>
                <button
                  onClick={() => navigate('/create')}
                  className="px-6 py-2 rounded-full bg-[#C9A96E] text-black font-bold text-sm"
                >
                  Go Live
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

