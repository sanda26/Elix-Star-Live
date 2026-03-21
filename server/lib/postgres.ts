/**
 * Optional Postgres persistence for videos and live streams.
 * When DATABASE_URL is set, data is loaded on startup and persisted.
 */

import pg from "pg";
import type { Video } from "./videoStore";
import { logger } from "./logger";

const { Pool } = pg;

let pool: pg.Pool | null = null;

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
  if (!url) {
    logger.warn("DATABASE_URL is not set — all data will be stored in memory only and lost on restart!");
    return;
  }
  try {
    const needsSsl = url.includes('neon.tech') || url.includes('sslmode=require');
    pool = new Pool({
      connectionString: url,
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });
    await pool.query("SELECT 1");
    logger.info("PostgreSQL connected successfully");
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        username TEXT DEFAULT '',
        display_name TEXT DEFAULT '',
        avatar_url TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY,
        username TEXT DEFAULT '',
        display_name TEXT DEFAULT '',
        avatar_url TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        website TEXT DEFAULT '',
        followers INT DEFAULT 0,
        following INT DEFAULT 0,
        video_count INT DEFAULT 0,
        coins INT DEFAULT 0,
        level INT DEFAULT 1,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_threads (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user1_id TEXT NOT NULL,
        user2_id TEXT NOT NULL,
        last_message TEXT DEFAULT '',
        last_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool
      .query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE`)
      .catch(() => {});

    await pool.query(`
      CREATE TABLE IF NOT EXISTS follows (
        follower_id TEXT NOT NULL,
        following_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (follower_id, following_id)
      )
    `);

    // Older DBs may have follows without PRIMARY KEY — INSERT ... ON CONFLICT / upserts will fail until fixed.
    const followsPk = await pool.query(`
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'follows' AND constraint_type = 'PRIMARY KEY'
      LIMIT 1
    `);
    if (!followsPk.rows?.length) {
      await pool.query(`ALTER TABLE follows ADD PRIMARY KEY (follower_id, following_id)`).catch((err) => {
        logger.error(
          { err: err instanceof Error ? err.message : err },
          "follows: could not add PRIMARY KEY (fix duplicates in Neon SQL editor). Follow saves may fail.",
        );
      });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_share_inbox (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        recipient_id TEXT NOT NULL,
        sharer_id TEXT NOT NULL,
        stream_key TEXT NOT NULL,
        host_user_id TEXT NOT NULL,
        host_name TEXT DEFAULT '',
        host_avatar TEXT DEFAULT '',
        sharer_name TEXT DEFAULT '',
        sharer_avatar TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (recipient_id, sharer_id, stream_key)
      )
    `);

    const userCount = await pool.query(`SELECT COUNT(*) as cnt FROM auth_users`);
    const profileCount = await pool.query(`SELECT COUNT(*) as cnt FROM profiles`);
    logger.info(`Tables ready — ${userCount.rows[0]?.cnt || 0} auth users, ${profileCount.rows[0]?.cnt || 0} profiles in DB`);
  } catch (err) {
    logger.error({ err }, "PostgreSQL init FAILED — data will NOT persist across restarts. Check DATABASE_URL and ensure PostgreSQL is running.");
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

/** Remove video and related engagement rows so it does not reappear after restart (Neon reload). */
export async function deleteVideoFromDb(videoId: string): Promise<void> {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM comments WHERE video_id = $1`, [videoId]);
    await client.query(`DELETE FROM likes WHERE video_id = $1`, [videoId]);
    await client.query(`DELETE FROM saves WHERE video_id = $1`, [videoId]);
    const del = await client.query(`DELETE FROM videos WHERE id = $1`, [videoId]);
    await client.query("COMMIT");
    logger.info({ videoId, videosDeleted: del.rowCount }, "Video deleted from Postgres");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    logger.error({ err, videoId }, "Postgres delete video failed");
    throw err;
  } finally {
    client.release();
  }
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

export type LiveShareInboxRow = {
  sharer_id: string;
  stream_key: string;
  host_user_id: string;
  host_name: string;
  host_avatar: string;
  sharer_name: string;
  sharer_avatar: string;
  created_at: string;
};

/** Someone shared a live with recipient (Inbox → Requests). */
export async function upsertLiveShareInbox(row: {
  recipientId: string;
  sharerId: string;
  streamKey: string;
  hostUserId: string;
  hostName: string;
  hostAvatar: string;
  sharerName: string;
  sharerAvatar: string;
}): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query(
      `INSERT INTO live_share_inbox (
         recipient_id, sharer_id, stream_key, host_user_id, host_name, host_avatar, sharer_name, sharer_avatar, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (recipient_id, sharer_id, stream_key) DO UPDATE SET
         host_user_id = EXCLUDED.host_user_id,
         host_name = EXCLUDED.host_name,
         host_avatar = EXCLUDED.host_avatar,
         sharer_name = EXCLUDED.sharer_name,
         sharer_avatar = EXCLUDED.sharer_avatar,
         created_at = NOW()`,
      [
        row.recipientId,
        row.sharerId,
        row.streamKey,
        row.hostUserId,
        row.hostName.slice(0, 120),
        row.hostAvatar.slice(0, 500),
        row.sharerName.slice(0, 120),
        row.sharerAvatar.slice(0, 500),
      ],
    );
    return true;
  } catch (err) {
    logger.error({ err }, "Postgres upsert live_share_inbox failed");
    return false;
  }
}

/** Shares from people you do not follow — keeps Main chat list uncluttered. */
export async function listLiveShareRequestsNonFollowing(recipientId: string): Promise<LiveShareInboxRow[]> {
  if (!pool) return [];
  try {
    const res = await pool.query(
      `SELECT l.sharer_id, l.stream_key, l.host_user_id,
              COALESCE(l.host_name, '') AS host_name,
              COALESCE(l.host_avatar, '') AS host_avatar,
              COALESCE(l.sharer_name, '') AS sharer_name,
              COALESCE(l.sharer_avatar, '') AS sharer_avatar,
              l.created_at
       FROM live_share_inbox l
       WHERE l.recipient_id = $1
         AND l.sharer_id <> $1
         AND NOT EXISTS (
           SELECT 1 FROM follows f
           WHERE f.follower_id = $1 AND f.following_id = l.sharer_id
         )
       ORDER BY l.created_at DESC
       LIMIT 80`,
      [recipientId],
    );
    return (res.rows || []).map((r: Record<string, unknown>) => ({
      sharer_id: String(r.sharer_id ?? ""),
      stream_key: String(r.stream_key ?? ""),
      host_user_id: String(r.host_user_id ?? ""),
      host_name: String(r.host_name ?? ""),
      host_avatar: String(r.host_avatar ?? ""),
      sharer_name: String(r.sharer_name ?? ""),
      sharer_avatar: String(r.sharer_avatar ?? ""),
      created_at:
        r.created_at instanceof Date ? (r.created_at as Date).toISOString() : String(r.created_at ?? ""),
    }));
  } catch (err) {
    logger.error({ err, recipientId }, "Postgres list live_share_inbox failed");
    return [];
  }
}
