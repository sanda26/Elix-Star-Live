import { supabase } from './supabase';
import { useVideoStore } from '../store/useVideoStore';

let channel: ReturnType<typeof supabase.channel> | null = null;

export function startRealtimeSync() {
  if (channel) return;

  channel = supabase
    .channel('feed-realtime')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'videos' },
      (payload) => {
        const updated = payload.new as any;
        if (!updated?.id) return;
        const store = useVideoStore.getState();
        const existing = store.videos.find(v => v.id === updated.id);
        if (!existing) return;

        store.updateVideo(updated.id, {
          stats: {
            ...existing.stats,
            views: updated.views ?? existing.stats.views,
            likes: updated.likes ?? existing.stats.likes,
            comments: updated.comments_count ?? existing.stats.comments,
            shares: updated.shares_count ?? existing.stats.shares,
            saves: existing.stats.saves,
          },
        });
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'likes' },
      (payload) => {
        const row = payload.new as any;
        if (!row?.video_id) return;
        const store = useVideoStore.getState();
        const video = store.videos.find(v => v.id === row.video_id);
        if (!video) return;
        store.updateVideo(row.video_id, {
          stats: { ...video.stats, likes: video.stats.likes + 1 },
        });
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments' },
      (payload) => {
        const row = payload.new as any;
        if (!row?.video_id) return;
        const store = useVideoStore.getState();
        const video = store.videos.find(v => v.id === row.video_id);
        if (!video) return;
        store.updateVideo(row.video_id, {
          stats: { ...video.stats, comments: video.stats.comments + 1 },
        });
      }
    )
    .subscribe();
}

export function stopRealtimeSync() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
