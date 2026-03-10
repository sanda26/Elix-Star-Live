/**
 * Upload API: upload video (and other files) to Bunny Storage.
 * Flow: Client sends file -> Backend -> Bunny Storage; users consume via CDN.
 */

import { Request, Response } from 'express';
import { getTokenFromRequest, verifyAuthToken } from './auth';
import { uploadToBunny, isBunnyConfigured } from '../services/bunny';

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

/**
 * POST /api/upload/video
 * Body: raw binary (Content-Type: application/octet-stream or video/*)
 * Query: path=streams/filename.mp4 (required path under storage zone)
 * Or use multipart later with multer if needed.
 */
export async function handleUploadVideo(req: Request, res: Response) {
  const auth = requireAuth(req, res);
  if (!auth) return;

  if (!isBunnyConfigured()) {
    return res.status(503).json({ error: 'Upload storage is not configured.' });
  }

  const path = (req.query.path as string)?.trim();
  if (!path || path.includes('..')) {
    return res.status(400).json({ error: 'Query "path" is required and must be a safe path (e.g. streams/video.mp4).' });
  }

  const body = req.body;
  if (!body || !(body instanceof Buffer) || body.length === 0) {
    return res.status(400).json({ error: 'Request body must be non-empty binary (video file).' });
  }

  const contentType = req.headers['content-type'] || 'video/mp4';
  const result = await uploadToBunny(path, body, contentType);

  if (!result.success) {
    return res.status(502).json({ error: result.error || 'Upload failed.' });
  }

  return res.status(201).json({
    path: result.path,
    cdn_url: result.cdnUrl,
  });
}
