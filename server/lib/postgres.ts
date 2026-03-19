/**
 * Optional Postgres persistence for videos and live streams.
 * When DATABASE_URL is set, data is loaded on startup and persisted.
 */

import pg from "pg";
import type { Video } from "./videoStore";
import { logger } from "./logger";
import { appendFile } from "fs/promises";

const { Pool } = pg;

let pool: pg.Pool | null = null;
const DEBUG_LOG_PATH =
  "c:\\Users\\Sanda\\Desktop\\Elix Star Live\\.cursor\\debug.log";

async function debugNDJSON(payload: Record<string, unknown>) {
  // #region agent log
  try {
    await appendFile(DEBUG_LOG_PATH, JSON.stringify(payload) + "\n", "utf8");
  } catch {
    // ignore
  }
  // #endregion
}

function firstNonEmptyString(
  ...values: Array<unknown>
): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim().length > 0) return v;
    if (v instanceof Date) return v.toISOString();
  }
  return "";
}

export function getPool(): pg.Pool | null {
  return pool;
}

export function isPostgresConfigured(): boolean {
  return Boolean((process.env.DATABASE_URL || "").trim());
}

export async function initPostgres(): Promise<void> {
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) return;
  try {
    pool = new Pool({ connectionString: url });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        thumbnail TEXT DEFAULT '',
        duration NUMERIC DEFAULT 0,
        user_id TEXT NOT NULL,
        username TEXT DEFAULT '',
        display_name TEXT DEFAULT '',
        avatar TEXT DEFAULT '',
        description TEXT DEFAULT '',
        hashtags JSONB DEFAULT '[]',
        music JSONB DEFAULT NULL,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        saves INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        privacy TEXT DEFAULT 'public'
      )
    `);
    const videoCols: [string, string][] = [
      ['url', 'TEXT DEFAULT \'\''],
      ['thumbnail', 'TEXT DEFAULT \'\''],
      ['duration', 'NUMERIC DEFAULT 0'],
      ['user_id', 'TEXT DEFAULT \'\''],
      ['username', 'TEXT DEFAULT \'\''],
      ['display_name', 'TEXT DEFAULT \'\''],
      ['avatar', 'TEXT DEFAULT \'\''],
      ['description', 'TEXT DEFAULT \'\''],
      ['hashtags', 'JSONB DEFAULT \'[]\''],
      ['music', 'JSONB DEFAULT NULL'],
      ['views', 'INTEGER DEFAULT 0'],
      ['likes', 'INTEGER DEFAULT 0'],
      ['comments', 'INTEGER DEFAULT 0'],
      ['shares', 'INTEGER DEFAULT 0'],
      ['saves', 'INTEGER DEFAULT 0'],
      ['created_at', 'TIMESTAMPTZ DEFAULT NOW()'],
      ['privacy', 'TEXT DEFAULT \'public\''],
    ];
    for (const [col, def] of videoCols) {
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS ${col} ${def}`).catch(() => {});
    }
    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_streams (
        stream_key TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        display_name TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        ended_at TIMESTAMPTZ,
        is_live BOOLEAN DEFAULT TRUE,
        viewer_count INTEGER DEFAULT 0
      )
    `);

    // Comments (basic; likes are handled client-side for now)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        text TEXT NOT NULL,
        parent_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const commentCols: [string, string][] = [
      ["video_id", "TEXT DEFAULT ''"],
      ["user_id", "TEXT DEFAULT ''"],
      ["text", "TEXT DEFAULT ''"],
      ["parent_id", "TEXT"],
      ["created_at", "TIMESTAMPTZ DEFAULT NOW()"],
    ];
    for (const [col, def] of commentCols) {
      await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS ${col} ${def}`).catch(() => {});
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS likes (
        user_id TEXT NOT NULL,
        video_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, video_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS saves (
        user_id TEXT NOT NULL,
        video_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, video_id)
      )
    `);
  } catch (err) {
    logger.error({ err }, "Postgres init failed");
    pool = null;
  }
}

export async function loadVideosFromDb(): Promise<Video[]> {
  if (!pool) return [];
  try {
    const res = await pool.query(
      `SELECT *
       FROM videos ORDER BY created_at DESC`
    );
    // #region agent log
    await debugNDJSON({
      location: "postgres.ts:loadVideosFromDb",
      message: "Raw DB video row sample",
      hypothesisId: "DB1",
      runId: "pre-fix",
      timestamp: Date.now(),
      data: {
        totalRows: res.rows?.length || 0,
        first: res.rows?.[0]
          ? {
              id: String(res.rows[0].id ?? ""),
              url: String(res.rows[0].url ?? ""),
              video_url: String((res.rows[0] as Record<string, unknown>).video_url ?? ""),
              thumbnail: String(res.rows[0].thumbnail ?? ""),
              thumbnail_url: String((res.rows[0] as Record<string, unknown>).thumbnail_url ?? ""),
            }
          : null,
      },
    });
    // #endregion
    return (res.rows || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      url: firstNonEmptyString(row.url, row.video_url),
      thumbnail: firstNonEmptyString(row.thumbnail, row.thumbnail_url),
      duration: Number(row.duration ?? 0),
      userId: String(row.userId ?? row.user_id ?? ""),
      username: String(row.username ?? ""),
      displayName: String(row.displayName ?? row.display_name ?? ""),
      avatar: String(row.avatar ?? ""),
      description: String(row.description ?? ""),
      hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
      music: row.music && typeof row.music === "object" ? (row.music as Video["music"]) : null,
      views: Number(row.views ?? 0),
      likes: Number(row.likes ?? 0),
      comments: Number(row.comments ?? 0),
      shares: Number(row.shares ?? 0),
      saves: Number(row.saves ?? 0),
      createdAt: firstNonEmptyString(row.createdAt, row.created_at),
      privacy: String(row.privacy ?? "public"),
    }));
  } catch (err) {
    logger.error({ err }, "Postgres load videos failed");
    return [];
  }
}

export async function saveVideoToDb(video: Video): Promise<void> {
  if (!pool) {
    throw new Error("Postgres pool is not initialized");
  }
  const hashtags = Array.isArray(video.hashtags) ? video.hashtags : [];
  await pool.query(
    `INSERT INTO videos (id, url, thumbnail, duration, user_id, username, display_name, avatar, description, hashtags, music, views, likes, comments, shares, saves, created_at, privacy)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (id) DO UPDATE SET url=$2, thumbnail=$3, duration=$4, username=$6, display_name=$7, avatar=$8, description=$9, hashtags=$10::jsonb, music=$11::jsonb, views=$12, likes=$13, comments=$14, shares=$15, saves=$16, privacy=$18`,
    [
      video.id,
      video.url || "",
      video.thumbnail ?? "",
      video.duration ?? 0,
      video.userId,
      video.username ?? "",
      video.displayName ?? "",
      video.avatar ?? "",
      video.description ?? "",
      JSON.stringify(hashtags),
      video.music ? JSON.stringify(video.music) : null,
      video.views ?? 0,
      video.likes ?? 0,
      video.comments ?? 0,
      video.shares ?? 0,
      video.saves ?? 0,
      video.createdAt ?? new Date().toISOString(),
      video.privacy ?? "public",
    ]
  );
  logger.info({ videoId: video.id, url: video.url?.slice(0, 50) }, "Video saved to Postgres");
}

// ── Live stream persistence ─────────────────────────────────────────

export async function dbInsertLiveStream(
  streamKey: string,
  userId: string,
  displayName?: string,
): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO live_streams (stream_key, user_id, display_name, started_at, is_live, viewer_count)
       VALUES ($1, $2, $3, NOW(), TRUE, 0)
       ON CONFLICT (stream_key) DO UPDATE
         SET user_id = $2, display_name = $3, started_at = NOW(), ended_at = NULL, is_live = TRUE, viewer_count = 0`,
      [streamKey, userId, displayName ?? null],
    );
  } catch (err) {
    logger.error({ err }, "Postgres insert live_stream failed");
  }
}

export async function dbEndLiveStream(streamKey: string): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      `UPDATE live_streams SET is_live = FALSE, ended_at = NOW() WHERE stream_key = $1`,
      [streamKey],
    );
  } catch (err) {
    logger.error({ err }, "Postgres end live_stream failed");
  }
}

export async function dbUpdateViewerCount(
  streamKey: string,
  count: number,
): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      `UPDATE live_streams SET viewer_count = $2 WHERE stream_key = $1 AND is_live = TRUE`,
      [streamKey, count],
    );
  } catch (err) {
    logger.error({ err }, "Postgres update viewer_count failed");
  }
}

export async function dbGetLiveStreams(): Promise<
  { stream_key: string; user_id: string; display_name: string | null; started_at: string; viewer_count: number }[]
> {
  if (!pool) return [];
  try {
    const res = await pool.query(
      `SELECT stream_key, user_id, display_name, started_at, viewer_count
       FROM live_streams WHERE is_live = TRUE ORDER BY started_at DESC`,
    );
    return res.rows;
  } catch (err) {
    logger.error({ err }, "Postgres get live_streams failed");
    return [];
  }
}
