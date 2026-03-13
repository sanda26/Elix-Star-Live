/**
 * Live streaming API: list streams, start/end stream, get LiveKit token.
 * Flow: Creator POST /api/live/start -> get token (canPublish) -> join LiveKit room.
 *       Viewer GET /api/live/token?room=... -> get token (subscribe only) -> join room.
 */

import { Request, Response } from 'express';
import { getTokenFromRequest, verifyAuthToken } from '../routes/auth';
import { createLiveToken, isLiveKitConfigured, getLiveKitUrl } from '../services/livekit';

// In-memory active streams (key = roomName). Replace with DB when using Postgres.
// Extended payload so viewers can see the creator's display name.
const activeStreams = new Map<
  string,
  { userId: string; startedAt: string; displayName?: string }
>();

/** Internal helper so other modules (WebSocket server) can mark streams offline. */
export function removeActiveStream(roomId: string, userId?: string) {
  const s = activeStreams.get(roomId);
  if (!s) return;
  if (userId && s.userId !== userId) return;
  activeStreams.delete(roomId);
}

function requireAuth(req: Request, res: Response): { userId: string } | null {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Not authenticated.' });
    return null;
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return null;
  }
  return { userId: payload.sub };
}

/** GET /api/live/streams — list active streams */
export async function handleGetStreams(_req: Request, res: Response) {
  const streams = Array.from(activeStreams.entries()).map(([room, data]) => ({
    room_id: room,
    stream_key: room,
    user_id: data.userId,
    started_at: data.startedAt,
    status: 'live',
    // Expose a human-friendly title so For You / Spectator can show real creator name
    title: data.displayName || undefined,
    display_name: data.displayName || undefined,
  }));
  return res.status(200).json({ streams });
}

/** POST /api/live/start — creator starts stream; returns LiveKit token with canPublish */
export async function handleLiveStart(req: Request, res: Response) {
  const auth = requireAuth(req, res);
  if (!auth) return;

  if (!isLiveKitConfigured()) {
    return res.status(503).json({ error: 'Live streaming is not configured.' });
  }

  const { room, displayName } = req.body ?? {};
  const raw = typeof room === 'string' && room.trim() ? room.trim() : auth.userId;
  const roomName =
    raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) ||
    auth.userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);

  const safeDisplayName =
    typeof displayName === 'string'
      ? displayName.toString().slice(0, 80)
      : undefined;

  activeStreams.set(roomName, {
    userId: auth.userId,
    startedAt: new Date().toISOString(),
    displayName: safeDisplayName,
  });

  try {
    const token = await createLiveToken({
      userId: auth.userId,
      roomName,
      canPublish: true,
      name: auth.userId,
    });
    return res.status(200).json({
      room: roomName,
      token,
      stream_key: roomName,
      url: getLiveKitUrl(),
    });
  } catch (err) {
    activeStreams.delete(roomName);
    const message = err instanceof Error ? err.message : 'Failed to create token';
    return res.status(500).json({ error: message });
  }
}

/** POST /api/live/end — creator ends stream */
export async function handleLiveEnd(req: Request, res: Response) {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { room } = req.body ?? {};
  const roomName = typeof room === 'string' && room.trim() ? room.trim() : auth.userId;
  const stream = activeStreams.get(roomName);

  if (!stream || stream.userId !== auth.userId) {
    return res.status(404).json({ error: 'Stream not found or you are not the host.' });
  }

  activeStreams.delete(roomName);
  return res.status(200).json({ ok: true, room: roomName });
}

/** GET /api/live/token?room=... — viewer gets token to join room (subscribe only) */
export async function handleGetLiveToken(req: Request, res: Response) {
  const auth = requireAuth(req, res);
  if (!auth) return;

  if (!isLiveKitConfigured()) {
    return res.status(503).json({ error: 'Live streaming is not configured.' });
  }

  const room = req.query.room as string | undefined;
  const raw = typeof room === 'string' ? room.trim() : '';
  const roomName = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || null;

  if (!roomName) {
    return res.status(400).json({ error: 'Query parameter "room" is required and must be alphanumeric.' });
  }

  try {
    const token = await createLiveToken({
      userId: auth.userId,
      roomName,
      canPublish: false,
      name: auth.userId,
    });
    if (!token || token.length < 50) {
      return res.status(500).json({ error: 'Token generation failed.' });
    }
    const url = getLiveKitUrl();
    if (process.env.NODE_ENV !== 'production') {
      console.log('[live] token issued for room:', roomName, 'url:', url ? 'set' : 'MISSING');
    }
    return res.status(200).json({ room: roomName, token, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create token';
    return res.status(500).json({ error: message });
  }
}
