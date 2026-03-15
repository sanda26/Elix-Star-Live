/**
 * Gifts API: POST /api/gifts/send — validate and record gift (optional).
 * Real-time delivery stays via WebSocket (gift_sent). This endpoint can be used
 * for server-side validation, idempotency, or when client prefers REST.
 */

import { Request, Response } from "express";
import { getTokenFromRequest, verifyAuthToken } from "./auth";

function requireAuth(req: Request, res: Response): { userId: string } | null {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "Not authenticated." });
    return null;
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session." });
    return null;
  }
  return { userId: payload.sub };
}

/** POST /api/gifts/send — send gift (server validates; broadcast still via WS in live room) */
export async function handleSendGift(req: Request, res: Response) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/routes/gifts.ts:handleSendGift',message:'Gift send raw body',data:{rawBody:req.body,hasAuth:!!getTokenFromRequest(req)},timestamp:Date.now(),hypothesisId:'H_GIFT'})}).catch(()=>{});
  // #endregion
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { room_id, gift_id, transaction_id, streamKey, giftId: giftIdAlt } = req.body ?? {};
  const roomId = typeof room_id === "string" ? room_id.trim() : (typeof streamKey === "string" ? streamKey.trim() : "");
  const giftId = typeof gift_id === "string" ? gift_id.trim() : (typeof giftIdAlt === "string" ? giftIdAlt.trim() : "");

  if (!roomId || !giftId) {
    return res.status(400).json({ error: "room_id and gift_id are required." });
  }

  // Optional: validate gift_id against catalog and user balance (when DB exists).
  // For now we accept and return success; actual delivery is via WebSocket in the live room.
  return res.status(200).json({
    ok: true,
    room_id: roomId,
    gift_id: giftId,
    transaction_id: transaction_id || undefined,
    message: "Gift sent. Delivery in room is via WebSocket.",
  });
}

// Static gift catalog — populated from env or hardcoded defaults.
// Replace with DB query when Hetzner Postgres is connected.
const DEFAULT_GIFTS = [
  {
    gift_id: "rose",
    name: "Rose",
    gift_type: "small",
    coin_cost: 1,
    animation_url: "/gifts/rose.webm",
    sfx_url: null,
    is_active: true,
  },
  {
    gift_id: "heart",
    name: "Heart",
    gift_type: "small",
    coin_cost: 5,
    animation_url: "/gifts/heart.webm",
    sfx_url: null,
    is_active: true,
  },
  {
    gift_id: "kiss",
    name: "Kiss",
    gift_type: "small",
    coin_cost: 10,
    animation_url: "/gifts/kiss.webm",
    sfx_url: null,
    is_active: true,
  },
  {
    gift_id: "crown",
    name: "Crown",
    gift_type: "big",
    coin_cost: 50,
    animation_url: "/gifts/crown.webm",
    sfx_url: null,
    is_active: true,
  },
  {
    gift_id: "diamond",
    name: "Diamond",
    gift_type: "big",
    coin_cost: 100,
    animation_url: "/gifts/diamond.webm",
    sfx_url: null,
    is_active: true,
  },
  {
    gift_id: "rocket",
    name: "Rocket",
    gift_type: "big",
    coin_cost: 500,
    animation_url: "/gifts/rocket.webm",
    sfx_url: null,
    is_active: true,
  },
  {
    gift_id: "elix_global_universe",
    name: "Elix Universe",
    gift_type: "universe",
    coin_cost: 1000,
    animation_url: "/gifts/elix_global_universe.webm",
    sfx_url: null,
    is_active: true,
  },
  {
    gift_id: "elix_live_universe",
    name: "Elix Live",
    gift_type: "universe",
    coin_cost: 2000,
    animation_url: "/gifts/elix_live_universe.webm",
    sfx_url: null,
    is_active: true,
  },
  {
    gift_id: "elix_gold_universe",
    name: "Elix Gold",
    gift_type: "universe",
    coin_cost: 5000,
    animation_url: "/gifts/elix_gold_universe.webm",
    sfx_url: null,
    is_active: true,
  },
];

/** GET /api/gifts/catalog — return active gifts */
export async function handleGetGiftCatalog(_req: Request, res: Response) {
  return res.status(200).json({ gifts: DEFAULT_GIFTS });
}

/** GET /api/sounds — return active sound tracks */
export async function handleGetSounds(_req: Request, res: Response) {
  // Return empty — sound library will be populated from Bunny CDN storage when ready
  return res.status(200).json({ sounds: [] });
}
