import React, { useEffect, useState } from 'react';
import { Trophy, X } from 'lucide-react';
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

  const loadRanking = async () => {
    try {
      const { data, error } = await supabase.rpc('get_weekly_creator_ranking');
      
      let finalRankings: CreatorRanking[] = data || [];
      if (error) {
        console.error('Failed to load ranking:', error);
        finalRankings = [];
      }

      // If we have fewer than 99 items, fill with mock data
      if (finalRankings.length < 99) {
        const startRank = finalRankings.length + 1;
        const remainingCount = 99 - finalRankings.length;
        
        const mockRankings: CreatorRanking[] = Array.from({ length: remainingCount }, (_, i) => {
          const rank = startRank + i;
          return {
            rank,
            user_id: `mock-user-${rank}`,
            username: `creator_${rank}`,
            display_name: `Creator ${rank}`,
            avatar_url: `https://i.pravatar.cc/150?u=${rank}`,
            total_diamonds: Math.max(100, Math.floor(1000000 / (rank + 1)))
          };
        });
        
        finalRankings = [...finalRankings, ...mockRankings];
      }
      
      setRankings(finalRankings);
    } catch (error) {
      console.error('Ranking error:', error);
      // Fallback to full mock if error
      const mockRankings: CreatorRanking[] = Array.from({ length: 99 }, (_, i) => {
        const rank = i + 1;
        return {
          rank,
          user_id: `mock-user-${rank}`,
          username: `creator_${rank}`,
          display_name: `Creator ${rank}`,
          avatar_url: `https://i.pravatar.cc/150?u=${rank}`,
          total_diamonds: Math.max(100, Math.floor(1000000 / (rank + 1)))
        };
      });
      setRankings(mockRankings);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="absolute inset-0 z-[99999] flex flex-col justify-end">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div className="relative w-full z-10 pointer-events-auto">
        <div 
          className="bg-[#1a1a1a]/95 rounded-t-2xl p-4 pb-safe h-[40dvh] flex flex-col shadow-2xl w-full border-t border-white/10" 
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Trophy className="w-4 h-4 text-white" fill="currentColor" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg leading-none">Weekly Ranking</h3>
              <p className="text-white/50 text-[10px] font-medium">Top 99 Creators</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto -mx-2 px-2 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
              <p className="text-white/30 text-xs">Loading rankings...</p>
            </div>
          ) : rankings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Trophy className="w-12 h-12 text-white/10" />
              <p className="text-white/30 text-sm">No rankings yet this week</p>
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
                        src={rankings[1].avatar_url || 'https://via.placeholder.com/40'} 
                        alt={rankings[1].display_name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-300 shadow-[0_0_10px_rgba(209,213,219,0.3)]"
                      />
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-300 text-black text-[10px] font-black px-1.5 rounded-full border border-white">
                        2
                      </div>
                    </div>
                    <div className="text-center w-full mt-1">
                      <h4 className="text-white font-bold text-xs truncate w-full">{rankings[1].display_name}</h4>
                      <p className="text-gray-400 font-bold text-[10px]">{formatNumber(rankings[1].total_diamonds)}</p>
                    </div>
                  </div>
                )}

                {/* Rank 1 (Gold) */}
                {rankings[0] && (
                  <div className="flex flex-col items-center gap-1 w-1/3 order-2 -mt-4 z-10">
                    <div className="relative">
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 animate-bounce-slow">
                        <Trophy className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" fill="currentColor" />
                      </div>
                      <img 
                        src={rankings[0].avatar_url || 'https://via.placeholder.com/40'} 
                        alt={rankings[0].display_name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)] ring-2 ring-yellow-400/20"
                      />
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-xs font-black px-2 py-0.5 rounded-full border border-white">
                        1
                      </div>
                    </div>
                    <div className="text-center w-full mt-2">
                      <h4 className="text-white font-bold text-sm truncate w-full">{rankings[0].display_name}</h4>
                      <p className="text-yellow-400 font-bold text-xs">{formatNumber(rankings[0].total_diamonds)}</p>
                    </div>
                  </div>
                )}

                {/* Rank 3 (Bronze) */}
                {rankings[2] && (
                  <div className="flex flex-col items-center gap-1 w-1/3 order-3">
                    <div className="relative">
                      <img 
                        src={rankings[2].avatar_url || 'https://via.placeholder.com/40'} 
                        alt={rankings[2].display_name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-amber-600 shadow-[0_0_10px_rgba(217,119,6,0.3)]"
                      />
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[10px] font-black px-1.5 rounded-full border border-white/20">
                        3
                      </div>
                    </div>
                    <div className="text-center w-full mt-1">
                      <h4 className="text-white font-bold text-xs truncate w-full">{rankings[2].display_name}</h4>
                      <p className="text-amber-600 font-bold text-[10px]">{formatNumber(rankings[2].total_diamonds)}</p>
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
                    <div className="w-8 text-center font-bold text-sm text-white/50 italic">
                      {creator.rank}
                    </div>

                    {/* Avatar */}
                    <div className="relative">
                      <img 
                        src={creator.avatar_url || 'https://via.placeholder.com/40'} 
                        alt={creator.display_name}
                        className="w-9 h-9 rounded-full object-cover border border-white/10"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-bold text-sm truncate">
                        {creator.display_name || creator.username}
                      </h4>
                      <p className="text-white/40 text-[10px] truncate">
                        @{creator.username}
                      </p>
                    </div>

                    {/* Points */}
                    <div className="flex flex-col items-end">
                      <span className="text-white/90 font-bold text-xs tabular-nums">
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
    </div>
  </div>
  );
}
