import type { Request, Response } from "express";
import { getPool } from "../lib/postgres";
import { getTokenFromRequest, verifyAuthToken } from "./auth";
import { incrementStat, decrementStat, getVideo } from "../lib/videoStore";
import { getOrCreateProfile } from "./profiles";

type Sort = "newest" | "oldest";

type DbCommentRow = {
  id: string;
  video_id: string;
  user_id: string;
  text: string;
  parent_id: string | null;
  created_at: string;
};

function getSort(req: Request): Sort {
  const s = String(req.query.sort || "").toLowerCase();
  return s === "oldest" ? "oldest" : "newest";
}

function formatComment(row: DbCommentRow) {
  const profile = getOrCreateProfile(row.user_id);
  return {
    id: row.id,
    video_id: row.video_id,
    user_id: row.user_id,
    username: profile.username || profile.displayName || "User",
    avatar_url: profile.avatarUrl || "",
    level: profile.level ?? 1,
    text: row.text,
    likes: 0,
    created_at: row.created_at,
    parent_id: row.parent_id,
  };
}

export async function handleGetVideoComments(req: Request, res: Response) {
  const videoId = req.params.id;
  if (!videoId) return res.status(400).json({ error: "videoId required" });

  const pool = getPool();
  if (!pool) {
    return res.json({ comments: [], source: "memory" });
  }

  try {
    const sort = getSort(req);
    const order = sort === "oldest" ? "ASC" : "DESC";

    const top = await pool.query<DbCommentRow>(
      `SELECT id, video_id, user_id, text, parent_id, created_at
       FROM comments
       WHERE video_id = $1 AND parent_id IS NULL
       ORDER BY created_at ${order}
       LIMIT 200`,
      [videoId],
    );

    const parentIds = top.rows.map((r) => r.id);
    const repliesMap = new Map<string, ReturnType<typeof formatComment>[]>();
    if (parentIds.length > 0) {
      const replies = await pool.query<DbCommentRow>(
        `SELECT id, video_id, user_id, text, parent_id, created_at
         FROM comments
         WHERE video_id = $1 AND parent_id = ANY($2::text[])
         ORDER BY created_at ASC
         LIMIT 400`,
        [videoId, parentIds],
      );
      for (const r of replies.rows) {
        const pid = r.parent_id || "";
        if (!pid) continue;
        const list = repliesMap.get(pid) || [];
        list.push(formatComment(r));
        repliesMap.set(pid, list);
      }
    }

    const comments = top.rows.map((r) => {
      const c = formatComment(r);
      const replies = repliesMap.get(r.id) || [];
      return { ...c, replies, reply_count: replies.length };
    });

    return res.json({ comments, source: "db" });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to load comments" });
  }
}

export async function handlePostVideoComment(req: Request, res: Response) {
  const videoId = req.params.id;
  if (!videoId) return res.status(400).json({ error: "videoId required" });

  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  const payload = verifyAuthToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired session." });

  const text = String((req.body as any)?.text || "").trim();
  const parentIdRaw = (req.body as any)?.parentId;
  const parentId = typeof parentIdRaw === "string" && parentIdRaw.trim() ? parentIdRaw.trim() : null;

  if (!text) return res.status(400).json({ error: "text is required" });

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: "Database not configured." });

  try {
    const id = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();
    await pool.query(
      `INSERT INTO comments (id, video_id, user_id, text, parent_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, videoId, payload.sub, text, parentId, createdAt],
    );

    // Update counts (top-level only affects video stats)
    if (!parentId) {
      incrementStat(videoId, "comments");
      await pool
        .query(`UPDATE videos SET comments = GREATEST(0, COALESCE(comments, 0) + 1) WHERE id = $1`, [videoId])
        .catch(() => {});
    }

    const row: DbCommentRow = {
      id,
      video_id: videoId,
      user_id: payload.sub,
      text,
      parent_id: parentId,
      created_at: createdAt,
    };

    // Ensure video exists in memory (some flows read from store for UI stats)
    void getVideo(videoId);

    return res.status(201).json({ comment: formatComment(row) });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to add comment" });
  }
}

export async function handleDeleteVideoComment(req: Request, res: Response) {
  const videoId = req.params.id;
  const commentId = req.params.commentId;
  if (!videoId || !commentId) return res.status(400).json({ error: "videoId and commentId required" });

  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  const payload = verifyAuthToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired session." });

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: "Database not configured." });

  try {
    const existing = await pool.query<{ user_id: string; parent_id: string | null }>(
      `SELECT user_id, parent_id FROM comments WHERE id = $1 AND video_id = $2 LIMIT 1`,
      [commentId, videoId],
    );
    const row = existing.rows[0];
    if (!row) return res.status(404).json({ error: "Comment not found" });
    if (row.user_id !== payload.sub) return res.status(403).json({ error: "Forbidden" });

    await pool.query(`DELETE FROM comments WHERE id = $1 AND video_id = $2`, [commentId, videoId]);

    if (!row.parent_id) {
      decrementStat(videoId, "comments");
      await pool
        .query(`UPDATE videos SET comments = GREATEST(0, COALESCE(comments, 0) - 1) WHERE id = $1`, [videoId])
        .catch(() => {});
    }

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to delete comment" });
  }
}

