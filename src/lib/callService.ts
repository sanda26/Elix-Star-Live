import { supabase } from './supabase';
import { useCallStore } from '../store/useCallStore';
import type { CallParticipant } from '../store/useCallStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

let incomingChannel: RealtimeChannel | null = null;

export async function initiateCall(remoteUser: CallParticipant): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const callId = crypto.randomUUID();

  await supabase.from('call_signals').insert({
    caller_id: user.id,
    callee_id: remoteUser.id,
    call_id: callId,
    type: 'call-invite',
    payload: {
      callerUsername: user.user_metadata?.username || user.email?.split('@')[0] || 'User',
      callerAvatar: user.user_metadata?.avatar_url || '',
    },
  });

  useCallStore.getState().startOutgoingCall(callId, remoteUser);
  return callId;
}

export async function acceptCall(callId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const store = useCallStore.getState();
  if (!store.remoteUser) return;

  await supabase.from('call_signals').insert({
    caller_id: user.id,
    callee_id: store.remoteUser.id,
    call_id: callId,
    type: 'call-accepted',
    payload: {},
  });

  useCallStore.getState().setStatus('connecting');
}

export async function rejectCall(callId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const store = useCallStore.getState();
  const remoteId = store.remoteUser?.id;
  if (!remoteId) return;

  await supabase.from('call_signals').insert({
    caller_id: user.id,
    callee_id: remoteId,
    call_id: callId,
    type: 'call-rejected',
    payload: {},
  });

  useCallStore.getState().reset();
}

export function subscribeToIncomingCalls(userId: string): () => void {
  if (incomingChannel) {
    supabase.removeChannel(incomingChannel);
    incomingChannel = null;
  }

  incomingChannel = supabase
    .channel(`incoming-calls:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'call_signals',
        filter: `callee_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as {
          caller_id: string;
          call_id: string;
          type: string;
          payload: Record<string, unknown>;
        };

        if (row.caller_id === userId) return;

        const store = useCallStore.getState();

        switch (row.type) {
          case 'call-invite': {
            if (store.status !== 'idle') return;
            const caller: CallParticipant = {
              id: row.caller_id,
              username: (row.payload?.callerUsername as string) || 'User',
              avatar: (row.payload?.callerAvatar as string) || '',
            };
            useCallStore.getState().receiveIncomingCall(row.call_id, caller);
            break;
          }
          case 'call-accepted': {
            if (store.callId === row.call_id && store.status === 'outgoing') {
              useCallStore.getState().setStatus('connecting');
            }
            break;
          }
          case 'call-rejected': {
            if (store.callId === row.call_id) {
              useCallStore.getState().endCall('Call was declined');
              setTimeout(() => useCallStore.getState().reset(), 3000);
            }
            break;
          }
          case 'hangup': {
            if (store.callId === row.call_id) {
              useCallStore.getState().endCall('Call ended');
              setTimeout(() => useCallStore.getState().reset(), 2000);
            }
            break;
          }
        }
      }
    )
    .subscribe();

  return () => {
    if (incomingChannel) {
      supabase.removeChannel(incomingChannel);
      incomingChannel = null;
    }
  };
}
