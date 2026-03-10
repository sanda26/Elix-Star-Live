import { noopClient } from './noopClient';
import { useVideoStore } from '../store/useVideoStore';

let channel: ReturnType<typeof noopClient.channel> | null = null;

export function startRealtimeSync() {
  // Legacy Supabase-based realtime feed sync removed. The app now relies on
  // HTTP + WebSocket backend; this function is intentionally a no-op.
  channel = null;
}

export function stopRealtimeSync() {
  if (channel) {
    noopClient.removeChannel(channel);
    channel = null;
  }
}
