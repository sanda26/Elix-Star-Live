import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { websocket } from '../lib/websocket';
import { Sword, Clock, Users } from 'lucide-react';
import { trackEvent } from '../lib/analytics';

interface LiveStream {
  id: string;
  user_id: string;
  title: string;
  thumbnail_url: string | null;
  viewer_count: number;
  creator?: { username: string; avatar_url: string | null };
}

interface BattleInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (userId: string) => Promise<void>;
  hostUserId: string;
}

export default function BattleInviteModal({
  isOpen,
  onClose,
  onInvite,
  hostUserId,
}: BattleInviteModalProps) {
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [selectedStream, setSelectedStream] = useState<LiveStream | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLiveStreams();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadLiveStreams = async () => {
    try {
      // 1. Fetch live streams
      const { data: streams, error: streamError } = await supabase
        .from('live_streams')
        .select('id, user_id, title, thumbnail_url, viewer_count')
        .eq('is_live', true)
        .neq('user_id', hostUserId)
        .order('viewer_count', { ascending: false })
        .limit(20);

      if (streamError) throw streamError;

      if (!streams || streams.length === 0) {
        setLiveStreams([]);
        return;
      }

      // 2. Fetch creators for these streams manually (safe way)
      const userIds = [...new Set(streams.map(s => s.user_id))];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      if (profileError) console.error('Error fetching creator profiles:', profileError);

      const profileMap = new Map();
      (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

      // 3. Map data
      const mapped = streams.map((s: any) => {
        const creator = profileMap.get(s.user_id);
        return {
          id: s.id,
          user_id: s.user_id,
          title: s.title,
          thumbnail_url: s.thumbnail_url,
          viewer_count: s.viewer_count,
          creator: {
            username: creator?.username || 'Unknown',
            avatar_url: creator?.avatar_url || null
          }
        };
      });
      
      setLiveStreams(mapped);
    } catch (error: any) {
      console.error('Failed to load streams:', error);
    }
  };

  const sendInvite = async () => {
    if (!selectedStream) return;

    setLoading(true);
    try {
      await onInvite(selectedStream.user_id);
      trackEvent('battle_invite_sent', {
        target_user_id: selectedStream.user_id,
      });

      onClose();
    } catch {
      // Failed to send — modal closes silently
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#13151A] z-modals flex items-end" onClick={onClose}>
      <div
        className="bg-[#1C1E24] w-full max-h-[80vh] rounded-t-3xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sword className="w-6 h-6 text-white" />
            <h2 className="text-lg font-bold">Challenge to Battle</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:brightness-125 rounded-full transition">
            <img src="/Icons/power-button.png" alt="Close" className="w-4 h-4" />
          </button>
        </div>



        {/* Live Streams List */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-3 justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-white/60" />
              <span className="text-sm font-semibold">Select Opponent</span>
            </div>
            <button onClick={loadLiveStreams} className="text-xs text-white hover:underline">
              Refresh
            </button>
          </div>

          {liveStreams.length === 0 && (
            <div className="text-center py-12 text-white/40">No live streams available</div>
          )}

          <div className="space-y-2">
            {liveStreams.map(stream => (
              <button
                key={stream.id}
                onClick={() => setSelectedStream(stream)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${
                  selectedStream?.id === stream.id
                    ? 'bg-[#C9A96E]/20 border-2 border-[#C9A96E]'
                    : 'bg-transparent border-2 border-transparent hover:brightness-125'
                }`}
              >
                <img
                  src={stream.thumbnail_url || stream.creator?.avatar_url || '/placeholder.png'}
                  alt={stream.title}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                />
                <div className="flex-1 text-left">
                  <p className="font-semibold mb-1">{stream.creator?.username || 'Unknown'}</p>
                  <p className="text-sm text-white/60 truncate">{stream.title}</p>
                  <div className="flex items-center gap-1 text-xs text-white/40 mt-1">
                    <Users className="w-3 h-3" />
                    {stream.viewer_count} watching
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-4 border-t border-white/10">
          <button
            onClick={sendInvite}
            disabled={!selectedStream || loading}
            className="w-full py-4 bg-[#C9A96E] text-black rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
          >
            {loading ? 'Sending...' : 'Send Battle Invitation'}
          </button>
        </div>
      </div>
    </div>
  );
}
