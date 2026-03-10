import { noopClient } from './noopClient';
import { useCallStore } from '../store/useCallStore';
import type { CallParticipant } from '../store/useCallStore';

let incomingChannel: { unsubscribe?: () => void } | null = null;

export async function initiateCall(remoteUser: CallParticipant): Promise<string> {
  const { data: { user } } = await noopClient.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const callId = crypto.randomUUID();

  await noopClient.from('call_signals').insert({
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
  const { data: { user } } = await noopClient.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const store = useCallStore.getState();
  if (!store.remoteUser) return;

  await noopClient.from('call_signals').insert({
    caller_id: user.id,
    callee_id: store.remoteUser.id,
    call_id: callId,
    type: 'call-accepted',
    payload: {},
  });

  useCallStore.getState().setStatus('connecting');
}

export async function rejectCall(callId: string): Promise<void> {
  const { data: { user } } = await noopClient.auth.getUser();
  if (!user) return;

  const store = useCallStore.getState();
  const remoteId = store.remoteUser?.id;
  if (!remoteId) return;

  await noopClient.from('call_signals').insert({
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
    noopClient.removeChannel(incomingChannel);
    incomingChannel = null;
  }

  // Incoming call realtime signalling disabled (Supabase channels removed).
  // This now becomes a no-op; WebRTC/WS-based calling can be reintroduced later.

  return () => {
    if (incomingChannel) {
      noopClient.removeChannel(incomingChannel);
      incomingChannel = null;
    }
  };
}
