import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { 'Content-Type': 'application/json' };
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

async function apiPost(path: string, body: any): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API error');
  }
  return res.json();
}

async function apiGet(path: string): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API error');
  }
  return res.json();
}

const activeViews = new Map<string, {
  videoId: string;
  startTime: number;
  lastUpdate: number;
  totalWatchTime: number;
  videoDuration: number;
  completed: boolean;
  replayed: boolean;
  replayCount: number;
  updateInterval: ReturnType<typeof setInterval> | null;
}>();

export function startVideoView(videoId: string, videoDuration: number = 0) {
  stopVideoView(videoId);

  const view = {
    videoId,
    startTime: Date.now(),
    lastUpdate: Date.now(),
    totalWatchTime: 0,
    videoDuration,
    completed: false,
    replayed: false,
    replayCount: 0,
    updateInterval: null as ReturnType<typeof setInterval> | null,
  };

  view.updateInterval = setInterval(() => {
    const elapsed = (Date.now() - view.lastUpdate) / 1000;
    view.totalWatchTime += elapsed;
    view.lastUpdate = Date.now();
  }, 1000);

  activeViews.set(videoId, view);
}

export function markVideoCompleted(videoId: string) {
  const view = activeViews.get(videoId);
  if (view) {
    view.completed = true;
  }
}

export function markVideoReplayed(videoId: string) {
  const view = activeViews.get(videoId);
  if (view) {
    view.replayed = true;
    view.replayCount += 1;
  }
}

export async function stopVideoView(videoId: string) {
  const view = activeViews.get(videoId);
  if (!view) return;

  if (view.updateInterval) {
    clearInterval(view.updateInterval);
    view.updateInterval = null;
  }

  const elapsed = (Date.now() - view.lastUpdate) / 1000;
  view.totalWatchTime += elapsed;

  activeViews.delete(videoId);

  if (view.totalWatchTime < 0.5) return;

  try {
    await apiPost('/api/feed/track-view', {
      videoId: view.videoId,
      watchTime: Math.round(view.totalWatchTime * 100) / 100,
      videoDuration: view.videoDuration,
      completed: view.completed,
      replayed: view.replayed,
      replayCount: view.replayCount,
    });
  } catch {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('video_views').insert({
          user_id: user.id,
          video_id: view.videoId,
          watch_time_seconds: view.totalWatchTime,
          video_duration_seconds: view.videoDuration,
          completed: view.completed,
          replayed: view.replayed,
          replay_count: view.replayCount,
          ended_at: new Date().toISOString(),
        });
        await supabase.from('video_interactions').insert({
          user_id: user.id,
          video_id: view.videoId,
          interaction_type: view.completed ? 'complete' : 'view',
        });
      }
    } catch {
      // silent
    }
  }
}

export async function trackLike(videoId: string): Promise<void> {
  try {
    await apiPost('/api/feed/track-interaction', { videoId, type: 'like' });
  } catch {
    // fallback handled in store
  }
}

export async function trackComment(videoId: string, text: string): Promise<void> {
  try {
    await apiPost('/api/feed/track-interaction', { videoId, type: 'comment', data: { text } });
  } catch {
    // fallback
  }
}

export async function trackShare(videoId: string, platform: string = 'copy'): Promise<void> {
  try {
    await apiPost('/api/feed/track-interaction', { videoId, type: 'share', data: { platform } });
  } catch {
    // fallback
  }
}

export async function trackFollow(targetUserId: string, videoId?: string): Promise<void> {
  try {
    await apiPost('/api/feed/track-interaction', { videoId: videoId || '', type: 'follow', data: { targetUserId } });
  } catch {
    // fallback
  }
}

export async function fetchForYouFeed(page: number = 1, limit: number = 20): Promise<{
  videos: any[];
  page: number;
  limit: number;
  hasMore: boolean;
  total: number;
  source: string;
}> {
  try {
    return await apiGet(`/api/feed/foryou?page=${page}&limit=${limit}`);
  } catch {
    return { videos: [], page, limit, hasMore: false, total: 0, source: 'error' };
  }
}

export async function getVideoScore(videoId: string): Promise<any> {
  try {
    const result = await apiGet(`/api/feed/score/${videoId}`);
    return result.score;
  } catch {
    return null;
  }
}

export function cleanupAllViews() {
  for (const [videoId] of activeViews) {
    stopVideoView(videoId);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    for (const [_videoId, view] of activeViews) {
      if (view.updateInterval) clearInterval(view.updateInterval);
      const elapsed = (Date.now() - view.lastUpdate) / 1000;
      view.totalWatchTime += elapsed;
      if (view.totalWatchTime >= 0.5) {
        const payload = JSON.stringify({
          videoId: view.videoId,
          watchTime: Math.round(view.totalWatchTime * 100) / 100,
          videoDuration: view.videoDuration,
          completed: view.completed,
          replayed: view.replayed,
          replayCount: view.replayCount,
        });
        navigator.sendBeacon(`${API_BASE}/api/feed/track-view`, new Blob([payload], { type: 'application/json' }));
      }
    }
    activeViews.clear();
  });
}
