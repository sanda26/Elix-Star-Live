import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CreatorRanking {
  rank: number;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_diamonds: number;
}

interface RankingPanelProps {
  onClose: () => void;
}

export function RankingPanel({ onClose }: RankingPanelProps) {
  const [rankings, setRankings] = useState<CreatorRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRanking();
  }, []);

  const DEMO_RANKINGS: CreatorRanking[] = [
    { rank: 1, user_id: 'd1', username: 'emma_rose22', display_name: 'Emma Rose', avatar_url: 'https://i.pravatar.cc/150?img=1', total_diamonds: 284500 },
    { rank: 2, user_id: 'd2', username: 'alex.madrid', display_name: 'Alex Madrid', avatar_url: 'https://i.pravatar.cc/150?img=3', total_diamonds: 198200 },
    { rank: 3, user_id: 'd3', username: 'sofiab_', display_name: 'Sofia Bianchi', avatar_url: 'https://i.pravatar.cc/150?img=5', total_diamonds: 156800 },
    { rank: 4, user_id: 'd4', username: 'lucassilva7', display_name: 'Lucas Silva', avatar_url: 'https://i.pravatar.cc/150?img=7', total_diamonds: 134100 },
    { rank: 5, user_id: 'd5', username: 'mia.chen_', display_name: 'Mia Chen', avatar_url: 'https://i.pravatar.cc/150?img=9', total_diamonds: 112400 },
    { rank: 6, user_id: 'd6', username: 'david_k99', display_name: 'David Kim', avatar_url: 'https://i.pravatar.cc/150?img=11', total_diamonds: 98700 },
    { rank: 7, user_id: 'd7', username: 'anya.pet', display_name: 'Anya Petrova', avatar_url: 'https://i.pravatar.cc/150?img=13', total_diamonds: 87300 },
    { rank: 8, user_id: 'd8', username: 'marcosantos_', display_name: 'Marco Santos', avatar_url: 'https://i.pravatar.cc/150?img=14', total_diamonds: 76500 },
    { rank: 9, user_id: 'd9', username: 'chloe.dpt', display_name: 'Chloé Dupont', avatar_url: 'https://i.pravatar.cc/150?img=16', total_diamonds: 64200 },
    { rank: 10, user_id: 'd10', username: 'jamesww_', display_name: 'James Wilson', avatar_url: 'https://i.pravatar.cc/150?img=17', total_diamonds: 51800 },
    { rank: 11, user_id: 'd11', username: 'yuki.tnk', display_name: 'Yuki Tanaka', avatar_url: 'https://i.pravatar.cc/150?img=19', total_diamonds: 43600 },
    { rank: 12, user_id: 'd12', username: 'isa_reyes', display_name: 'Isabella Reyes', avatar_url: 'https://i.pravatar.cc/150?img=20', total_diamonds: 38900 },
    { rank: 13, user_id: 'd13', username: 'noah.mllr', display_name: 'Noah Müller', avatar_url: 'https://i.pravatar.cc/150?img=22', total_diamonds: 31200 },
    { rank: 14, user_id: 'd14', username: 'lara_h', display_name: 'Lara Al-Hassan', avatar_url: 'https://i.pravatar.cc/150?img=24', total_diamonds: 27400 },
    { rank: 15, user_id: 'd15', username: 'olibrown', display_name: 'Oliver Brown', avatar_url: 'https://i.pravatar.cc/150?img=25', total_diamonds: 22100 },
  ];

  const loadRanking = async () => {
    setRankings(DEMO_RANKINGS);
    setLoading(false);

    try {
      const { data, error } = await supabase.rpc('get_weekly_creator_ranking');
      if (!error && data && data.length > 0) {
        setRankings(data);
      }
    } catch {
      // keep demo
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
        <div 
          className="bg-[#1a1a1a]/95 rounded-t-2xl p-4 pb-safe h-[50dvh] flex flex-col shadow-2xl w-full border-t border-[#00f2ea]/20" 
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00f2ea] to-[#00c4bd] flex items-center justify-center shadow-lg shadow-[#00f2ea]/20">
              <Trophy className="w-4 h-4 text-[#00f2ea]" fill="currentColor" />
            </div>
            <div>
              <h3 className="text-[#00f2ea] font-bold text-lg leading-none">Weekly Ranking</h3>
              <p className="text-[#00f2ea]/50 text-[10px] font-medium">Top Creators This Week</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto -mx-2 px-2 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-8 h-8 border-2 border-[#00f2ea]/30 border-t-[#00f2ea] rounded-full animate-spin" />
              <p className="text-[#00f2ea]/30 text-xs">Loading rankings...</p>
            </div>
          ) : rankings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Trophy className="w-12 h-12 text-[#00f2ea]/10" />
              <p className="text-[#00f2ea]/30 text-sm">No rankings yet this week</p>
            </div>
          ) : (
            <div className="flex flex-col pb-4">
              {/* Top 3 Podium */}
              <div className="flex justify-center items-end gap-2 mb-6 px-4 pt-4">
                {/* Rank 2 (Silver) */}
                {rankings[1] && (
                  <div className="flex flex-col items-center gap-1 w-1/3 order-1">
                    <div className="relative">
                      <img 
                        src={rankings[1].avatar_url || ''} 
                        alt={rankings[1].display_name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-300 shadow-[0_0_10px_rgba(209,213,219,0.3)]"
                      />
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-300 text-black text-[10px] font-black px-1.5 rounded-full border border-white">
                        2
                      </div>
                    </div>
                    <div className="text-center w-full mt-1">
                      <h4 className="text-[#00f2ea] font-bold text-xs truncate w-full">{rankings[1].display_name}</h4>
                      <p className="text-[#00f2ea] font-bold text-[10px]">{formatNumber(rankings[1].total_diamonds)}</p>
                    </div>
                  </div>
                )}

                {/* Rank 1 (Gold) */}
                {rankings[0] && (
                  <div className="flex flex-col items-center gap-1 w-1/3 order-2 -mt-4 z-10">
                    <div className="relative">
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 animate-bounce-slow">
                        <Trophy className="w-6 h-6 text-[#00f2ea] drop-shadow-[0_0_10px_rgba(0,242,234,0.5)]" fill="currentColor" />
                      </div>
                      <img 
                        src={rankings[0].avatar_url || ''} 
                        alt={rankings[0].display_name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-[#00f2ea] shadow-[0_0_15px_rgba(0,242,234,0.4)] ring-2 ring-[#00f2ea]/20"
                      />
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#00f2ea] text-black text-xs font-black px-2 py-0.5 rounded-full border border-white">
                        1
                      </div>
                    </div>
                    <div className="text-center w-full mt-2">
                      <h4 className="text-[#00f2ea] font-bold text-sm truncate w-full">{rankings[0].display_name}</h4>
                      <p className="text-[#00f2ea] font-bold text-xs">{formatNumber(rankings[0].total_diamonds)}</p>
                    </div>
                  </div>
                )}

                {/* Rank 3 (Bronze) */}
                {rankings[2] && (
                  <div className="flex flex-col items-center gap-1 w-1/3 order-3">
                    <div className="relative">
                      <img 
                        src={rankings[2].avatar_url || ''} 
                        alt={rankings[2].display_name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-[#00f2ea] shadow-[0_0_10px_rgba(0,242,234,0.3)]"
                      />
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#00f2ea] text-[#00f2ea] text-[10px] font-black px-1.5 rounded-full border border-white/20">
                        3
                      </div>
                    </div>
                    <div className="text-center w-full mt-1">
                      <h4 className="text-[#00f2ea] font-bold text-xs truncate w-full">{rankings[2].display_name}</h4>
                      <p className="text-[#00f2ea] font-bold text-[10px]">{formatNumber(rankings[2].total_diamonds)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Rest of the list */}
              <div className="flex flex-col gap-1">
                {rankings.slice(3).map((creator) => (
                  <div 
                    key={creator.user_id}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    {/* Rank Number */}
                    <div className="w-8 text-center font-bold text-sm text-[#00f2ea]/50 italic">
                      {creator.rank}
                    </div>

                    {/* Avatar */}
                    <div className="relative">
                      <img 
                        src={creator.avatar_url || ''} 
                        alt={creator.display_name}
                        className="w-9 h-9 rounded-full object-cover border border-white/10"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[#00f2ea] font-bold text-sm truncate">
                        {creator.display_name || creator.username}
                      </h4>
                      <p className="text-[#00f2ea]/40 text-[10px] truncate">
                        @{creator.username}
                      </p>
                    </div>

                    {/* Points */}
                    <div className="flex flex-col items-end">
                      <span className="text-[#00f2ea]/90 font-bold text-xs tabular-nums">
                        {formatNumber(creator.total_diamonds)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
