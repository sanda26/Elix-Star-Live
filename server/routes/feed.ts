/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { appendFile } from "fs/promises";
import {
  getAllVideos,
  getVideo,
  incrementStat,
  decrementStat,
} from "../lib/videoStore";
import { getPool } from "../lib/postgres";
import { getTokenFromRequest, verifyAuthToken } from "./auth";

const DEBUG_LOG_PATH =
  "c:\\Users\\Sanda\\Desktop\\Elix Star Live\\.cursor\\debug.log";

async function debugNDJSON(payload: Record<string, any>) {
  // #region agent log
  try {
    await appendFile(DEBUG_LOG_PATH, JSON.stringify(payload) + "\n", "utf8");
  } catch {
    // ignore logging errors; never block requests
  }
  // #endregion
}

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

function computeScore(s: {
  total_watch_time: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_completions: number;
}): number {
  return (
    (s.total_watch_time || 0) * SCORE_WEIGHTS.watch_time +
    (s.total_likes || 0) * SCORE_WEIGHTS.likes +
    (s.total_comments || 0) * SCORE_WEIGHTS.comments +
    (s.total_shares || 0) * SCORE_WEIGHTS.shares +
    (s.total_completions || 0) * SCORE_WEIGHTS.completions
  );
}

function getIpHash(req: Request): string {
  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.ip ||
    "unknown";
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = (hash << 5) - hash + ip.charCodeAt(i);
    hash |= 0;
  }
  return "ip_" + Math.abs(hash).toString(36);
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
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = verifyAuthToken(token);
  return payload?.sub ?? null;
}

async function getTrendingVideos(limit: number): Promise<any[]> {
  const db = getPool();
  if (!db) return [];
  const now = Date.now();
  if (trendingCache.data && now - trendingCache.ts < TRENDING_CACHE_TTL) {
    return trendingCache.data.slice(0, limit);
  }

  let res = await db
    .from("videos")
    .select(
      "*, user:users ( id, username, display_name, avatar_url, is_creator )",
    )
    .eq("is_public", true)
    .order("engagement_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (res.error) {
    res = await db
      .from("videos")
      .select(
        "*, user:profiles!user_id ( user_id, username, display_name, avatar_url, is_creator )",
      )
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(100);
  }

  if (res.error) {
    res = await db
      .from("videos")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(100);
  }

  const data = res.data || [];
  trendingCache.data = data;
  trendingCache.ts = now;
  return data.slice(0, limit);
}

async function getFollowingVideoIds(userId: string): Promise<string[]> {
  const db = getPool();
  if (!db) return [];
  const { data: following } = await db
    .from("followers")
    .select("following_id")
    .eq("follower_id", userId);
  const ids = following?.map((f: any) => f.following_id) || [];
  if (ids.length === 0) return [];
  const { data } = await db
    .from("videos")
    .select("id")
    .in("user_id", ids)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);
  return data?.map((v: any) => v.id) || [];
}

async function getUserInterests(userId: string): Promise<Map<string, number>> {
  const db = getPool();
  if (!db) return new Map();
  const { data } = await db
    .from("user_interests")
    .select("category, weight")
    .eq("user_id", userId)
    .order("weight", { ascending: false })
    .limit(20);
  const map = new Map<string, number>();
  data?.forEach((d: any) => map.set(d.category, d.weight));
  return map;
}

