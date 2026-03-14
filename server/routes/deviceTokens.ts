/**
 * Device tokens (push) and notifications/send for Express.
 * POST /api/device-tokens, DELETE /api/device-tokens, POST /api/notifications/send.
 */

import { Request, Response } from "express";
import { getTokenFromRequest, verifyAuthToken } from "./auth";

const deviceTokens = new Map<
  string,
  { userId: string; token: string; platform: string; updatedAt: string }
>();

/** POST /api/device-tokens — register push token; auth required */
export function handleRegisterDeviceToken(req: Request, res: Response): void {
  const token = getTokenFromRequest(req);
  const jwtUser = token ? verifyAuthToken(token) : null;
  if (!jwtUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = req.body as { userId?: string; token?: string; platform?: string };
  const { userId, token: deviceToken, platform } = body ?? {};
  if (!userId || !deviceToken || !platform) {
    res.status(400).json({ error: "userId, token and platform are required" });
    return;
  }
  if (jwtUser.sub !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const key = `${userId}:${platform}`;
  deviceTokens.set(key, {
    userId,
    token: deviceToken,
    platform,
    updatedAt: new Date().toISOString(),
  });
  res.json({ success: true });
}

/** DELETE /api/device-tokens — unregister; auth required */
export function handleDeleteDeviceToken(req: Request, res: Response): void {
  const token = getTokenFromRequest(req);
  const jwtUser = token ? verifyAuthToken(token) : null;
  if (!jwtUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = req.body as { userId?: string; token?: string; platform?: string };
  const { userId, platform } = body ?? {};
  if (!userId || !platform) {
    res.status(400).json({ error: "userId and platform are required" });
    return;
  }
  if (jwtUser.sub !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const key = `${userId}:${platform}`;
  deviceTokens.delete(key);
  res.json({ success: true });
}

/** POST /api/notifications/send — stub; auth required. Wire FCM/APNs in production. */
export function handleSendNotificationToDevices(req: Request, res: Response): void {
  const token = getTokenFromRequest(req);
  const jwtUser = token ? verifyAuthToken(token) : null;
  if (!jwtUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const payload = req.body as { title?: string; body?: string; data?: Record<string, unknown> };
  const { title, body: messageBody } = payload ?? {};
  if (!title || !messageBody) {
    res.status(400).json({ error: "title and body are required" });
    return;
  }
  // TODO: use deviceTokens to send via FCM / APNs
  res.json({ success: true, queued: true });
}
