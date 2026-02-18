import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export type BattleStatus = 'pending' | 'active' | 'ended';

export interface BattleSession {
  id: string;
  host_id: string;
  status: BattleStatus;
  winner_id: string | null;
  started_at: string | null;
  duration_seconds: number;
}

export interface BattleParticipant {
  id: string;
  battle_id: string;
  user_id: string;
  role: 'host' | 'challenger';
  score: number;
  status: 'invited' | 'accepted' | 'declined' | 'ready';
  username?: string; // Joined from profiles
  avatar_url?: string; // Joined from profiles
}

export function useBattleManager(roomId: string) {
  const user = useAuthStore(s => s.user);
  const [currentBattle, setCurrentBattle] = useState<BattleSession | null>(null);
  const [participants, setParticipants] = useState<BattleParticipant[]>([]);
  const [battleTimeRemaining, setBattleTimeRemaining] = useState(0);

  // Fetch active battle for this room
  const fetchActiveBattle = useCallback(async () => {
    // 1. Find session where host_id is the room owner (or we just query by room_id if we added that column)
    // Since we don't have room_id on battle_sessions, we assume host_id = roomId (if roomId is user ID)
    // Or we query battle_participants to find which battle this room's host is in.
    
    // For simplicity: Query battle_sessions where host_id = roomId AND status != 'ended'
    const { data, error } = await supabase
      .from('battle_sessions')
      .select('*')
      .eq('host_id', roomId) // Assuming roomId is the host's User ID
      .neq('status', 'ended')
      .maybeSingle();

    if (data) {
      setCurrentBattle(data as BattleSession);
      fetchParticipants(data.id);
    } else {
      setCurrentBattle(null);
      setParticipants([]);
    }
  }, [roomId]);

  const fetchParticipants = async (battleId: string) => {
    const { data } = await supabase
      .from('battle_participants')
      .select(`
        *,
        profiles:user_id (username, avatar_url)
      `)
      .eq('battle_id', battleId);
    
    if (data) {
      const mapped = data.map((p: any) => ({
        ...p,
        username: p.profiles?.username,
        avatar_url: p.profiles?.avatar_url
      }));
      setParticipants(mapped);
    }
  };

  // Realtime Subscription
  useEffect(() => {
    fetchActiveBattle();

    const channel = supabase.channel(`battle:${roomId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'battle_sessions',
        filter: `host_id=eq.${roomId}`
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
            setCurrentBattle(null);
        } else {
            setCurrentBattle(payload.new as BattleSession);
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'battle_participants'
        // We can't easily filter by battle_id here without knowing it first, 
        // so we might need to refresh participants when session updates or just poll/refresh on signal.
      }, () => {
        if (currentBattle?.id) fetchParticipants(currentBattle.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchActiveBattle, currentBattle?.id]);

  // Timer Logic
  useEffect(() => {
    if (currentBattle?.status === 'active' && currentBattle.started_at) {
      const interval = setInterval(() => {
        const start = new Date(currentBattle.started_at!).getTime();
        const now = new Date().getTime();
        const elapsed = (now - start) / 1000;
        const duration = currentBattle.duration_seconds || 300;
        const remaining = Math.max(0, duration - elapsed);
        
        setBattleTimeRemaining(Math.floor(remaining));
        
        if (remaining <= 0) {
           clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [currentBattle]);

  // Actions
  const startBattle = async () => {
    if (!user) return;
    // Create new session
    const { data, error } = await supabase
      .from('battle_sessions')
      .insert({
        host_id: user.id,
        status: 'active', // For MVP start immediately or use 'pending' -> 'active'
        started_at: new Date().toISOString(),
        duration_seconds: 300
      })
      .select()
      .single();
      
    if (data) {
        // Add host
        await supabase.from('battle_participants').insert({
            battle_id: data.id,
            user_id: user.id,
            role: 'host',
            status: 'ready',
            score: 0
        });
        setCurrentBattle(data);
    }
  };

  const inviteUser = async (targetUserId: string) => {
      if (!currentBattle) return;
      await supabase.from('battle_participants').insert({
          battle_id: currentBattle.id,
          user_id: targetUserId,
          role: 'challenger',
          status: 'invited',
          score: 0
      });
  };
  
  const endBattle = async () => {
      if (!currentBattle) return;
      await supabase.from('battle_sessions').update({
          status: 'ended',
          ended_at: new Date().toISOString()
      }).eq('id', currentBattle.id);
      setCurrentBattle(null);
      setParticipants([]);
  };

  return {
    currentBattle,
    participants,
    battleTimeRemaining,
    startBattle,
    inviteUser,
    endBattle,
    refresh: fetchActiveBattle
  };
}