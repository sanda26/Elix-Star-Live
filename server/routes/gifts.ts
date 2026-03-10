/**
 * Gifts API: POST /api/gifts/send — validate and record gift (optional).
 * Real-time delivery stays via WebSocket (gift_sent). This endpoint can be used
 * for server-side validation, idempotency, or when client prefers REST.
 */

import { Request, Response } from 'express';
import { getTokenFromRequest, verifyAuthToken } from './auth';

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

/** POST /api/gifts/send — send gift (server validates; broadcast still via WS in live room) */
export async function handleSendGift(req: Request, res: Response) {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { room_id, gift_id, transaction_id } = req.body ?? {};
  const roomId = typeof room_id === 'string' ? room_id.trim() : '';
  const giftId = typeof gift_id === 'string' ? gift_id.trim() : '';

  if (!roomId || !giftId) {
    return res.status(400).json({ error: 'room_id and gift_id are required.' });
  }

  // Optional: validate gift_id against catalog and user balance (when DB exists).
  // For now we accept and return success; actual delivery is via WebSocket in the live room.
  return res.status(200).json({
    ok: true,
    room_id: roomId,
    gift_id: giftId,
    transaction_id: transaction_id || undefined,
    message: 'Gift sent. Delivery in room is via WebSocket.',
  });
}
