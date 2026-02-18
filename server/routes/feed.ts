/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const db = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

const SCORE_WEIGHTS = {
  watch_time: 2,
  likes: 5,
  comments: 6,
  shares: 8,
  completions: 10,
};

const TEST_GROUP_MIN = 200;
const TEST_GROUP_MAX = 500;
const TEST_GROUP_ENGAGEMENT_THRESHOLD = 0.15;
const EXPANSION_MULTIPLIER = 5;

const feedCache = new Map<string, { data: any[]; ts: number }>();
const CACHE_TTL = 15_000;
const trendingCache: { data: any[] | null; ts: number } = { data: null, ts: 0 };
const TRENDING_CACHE_TTL = 30_000;

const viewRateLimit = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX_VIEWS = 120;

function computeScore(s: { total_watch_time: number; total_likes: number; total_comments: number; total_shares: number; total_completions: number }): number {
  return (
    (s.total_watch_time || 0) * SCORE_WEIGHTS.watch_time +
    (s.total_likes || 0) * SCORE_WEIGHTS.likes +
    (s.total_comments || 0) * SCORE_WEIGHTS.comments +
    (s.total_shares || 0) * SCORE_WEIGHTS.shares +
    (s.total_completions || 0) * SCORE_WEIGHTS.completions
  );
}

function getIpHash(req: Request): string {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || 'unknown';
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash) + ip.charCodeAt(i);
    hash |= 0;
  }
  return 'ip_' + Math.abs(hash).toString(36);
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = viewRateLimit.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    viewRateLimit.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_VIEWS) return false;
  entry.count++;
  return true;
}

async function getUserId(req: Request): Promise<string | null> {
  if (!db) return null;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const { data: { user } } = await db.auth.getUser(token);
    return user?.id || null;
  } catch {
    return null;
  }
}

