import { Request, Response } from "express";
import { getTokenFromRequest, verifyAuthToken } from "./auth";
import { getPool } from "../lib/postgres";
import crypto from "crypto";

function getAuth(req: Request): string | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = verifyAuthToken(token);
  return payload?.sub ?? null;
}

export async function handleGetThreads(req: Request, res: Response): Promise<void> {
  const userId = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const db = getPool();
  if (!db) { res.json({ data: [] }); return; }

  const result = await db.query(
    `SELECT t.*,
      CASE WHEN t.user1_id = $1 THEN t.user2_id ELSE t.user1_id END AS other_user_id,
      COALESCE((
        SELECT COUNT(*)::int FROM messages msg
        WHERE msg.thread_id = t.id
          AND msg.sender_id <> $1
          AND COALESCE(msg.read, false) = false
      ), 0) AS unread_count
     FROM chat_threads t
     WHERE t.user1_id = $1 OR t.user2_id = $1
     ORDER BY t.last_at DESC`,
    [userId],
  );

  const threads = await Promise.all(result.rows.map(async (t: any) => {
    const otherUserId = t.other_user_id;
    let otherUser = { username: "User", display_name: "User", avatar_url: "" };
    try {
      const p = await db.query(
        `SELECT username, display_name, avatar_url FROM profiles WHERE user_id = $1 LIMIT 1`,
        [otherUserId],
      );
      if (p.rows[0]) {
        const row = p.rows[0] as { username?: string; display_name?: string; avatar_url?: string };
        otherUser = {
          username: row.username || "User",
          display_name: (row.display_name || row.username || "User") as string,
          avatar_url: row.avatar_url || "",
        };
      } else {
        const u = await db.query(`SELECT username, display_name, avatar_url FROM auth_users WHERE id = $1`, [otherUserId]);
        if (u.rows[0]) otherUser = u.rows[0];
      }
    } catch {}
    return {
      id: t.id,
      user1_id: t.user1_id,
      user2_id: t.user2_id,
      other_user_id: otherUserId,
      other_username: otherUser.display_name || otherUser.username || "User",
      other_avatar: otherUser.avatar_url || "",
      last_message: t.last_message || "",
      last_at: t.last_at,
      created_at: t.created_at,
    };
  }));

  res.json({ data: threads });
}

export async function handleCreateThread(req: Request, res: Response): Promise<void> {
  const userId = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { user2_id } = req.body || {};
  if (!user2_id) { res.status(400).json({ error: "user2_id required" }); return; }

  const db = getPool();
  if (!db) { res.status(503).json({ error: "Database not available" }); return; }

  const existing = await db.query(
    `SELECT id FROM chat_threads 
     WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)
     LIMIT 1`,
    [userId, user2_id]
  );

  if (existing.rows[0]) {
    res.json({ data: { id: existing.rows[0].id }, existing: true });
    return;
  }

  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO chat_threads (id, user1_id, user2_id) VALUES ($1, $2, $3)`,
    [id, userId, user2_id]
  );

  res.status(201).json({ data: { id }, existing: false });
}

export async function handleGetMessages(req: Request, res: Response): Promise<void> {
  const userId = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { threadId } = req.params;
  const db = getPool();
  if (!db) { res.json({ data: [] }); return; }

  const thread = await db.query(
    `SELECT id FROM chat_threads WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
    [threadId, userId]
  );
  if (!thread.rows[0]) { res.status(403).json({ error: "Not in this thread" }); return; }

  const result = await db.query(
    `SELECT * FROM messages WHERE thread_id = $1 ORDER BY created_at ASC`,
    [threadId],
  );

  await db
    .query(
      `UPDATE messages SET read = true WHERE thread_id = $1 AND sender_id <> $2`,
      [threadId, userId],
    )
    .catch(() => {});

  res.json({ data: result.rows });
}

export async function handleSendMessage(req: Request, res: Response): Promise<void> {
  const userId = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { threadId } = req.params;
  const { text } = req.body || {};
  if (!text?.trim()) { res.status(400).json({ error: "text required" }); return; }

  const db = getPool();
  if (!db) { res.status(503).json({ error: "Database not available" }); return; }

  const thread = await db.query(
    `SELECT id FROM chat_threads WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
    [threadId, userId]
  );
  if (!thread.rows[0]) { res.status(403).json({ error: "Not in this thread" }); return; }

  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO messages (id, thread_id, sender_id, text, read) VALUES ($1, $2, $3, $4, false)`,
    [id, threadId, userId, text.trim()],
  );

  await db.query(
    `UPDATE chat_threads SET last_message = $2, last_at = NOW() WHERE id = $1`,
    [threadId, text.trim()]
  );

  res.status(201).json({ data: { id, thread_id: threadId, sender_id: userId, text: text.trim(), created_at: new Date().toISOString() } });
}

export async function handleDeleteThread(req: Request, res: Response): Promise<void> {
  const userId = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { threadId } = req.params;
  const db = getPool();
  if (!db) { res.status(503).json({ error: "Database not available" }); return; }

  await db.query(
    `DELETE FROM chat_threads WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
    [threadId, userId]
  );

  res.json({ success: true });
}
