/**
 * Optional Postgres persistence for videos. When DATABASE_URL is set,
 * videos are loaded on startup and saved when added.
 */

import pg from "pg";
import type { Video } from "./videoStore";

const { Pool } = pg;

let pool: pg.Pool | null = null;

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
  } catch (err) {
    console.error("[postgres] init failed:", err);
    pool = null;
  }
}

export async function loadVideosFromDb(): Promise<Video[]> {
  if (!pool) return [];
  try {
    const res = await pool.query(
      `SELECT id, url, thumbnail, duration, user_id AS "userId", username, display_name AS "displayName",
              avatar, description, hashtags, music, views, likes, comments, shares, saves,
              created_at AS "createdAt", privacy
       FROM videos ORDER BY created_at DESC`
    );
    return (res.rows || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      url: String(row.url),
      thumbnail: String(row.thumbnail ?? ""),
      duration: Number(row.duration ?? 0),
      userId: String(row.userId),
      username: String(row.username ?? ""),
      displayName: String(row.displayName ?? ""),
      avatar: String(row.avatar ?? ""),
      description: String(row.description ?? ""),
      hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
      music: row.music && typeof row.music === "object" ? (row.music as Video["music"]) : null,
      views: Number(row.views ?? 0),
      likes: Number(row.likes ?? 0),
      comments: Number(row.comments ?? 0),
      shares: Number(row.shares ?? 0),
      saves: Number(row.saves ?? 0),
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
      privacy: String(row.privacy ?? "public"),
    }));
  } catch (err) {
    console.error("[postgres] load videos failed:", err);
    return [];
  }
}

export async function saveVideoToDb(video: Video): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO videos (id, url, thumbnail, duration, user_id, username, display_name, avatar, description, hashtags, music, views, likes, comments, shares, saves, created_at, privacy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       ON CONFLICT (id) DO UPDATE SET url=$2, thumbnail=$3, duration=$4, username=$6, display_name=$7, avatar=$8, description=$9, hashtags=$10, music=$11, views=$12, likes=$13, comments=$14, shares=$15, saves=$16, privacy=$18`,
      [
        video.id,
        video.url,
        video.thumbnail ?? "",
        video.duration ?? 0,
        video.userId,
        video.username ?? "",
        video.displayName ?? "",
        video.avatar ?? "",
        video.description ?? "",
        JSON.stringify(video.hashtags ?? []),
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
  } catch (err) {
    console.error("[postgres] save video failed:", err);
  }
}