async function getTrendingVideos(limit: number): Promise<any[]> {
  if (!db) return [];
  const now = Date.now();
  if (trendingCache.data && now - trendingCache.ts < TRENDING_CACHE_TTL) {
    return trendingCache.data.slice(0, limit);
  }

  let res = await db
    .from('videos')
    .select('*, user:users ( id, username, display_name, avatar_url, is_creator )')
    .eq('is_private', false)
    .order('engagement_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);

  if (res.error) {
    res = await db
      .from('videos')
      .select('*, user:profiles!user_id ( user_id, username, display_name, avatar_url, is_creator )')
      .eq('is_private', false)
      .order('created_at', { ascending: false })
      .limit(100);
  }

  if (res.error) {
    res = await db.from('videos').select('*').eq('is_private', false).order('created_at', { ascending: false }).limit(100);
  }

  const data = res.data || [];
  trendingCache.data = data;
  trendingCache.ts = now;
  return data.slice(0, limit);
}

async function getFollowingVideoIds(userId: string): Promise<string[]> {
  if (!db) return [];
  const { data: following } = await db.from('followers').select('following_id').eq('follower_id', userId);
  const ids = following?.map((f: any) => f.following_id) || [];
  if (ids.length === 0) return [];
  const { data } = await db.from('videos').select('id').in('user_id', ids).eq('is_private', false).order('created_at', { ascending: false }).limit(20);
  return data?.map((v: any) => v.id) || [];
}

async function getUserInterests(userId: string): Promise<Map<string, number>> {
  if (!db) return new Map();
  const { data } = await db.from('user_interests').select('category, weight').eq('user_id', userId).order('weight', { ascending: false }).limit(20);
  const map = new Map<string, number>();
  data?.forEach((d: any) => map.set(d.category, d.weight));
  return map;
}

async function getWatchedVideoIds(userId: string): Promise<Set<string>> {
  if (!db) return new Set();
  const { data } = await db.from('video_views').select('video_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(200);
  return new Set(data?.map((d: any) => d.video_id) || []);
}

async function getNotInterestedIds(userId: string): Promise<Set<string>> {
  if (!db) return new Set();
  const { data } = await db.from('user_not_interested').select('video_id').eq('user_id', userId).limit(500);
  return new Set(data?.map((d: any) => d.video_id) || []);
}

async function getLikedVideoCategories(userId: string): Promise<string[]> {
  if (!db) return [];
  const { data: likes } = await db.from('likes').select('video_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  if (!likes || likes.length === 0) return [];
  const videoIds = likes.map((l: any) => l.video_id);
  const { data: videos } = await db.from('videos').select('category').in('id', videoIds).not('category', 'is', null);
  return videos?.map((v: any) => v.category).filter(Boolean) || [];
}

function personalizeAndRank(
  videos: any[],
  followingIds: string[],
  interests: Map<string, number>,
  watchedIds: Set<string>,
  notInterestedIds: Set<string>,
  likedCategories: string[]
): any[] {
  const followingSet = new Set(followingIds);
  const categoryBoost = new Map<string, number>();
  likedCategories.forEach(cat => {
    categoryBoost.set(cat, (categoryBoost.get(cat) || 0) + 1);
  });

  const scored = videos
    .filter(v => !notInterestedIds.has(v.id))
    .map(v => {
      let score = v.engagement_score || 0;

      const userId = v.user?.id || v.user?.user_id || v.user_id;
      if (userId && followingSet.has(userId)) score += 200;

      const cat = v.category;
      if (cat && interests.has(cat)) score += interests.get(cat)! * 50;
      if (cat && categoryBoost.has(cat)) score += categoryBoost.get(cat)! * 30;

      if (watchedIds.has(v.id)) score -= 100;

      const ageHours = (Date.now() - new Date(v.created_at).getTime()) / 3_600_000;
      if (ageHours < 1) score += 150;
      else if (ageHours < 6) score += 80;
      else if (ageHours < 24) score += 30;

      score += Math.random() * 50;

      return { ...v, _feedScore: score };
    });

  scored.sort((a, b) => b._feedScore - a._feedScore);
  return scored;
}

function formatVideoForClient(v: any, likedSet: Set<string>, followingSet: Set<string>): any {
  const u = v.user;
  const uid = u?.user_id ?? u?.id ?? v.user_id ?? 'unknown';
  const uname = u?.username ?? 'user';
  return {
    id: v.id,
    url: v.url,
    thumbnail: v.thumbnail_url || '',
    duration: v.duration_seconds ? `${Math.floor(v.duration_seconds / 60)}:${String(Math.floor(v.duration_seconds % 60)).padStart(2, '0')}` : '0:15',
    user: {
      id: uid,
      username: uname,
      name: u?.display_name ?? uname,
      avatar: u?.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(uname)}`,
      level: 1,
      isVerified: !!u?.is_creator,
      followers: 0,
      following: 0,
    },
    description: v.caption || '',
    hashtags: v.hashtags || [],
    music: { id: 'original', title: 'Original Sound', artist: u?.display_name ?? uname, duration: '0:15' },
    stats: {
      views: v.views || 0,
      likes: v.likes || 0,
      comments: v.comments_count || 0,
      shares: v.shares_count || 0,
      saves: 0,
    },
    createdAt: v.created_at,
    location: 'For You',
    isLiked: likedSet.has(v.id),
    isSaved: false,
    isFollowing: uid !== 'unknown' && followingSet.has(uid),
    comments: [],
    quality: 'auto',
    privacy: 'public',
    engagementScore: v.engagement_score || 0,
  };
}

export async function handleForYouFeed(req: Request, res: Response) {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const userId = await getUserId(req);

    const cacheKey = userId ? `${userId}:${page}:${limit}` : `anon:${page}:${limit}`;
    const cached = feedCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return res.json({ videos: cached.data, page, limit, source: 'cache' });
    }

    const allVideos = await getTrendingVideos(100);

    let likedSet = new Set<string>();
    let followingSet = new Set<string>();
    let ranked: any[];

    if (userId) {
      const [followingIds, interests, watchedIds, notInterestedIds, likedCategories, userLikes, userFollowing] = await Promise.all([
        getFollowingVideoIds(userId),
        getUserInterests(userId),
        getWatchedVideoIds(userId),
        getNotInterestedIds(userId),
        getLikedVideoCategories(userId),
        db.from('likes').select('video_id').eq('user_id', userId).then(r => r.data?.map((d: any) => d.video_id) || []),
        db.from('followers').select('following_id').eq('follower_id', userId).then(r => r.data?.map((d: any) => d.following_id) || []),
      ]);

      likedSet = new Set(userLikes);
      followingSet = new Set(userFollowing);

      const followingVideoIds = new Set(followingIds);
      const followingVideos = allVideos.filter(v => {
        const uid = v.user?.id || v.user?.user_id || v.user_id;
        return uid && followingVideoIds.has(v.id);
      });

      const combinedVideos = [...allVideos];
      followingVideos.forEach(fv => {
        if (!combinedVideos.find(v => v.id === fv.id)) combinedVideos.push(fv);
      });

      ranked = personalizeAndRank(combinedVideos, userFollowing, interests, watchedIds, notInterestedIds, likedCategories);
    } else {
      ranked = allVideos.map(v => ({ ...v, _feedScore: (v.engagement_score || 0) + Math.random() * 20 }));
      ranked.sort((a: any, b: any) => b._feedScore - a._feedScore);
    }

    const paginated = ranked.slice(offset, offset + limit);
    const formatted = paginated.map(v => formatVideoForClient(v, likedSet, followingSet));

    feedCache.set(cacheKey, { data: formatted, ts: Date.now() });

    if (feedCache.size > 1000) {
      const oldest = [...feedCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
      oldest.slice(0, 500).forEach(([k]) => feedCache.delete(k));
    }

    res.json({
      videos: formatted,
      page,
      limit,
      hasMore: ranked.length > offset + limit,
      total: ranked.length,
      source: 'live',
    });
  } catch (err: any) {
    console.error('[ForYouFeed] Error:', err?.message || err);
    res.status(500).json({ error: 'Failed to generate feed' });
  }
}

export async function handleTrackView(req: Request, res: Response) {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' });

    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth required' });

    const ipHash = getIpHash(req);
    if (!checkRateLimit(`${userId}:${ipHash}`)) {
      await db.from('abuse_log').insert({ user_id: userId, ip_hash: ipHash, action: 'rate_limited_view', video_id: req.body.videoId, flagged: true, reason: 'rate_limit_exceeded' });
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const { videoId, watchTime, videoDuration, completed, replayed, replayCount } = req.body;
    if (!videoId) return res.status(400).json({ error: 'videoId required' });

    if (watchTime && videoDuration && watchTime > videoDuration * 1.5) {
      await db.from('abuse_log').insert({ user_id: userId, ip_hash: ipHash, action: 'suspicious_watch_time', video_id: videoId, flagged: true, reason: `watch_time=${watchTime} > duration=${videoDuration}` });
      return res.status(400).json({ error: 'Invalid watch time' });
    }

    const recentCheck = await db.from('video_views').select('id').eq('user_id', userId).eq('video_id', videoId).gte('created_at', new Date(Date.now() - 2000).toISOString()).limit(1);
    if (recentCheck.data && recentCheck.data.length > 0) {
      return res.json({ ok: true, deduplicated: true });
    }

    await db.from('video_views').insert({
      user_id: userId,
      video_id: videoId,
      watch_time_seconds: watchTime || 0,
      video_duration_seconds: videoDuration || 0,
      completed: completed || false,
      replayed: replayed || false,
      replay_count: replayCount || 0,
      ip_hash: ipHash,
      ended_at: new Date().toISOString(),
    });

    await updateVideoScore(videoId);

    if (completed) {
      await updateUserInterests(userId, videoId);
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[TrackView] Error:', err?.message || err);
    res.status(500).json({ error: 'Failed to track view' });
  }
}

export async function handleTrackInteraction(req: Request, res: Response) {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' });

    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth required' });

    const { videoId, type, data } = req.body;
    if (!videoId || !type) return res.status(400).json({ error: 'videoId and type required' });

    const _ipHash = getIpHash(req);

    if (type === 'like') {
      const existing = await db.from('likes').select('id').eq('user_id', userId).eq('video_id', videoId).limit(1);
      if (existing.data && existing.data.length > 0) {
        await db.from('likes').delete().eq('user_id', userId).eq('video_id', videoId);
        const r = await db.from('videos').select('likes').eq('id', videoId).single();
        if (r.data) await db.from('videos').update({ likes: Math.max(0, (r.data.likes || 0) - 1) }).eq('id', videoId);
      } else {
        await db.from('likes').insert({ user_id: userId, video_id: videoId });
        const r = await db.from('videos').select('likes').eq('id', videoId).single();
        if (r.data) await db.from('videos').update({ likes: (r.data.likes || 0) + 1 }).eq('id', videoId);
      }
    } else if (type === 'comment') {
      await db.from('comments').insert({ user_id: userId, video_id: videoId, text: data?.text || '' });
      const { count } = await db.from('comments').select('id', { count: 'exact', head: true }).eq('video_id', videoId);
      await db.from('videos').update({ comments_count: count || 0 }).eq('id', videoId);
    } else if (type === 'share') {
      await db.from('shares').insert({ user_id: userId, video_id: videoId, platform: data?.platform || 'copy' });
      const { count } = await db.from('shares').select('id', { count: 'exact', head: true }).eq('video_id', videoId);
      await db.from('videos').update({ shares_count: count || 0 }).eq('id', videoId);
    } else if (type === 'follow') {
      const targetUserId = data?.targetUserId;
      if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
      const existing = await db.from('followers').select('id').eq('follower_id', userId).eq('following_id', targetUserId).limit(1);
      if (existing.data && existing.data.length > 0) {
        await db.from('followers').delete().eq('follower_id', userId).eq('following_id', targetUserId);
      } else {
        await db.from('followers').insert({ follower_id: userId, following_id: targetUserId });
      }
    }

    await db.from('video_interactions').insert({ user_id: userId, video_id: videoId, interaction_type: type });

    await updateVideoScore(videoId);

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[TrackInteraction] Error:', err?.message || err);
    res.status(500).json({ error: 'Failed to track interaction' });
  }
}

async function updateVideoScore(videoId: string) {
  if (!db) return;
  try {
    const [viewsRes, likesRes, commentsRes, sharesRes, completionsRes, watchTimeRes] = await Promise.all([
      db.from('video_views').select('id', { count: 'exact', head: true }).eq('video_id', videoId),
      db.from('likes').select('id', { count: 'exact', head: true }).eq('video_id', videoId),
      db.from('comments').select('id', { count: 'exact', head: true }).eq('video_id', videoId),
      db.from('shares').select('id', { count: 'exact', head: true }).eq('video_id', videoId),
      db.from('video_views').select('id', { count: 'exact', head: true }).eq('video_id', videoId).eq('completed', true),
      db.from('video_views').select('watch_time_seconds').eq('video_id', videoId),
    ]);

    const totalViews = viewsRes.count || 0;
    const totalLikes = likesRes.count || 0;
    const totalComments = commentsRes.count || 0;
    const totalShares = sharesRes.count || 0;
    const totalCompletions = completionsRes.count || 0;
    const totalWatchTime = watchTimeRes.data?.reduce((sum: number, r: any) => sum + (r.watch_time_seconds || 0), 0) || 0;

    const stats = { total_watch_time: totalWatchTime, total_likes: totalLikes, total_comments: totalComments, total_shares: totalShares, total_completions: totalCompletions };
    const score = computeScore(stats);

    const { data: existing } = await db.from('video_scores').select('video_id, test_group_views, test_group_size, distribution_phase, max_reach').eq('video_id', videoId).single();

    let distributionPhase = existing?.distribution_phase || 'test';
    let maxReach = existing?.max_reach || TEST_GROUP_MAX;
    const testGroupViews = (existing?.test_group_views || 0) + 1;
    const testGroupEngagement = totalViews > 0 ? (totalLikes + totalComments + totalShares) / totalViews : 0;

    if (distributionPhase === 'test' && testGroupViews >= (existing?.test_group_size || TEST_GROUP_MIN)) {
      if (testGroupEngagement >= TEST_GROUP_ENGAGEMENT_THRESHOLD) {
        distributionPhase = 'expanding';
        maxReach = maxReach * EXPANSION_MULTIPLIER;
      } else {
        distributionPhase = 'limited';
        maxReach = Math.floor(maxReach * 0.5);
      }
    } else if (distributionPhase === 'expanding' && totalViews >= maxReach) {
      if (testGroupEngagement >= TEST_GROUP_ENGAGEMENT_THRESHOLD * 0.8) {
        distributionPhase = 'viral';
        maxReach = maxReach * EXPANSION_MULTIPLIER;
      } else {
        distributionPhase = 'stable';
      }
    }

    const scoreRow = {
      video_id: videoId,
      total_watch_time: totalWatchTime,
      total_likes: totalLikes,
      total_comments: totalComments,
      total_shares: totalShares,
      total_completions: totalCompletions,
      total_views: totalViews,
      score,
      test_group_views: testGroupViews,
      test_group_engagement: testGroupEngagement,
      distribution_phase: distributionPhase,
      max_reach: maxReach,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await db.from('video_scores').update(scoreRow).eq('video_id', videoId);
    } else {
      await db.from('video_scores').insert({ ...scoreRow, test_group_size: TEST_GROUP_MIN + Math.floor(Math.random() * (TEST_GROUP_MAX - TEST_GROUP_MIN)) });
    }

    await db.from('videos').update({
      engagement_score: score,
      is_eligible_for_fyp: distributionPhase !== 'limited',
      views: totalViews,
      likes: totalLikes,
      comments_count: totalComments,
      shares_count: totalShares,
    }).eq('id', videoId);

    trendingCache.data = null;
  } catch (err: any) {
    console.error('[updateVideoScore] Error:', err?.message || err);
  }
}

async function updateUserInterests(userId: string, videoId: string) {
  if (!db) return;
  try {
    const { data: video } = await db.from('videos').select('category').eq('id', videoId).single();
    if (!video?.category) return;

    const { data: existing } = await db.from('user_interests').select('id, weight').eq('user_id', userId).eq('category', video.category).single();
    if (existing) {
      await db.from('user_interests').update({ weight: Math.min(100, existing.weight + 0.5), updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await db.from('user_interests').insert({ user_id: userId, category: video.category, weight: 1.0 });
    }

    const { data: hashtags } = await db.from('video_hashtags').select('hashtag').eq('video_id', videoId);
    if (hashtags) {
      for (const h of hashtags) {
        const { data: ex } = await db.from('user_interests').select('id, weight').eq('user_id', userId).eq('category', h.hashtag).single();
        if (ex) {
          await db.from('user_interests').update({ weight: Math.min(100, ex.weight + 0.3), updated_at: new Date().toISOString() }).eq('id', ex.id);
        } else {
          await db.from('user_interests').insert({ user_id: userId, category: h.hashtag, weight: 0.5 });
        }
      }
    }
  } catch (err: any) {
    console.error('[updateUserInterests] Error:', err?.message || err);
  }
}

export async function handleGetVideoScore(req: Request, res: Response) {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' });
    const videoId = req.params.videoId;
    if (!videoId) return res.status(400).json({ error: 'videoId required' });

    const { data } = await db.from('video_scores').select('*').eq('video_id', videoId).single();
    res.json({ score: data || null });
  } catch (_err) {
    res.status(500).json({ error: 'Failed to get score' });
  }
}

export function invalidateFeedCache(userId?: string) {
  if (userId) {
    for (const key of feedCache.keys()) {
      if (key.startsWith(userId)) feedCache.delete(key);
    }
  } else {
    feedCache.clear();
  }
  trendingCache.data = null;
}