async function getWatchedVideoIds(userId: string): Promise<Set<string>> {
  const db = getPool();
  if (!db) return new Set();
  const { data } = await db
    .from("video_views")
    .select("video_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  return new Set(data?.map((d: any) => d.video_id) || []);
}

async function getNotInterestedIds(userId: string): Promise<Set<string>> {
  const db = getPool();
  if (!db) return new Set();
  const { data } = await db
    .from("user_not_interested")
    .select("video_id")
    .eq("user_id", userId)
    .limit(500);
  return new Set(data?.map((d: any) => d.video_id) || []);
}

async function getLikedVideoCategories(userId: string): Promise<string[]> {
  const db = getPool();
  if (!db) return [];
  // Use likes table
  const { data: likes } = await db
    .from("likes")
    .select("video_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (!likes || likes.length === 0) return [];
  const videoIds = likes.map((l: any) => l.video_id);
  const { data: videos } = await db
    .from("videos")
    .select("category")
    .in("id", videoIds)
    .not("category", "is", null);
  return videos?.map((v: any) => v.category).filter(Boolean) || [];
}

function personalizeAndRank(
  videos: any[],
  followingIds: string[],
  interests: Map<string, number>,
  watchedIds: Set<string>,
  notInterestedIds: Set<string>,
  likedCategories: string[],
): any[] {
  const followingSet = new Set(followingIds);
  const categoryBoost = new Map<string, number>();
  likedCategories.forEach((cat) => {
    categoryBoost.set(cat, (categoryBoost.get(cat) || 0) + 1);
  });

  const scored = videos
    .filter((v) => !notInterestedIds.has(v.id))
    .map((v) => {
      let score = v.engagement_score || 0;

      const userId = v.user?.id || v.user?.user_id || v.user_id;
      if (userId && followingSet.has(userId)) score += 200;

      const cat = v.category;
      if (cat && interests.has(cat)) score += interests.get(cat)! * 50;
      if (cat && categoryBoost.has(cat)) score += categoryBoost.get(cat)! * 30;

      if (watchedIds.has(v.id)) score -= 100;

      const ageHours =
        (Date.now() - new Date(v.created_at).getTime()) / 3_600_000;
      if (ageHours < 1) score += 150;
      else if (ageHours < 6) score += 80;
      else if (ageHours < 24) score += 30;

      score += Math.random() * 50;

      return { ...v, _feedScore: score };
    });

  scored.sort((a, b) => b._feedScore - a._feedScore);
  return scored;
}

function formatVideoForClient(
  v: any,
  likedSet: Set<string>,
  followingSet: Set<string>,
): any {
  const u = v.user;
  const uid = u?.user_id ?? u?.id ?? v.user_id ?? "unknown";
  const uname = u?.username ?? "user";
  return {
    id: v.id,
    url: v.url || v.video_url, // Handle both
    thumbnail: v.thumbnail_url || v.thumb_url || "",
    duration: v.duration_seconds
      ? `${Math.floor(v.duration_seconds / 60)}:${String(Math.floor(v.duration_seconds % 60)).padStart(2, "0")}`
      : "0:15",
    user: {
      id: uid,
      username: uname,
      name: u?.display_name ?? uname,
      avatar:
        u?.avatar_url ??
        `https://ui-avatars.com/api/?name=${encodeURIComponent(uname)}`,
      level: 1,
      isVerified: !!u?.is_creator,
      followers: 0,
      following: 0,
    },
    description: v.description || v.caption || "",
    hashtags: v.hashtags || [],
    music: {
      id: "original",
      title: "Original Sound",
      artist: u?.display_name ?? uname,
      duration: "0:15",
    },
    stats: {
      views: v.views || 0,
      likes: v.likes || v.likes_count || 0,
      comments: v.comments || v.comments_count || 0,
      shares: v.shares || v.shares_count || 0,
      saves: 0,
    },
    createdAt: v.created_at,
    location: "For You",
    isLiked: likedSet.has(v.id),
    isSaved: false,
    isFollowing: uid !== "unknown" && followingSet.has(uid),
    comments: [],
    quality: "auto",
    privacy: v.is_public === false ? "private" : "public",
    engagementScore: v.engagement_score || 0,
  };
}

export async function handleForYouFeed(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    );
    const offset = (page - 1) * limit;

    // Always serve from in-memory store (source of truth during runtime).
    // Postgres is used only for persistence across server restarts.
    const cacheKey = `mem:${page}:${limit}`;
    const cached = feedCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return res.json({
        videos: cached.data,
        page,
        limit,
        hasMore: true,
        total: cached.data.length,
        source: "cache",
      });
    }

    const memAll = getAllVideos();
    // Do not drop videos solely because `url` is empty after a restart.
    // The client already shows a retry/processing state for unavailable videos.
    // Filtering by `url` makes uploads disappear entirely on restart.
    const memVideos = memAll;
    const total = memVideos.length;
    const paginated = memVideos.slice(offset, offset + limit);

    // #region agent log
    await debugNDJSON({
      location: "feed.ts:handleForYouFeed",
      message: "ForYou feed in-memory counts",
      hypothesisId: "FY1",
      timestamp: Date.now(),
      runId: "pre-fix",
      data: {
        memAllCount: memAll.length,
        memWithNonEmptyUrl: memVideos.length,
        page,
        limit,
        offset,
        firstVideoId: memVideos[0]?.id ?? null,
      },
    });
    // #endregion

    const formatted = paginated.map((v) => ({
      id: v.id,
      url: v.url,
      thumbnail: v.thumbnail,
      duration: v.duration,
      user: {
        id: v.userId,
        username: v.username,
        name: v.displayName,
        avatar: v.avatar,
      },
      description: v.description,
      hashtags: v.hashtags,
      music: v.music,
      stats: {
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: v.shares,
        saves: v.saves,
      },
      createdAt: v.createdAt,
    }));

    if (formatted.length > 0) {
      feedCache.set(cacheKey, { data: formatted, ts: Date.now() });
    }

    res.json({
      videos: formatted,
      page,
      limit,
      hasMore: total > offset + limit,
      total,
      source: "memory",
    });
  } catch (err: any) {
    console.error("[ForYouFeed] Error:", err?.message || err);
    res.status(500).json({ error: "Failed to generate feed" });
  }
}

