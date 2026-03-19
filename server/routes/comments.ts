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

// In-memory comment store (used when no DATABASE_URL)
const memComments = new Map<string, DbCommentRow[]>(); // videoId → comments

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'comments.ts:handleGetVideoComments',message:'Comments served from memory fallback',runId:'pre-fix',hypothesisId:'H3_COMMENTS_NOT_PERSISTED',data:{videoId,hasDb:false},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // In-memory fallback
    const sort = getSort(req);
    const all = memComments.get(videoId) || [];
    const topLevel = all.filter(c => !c.parent_id);
    if (sort === "oldest") topLevel.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else topLevel.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const comments = topLevel.map(r => {
      const c = formatComment(r);
      const replies = all.filter(x => x.parent_id === r.id).map(formatComment);
      return { ...c, replies, reply_count: replies.length };
    });
    return res.json({ comments, source: "memory" });
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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'comments.ts:handleGetVideoComments',message:'Comments served from db',runId:'pre-fix',hypothesisId:'H3_COMMENTS_NOT_PERSISTED',data:{videoId,hasDb:true,topLevelCount:top.rows.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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

  const id = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();

  const row: DbCommentRow = {
    id,
    video_id: videoId,
    user_id: payload.sub,
    text,
    parent_id: parentId,
    created_at: createdAt,
  };

  const pool = getPool();
  if (!pool) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'comments.ts:handlePostVideoComment',message:'Comment write path: memory fallback',runId:'pre-fix',hypothesisId:'H3_COMMENTS_NOT_PERSISTED',data:{videoId,hasDb:false,isReply:Boolean(parentId)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // In-memory fallback
    if (!memComments.has(videoId)) memComments.set(videoId, []);
    memComments.get(videoId)!.push(row);
    if (!parentId) incrementStat(videoId, "comments");
    void getVideo(videoId);
    return res.status(201).json({ comment: formatComment(row) });
  }

  try {
    await pool.query(
      `INSERT INTO comments (id, video_id, user_id, text, parent_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, videoId, payload.sub, text, parentId, createdAt],
    );

    if (!parentId) {
      incrementStat(videoId, "comments");
      await pool
        .query(`UPDATE videos SET comments = GREATEST(0, COALESCE(comments, 0) + 1) WHERE id = $1`, [videoId])
        .catch(() => {});
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'comments.ts:handlePostVideoComment',message:'Comment write path: db',runId:'pre-fix',hypothesisId:'H3_COMMENTS_NOT_PERSISTED',data:{videoId,hasDb:true,isReply:Boolean(parentId)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
  if (!pool) {
    // In-memory fallback
    const list = memComments.get(videoId);
    if (!list) return res.status(404).json({ error: "Comment not found" });
    const idx = list.findIndex(c => c.id === commentId);
    if (idx === -1) return res.status(404).json({ error: "Comment not found" });
    if (list[idx].user_id !== payload.sub) return res.status(403).json({ error: "Forbidden" });
    const wasTopLevel = !list[idx].parent_id;
    list.splice(idx, 1);
    if (wasTopLevel) decrementStat(videoId, "comments");
    return res.json({ ok: true });
  }

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
