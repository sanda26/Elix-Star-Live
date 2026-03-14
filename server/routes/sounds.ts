/**
 * Sound library for Express. GET /api/sounds returns { tracks }.
 * Client expects SoundTrack[]; stub returns empty until Bunny CDN library is configured.
 */

import { Request, Response } from "express";

/** GET /api/sounds — return sound tracks (e.g. for video upload flow). */
export function handleGetSounds(_req: Request, res: Response): void {
  res.json({ tracks: [] });
}