export async function handleTrackView(req: Request, res: Response) {
  try {
    const {
      videoId,
      watchTime,
      videoDuration,
      completed,
    } = req.body;
    if (!videoId) return res.status(400).json({ error: "videoId required" });

    const db = getPool();

    // Always increment the in-memory stat (used for feed ranking)
    incrementStat(videoId, "views");

    if (!db) {
      return res.json({ ok: true });
    }

    const userId = await getUserId(req);
    const ipHash = getIpHash(req);
    const rateKey = userId ? `${userId}:${ipHash}` : ipHash;

    if (!checkRateLimit(rateKey)) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    if (watchTime && videoDuration && watchTime > videoDuration * 1.5) {
      return res.status(400).json({ error: "Invalid watch time" });
    }

    // Persist view to Postgres if the table exists
    try {
      await db.query(
        `INSERT INTO video_views (id, user_id, video_id, watch_time_seconds, video_duration_seconds, completed, ip_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT DO NOTHING`,
        [
          `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          userId || 'anonymous',
          videoId,
          watchTime || 0,
          videoDuration || 0,
          completed || false,
          ipHash,
        ],
      );
    } catch {
      // video_views table may not exist yet — non-fatal
    }

    // Update video stats in the videos table
    try {
      await db.query(`UPDATE videos SET views = views + 1 WHERE id = $1`, [videoId]);
    } catch {
      // non-fatal
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[TrackView] Error:", err?.message || err);
    res.status(500).json({ error: "Failed to track view" });
  }
}

export async function handleTrackInteraction(req: Request, res: Response) {
  try {
    const { videoId, type, data: _data } = req.body;
    if (!videoId || !type)
      return res.status(400).json({ error: "videoId and type required" });

    if (type === "like") incrementStat(videoId, "likes");
    else if (type === "comment") incrementStat(videoId, "comments");
    else if (type === "share") incrementStat(videoId, "shares");
    else if (type === "save") incrementStat(videoId, "saves");

    const db = getPool();
    if (db) {
      const col = type === "like" ? "likes" : type === "comment" ? "comments" : type === "share" ? "shares" : type === "save" ? "saves" : null;
      if (col) {
        try { await db.query(`UPDATE videos SET ${col} = ${col} + 1 WHERE id = $1`, [videoId]); } catch {}
      }
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[TrackInteraction] Error:", err?.message || err);
    res.status(500).json({ error: "Failed to track interaction" });
  }
}

async function updateVideoScore(videoId: string) {
  const db = getPool();
  if (!db) return;
  try {
    const [
      viewsRes,
      likesRes,
      commentsRes,
      sharesRes,
      completionsRes,
      watchTimeRes,
    ] = await Promise.all([
      db
        .from("video_views")
        .select("id", { count: "exact", head: true })
        .eq("video_id", videoId),
      db
        .from("likes")
        .select("video_id", { count: "exact", head: true })
        .eq("video_id", videoId),
      db
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("video_id", videoId),
      db
        .from("shares")
        .select("id", { count: "exact", head: true })
        .eq("video_id", videoId),
      db
        .from("video_views")
        .select("id", { count: "exact", head: true })
        .eq("video_id", videoId)
        .eq("completed", true),
      db
        .from("video_views")
        .select("watch_time_seconds")
        .eq("video_id", videoId),
    ]);

    const totalViews = viewsRes.count || 0;
    const totalLikes = likesRes.count || 0;
    const totalComments = commentsRes.count || 0;
    const totalShares = sharesRes.count || 0;
    const totalCompletions = completionsRes.count || 0;
    const totalWatchTime =
      watchTimeRes.data?.reduce(
        (sum: number, r: any) => sum + (r.watch_time_seconds || 0),
        0,
      ) || 0;

    const stats = {
      total_watch_time: totalWatchTime,
      total_likes: totalLikes,
      total_comments: totalComments,
      total_shares: totalShares,
      total_completions: totalCompletions,
    };
    const score = computeScore(stats);

    const { data: existing } = await db
      .from("video_scores")
      .select(
        "video_id, test_group_views, test_group_size, distribution_phase, max_reach",
      )
      .eq("video_id", videoId)
      .single();

    let distributionPhase = existing?.distribution_phase || "test";
    let maxReach = existing?.max_reach || TEST_GROUP_MAX;
    const testGroupViews = (existing?.test_group_views || 0) + 1;
    const testGroupEngagement =
      totalViews > 0
        ? (totalLikes + totalComments + totalShares) / totalViews
        : 0;

    if (
      distributionPhase === "test" &&
      testGroupViews >= (existing?.test_group_size || TEST_GROUP_MIN)
    ) {
      if (testGroupEngagement >= TEST_GROUP_ENGAGEMENT_THRESHOLD) {
        distributionPhase = "expanding";
        maxReach = maxReach * EXPANSION_MULTIPLIER;
      } else {
        distributionPhase = "limited";
        maxReach = Math.floor(maxReach * 0.5);
      }
    } else if (distributionPhase === "expanding" && totalViews >= maxReach) {
      if (testGroupEngagement >= TEST_GROUP_ENGAGEMENT_THRESHOLD * 0.8) {
        distributionPhase = "viral";
        maxReach = maxReach * EXPANSION_MULTIPLIER;
      } else {
        distributionPhase = "stable";
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
      await db.from("video_scores").update(scoreRow).eq("video_id", videoId);
    } else {
      await db
        .from("video_scores")
        .insert({
          ...scoreRow,
          test_group_size:
            TEST_GROUP_MIN +
            Math.floor(Math.random() * (TEST_GROUP_MAX - TEST_GROUP_MIN)),
        });
    }

    await db
      .from("videos")
      .update({
        engagement_score: score,
        is_eligible_for_fyp: distributionPhase !== "limited",
        views: totalViews,
        likes: totalLikes,
        comments: totalComments,
        shares: totalShares,
      })
      .eq("id", videoId);

    trendingCache.data = null;
  } catch (err: any) {
    console.error("[updateVideoScore] Error:", err?.message || err);
  }
}

async function updateUserInterests(userId: string, videoId: string) {
  const db = getPool();
  if (!db) return;
  try {
    const { data: video } = await db
      .from("videos")
      .select("category")
      .eq("id", videoId)
      .single();
    if (!video?.category) return;

    const { data: existing } = await db
      .from("user_interests")
      .select("id, weight")
      .eq("user_id", userId)
      .eq("category", video.category)
      .single();
    if (existing) {
      await db
        .from("user_interests")
        .update({
          weight: Math.min(100, existing.weight + 0.5),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await db
        .from("user_interests")
        .insert({ user_id: userId, category: video.category, weight: 1.0 });
    }

    const { data: hashtags } = await db
      .from("video_hashtags")
      .select("hashtag_id")
      .eq("video_id", videoId);

    if (hashtags) {
      for (const h of hashtags) {
        const { data: tagRow } = await db
          .from("hashtags")
          .select("tag")
          .eq("id", h.hashtag_id)
          .single();
        if (!tagRow) continue;

        const { data: ex } = await db
          .from("user_interests")
          .select("id, weight")
          .eq("user_id", userId)
          .eq("category", tagRow.tag)
          .single();
        if (ex) {
          await db
            .from("user_interests")
            .update({
              weight: Math.min(100, ex.weight + 0.3),
              updated_at: new Date().toISOString(),
            })
            .eq("id", ex.id);
        } else {
          await db
            .from("user_interests")
            .insert({ user_id: userId, category: tagRow.tag, weight: 0.5 });
        }
      }
    }
  } catch (err: any) {
    console.error("[updateUserInterests] Error:", err?.message || err);
  }
}

export async function handleGetVideoScore(req: Request, res: Response) {
  try {
    const videoId = req.params.videoId;
    if (!videoId) return res.status(400).json({ error: "videoId required" });

    const db = getPool();
    // ── No DB: return zero score ──
    if (!db) {
      const memVideo = getVideo(videoId);
      return res.json({
        score: memVideo
          ? {
              video_id: videoId,
              total_views: memVideo.views,
              total_likes: memVideo.likes,
              total_comments: memVideo.comments,
              total_shares: memVideo.shares,
              score: 0,
            }
          : 0,
      });
    }

    try {
      const result = await db.query(`SELECT * FROM video_scores WHERE video_id = $1 LIMIT 1`, [videoId]);
      res.json({ score: result.rows?.[0] || null });
    } catch {
      const memVideo = getVideo(videoId);
      res.json({ score: memVideo ? { video_id: videoId, total_views: memVideo.views, score: 0 } : null });
    }
  } catch (_err) {
    res.status(500).json({ error: "Failed to get score" });
  }
}

/** GET /api/feed/friends — videos from users the caller follows */
export async function handleFriendsFeed(req: Request, res: Response) {
  try {
    const token = getTokenFromRequest(req);
    const jwtUser = token ? verifyAuthToken(token) : null;
    if (!jwtUser) {
      return res.json({ videos: [] });
    }

    const { getFollowingIds } = await import("./profiles");
    const followingIds = getFollowingIds(jwtUser.sub);
    if (followingIds.length === 0) {
      return res.json({ videos: [] });
    }

    const followingSet = new Set(followingIds);
    const likedSet = new Set<string>();

    const db = getPool();
    if (db) {
      const { rows } = await db.query(
        `SELECT v.*, row_to_json(p) AS user
         FROM videos v
         LEFT JOIN profiles p ON p.user_id = v.user_id
         WHERE v.user_id = ANY($1) AND v.is_public != false
         ORDER BY v.created_at DESC
         LIMIT 50`,
        [followingIds],
      );
      const mapped = (rows || []).map((v: any) => formatVideoForClient(v, likedSet, followingSet));
      return res.json({ videos: mapped });
    }

    // In-memory fallback
    const allVideos = getAllVideos();
    const friendVids = allVideos
      .filter((v) => followingSet.has(v.user_id) && v.is_public !== false)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    const mapped = friendVids.map((v) => formatVideoForClient(v, likedSet, followingSet));
    return res.json({ videos: mapped });
  } catch (err) {
    console.error("[friends feed]", err);
    return res.json({ videos: [] });
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
