/**
 * Bunny Storage service: upload files (e.g. video) to Bunny Storage.
 * CDN serves files via pull zone (e.g. https://cdn.anberlive.co.uk/streams/video.mp4).
 */

import { logger } from "../lib/logger";

const STORAGE_HOST = process.env.BUNNY_STORAGE_HOST || 'storage.bunnycdn.com';
const STORAGE_REGION = process.env.BUNNY_STORAGE_REGION || 'de';
const STORAGE_ZONE_RAW = process.env.BUNNY_STORAGE_ZONE || '';
/** Storage zone name for API path (e.g. "elixlive" from "elixlive.b-cdn.net"). */
const STORAGE_ZONE_NAME = STORAGE_ZONE_RAW.split('.')[0] || STORAGE_ZONE_RAW;
const ACCESS_KEY = process.env.BUNNY_STORAGE_API_KEY;

export function isBunnyConfigured(): boolean {
  return Boolean(ACCESS_KEY && STORAGE_ZONE_NAME);
}

/** Human-readable reason when Bunny is not configured (for error responses). */
export function getBunnyConfigError(): string {
  if (!STORAGE_ZONE_NAME) {
    return 'Bunny storage zone missing. Set BUNNY_STORAGE_ZONE in your environment (e.g. elixlive.b-cdn.net).';
  }
  if (!ACCESS_KEY) {
    return 'Bunny storage API key missing. Set BUNNY_STORAGE_API_KEY in your environment (from Bunny dashboard → Storage → Pull Zone → Password).';
  }
  return 'Bunny storage is not configured.';
}

/**
 * Upload a file to Bunny Storage.
 * @param path - Path under the zone, e.g. "streams/video.mp4"
 * @param body - Raw file buffer or stream
 * @param contentType - Optional Content-Type header
 * @returns Object with success and CDN URL (if VITE_CDN_URL or pull zone is set)
 */
export async function uploadToBunny(
  path: string,
  body: Buffer | Blob | ArrayBuffer,
  contentType?: string
): Promise<{ success: boolean; path: string; cdnUrl?: string; error?: string }> {
  if (!ACCESS_KEY || !STORAGE_ZONE_NAME) {
    return { success: false, path, error: getBunnyConfigError() };
  }

  const baseUrl = STORAGE_REGION === 'de'
    ? `https://${STORAGE_HOST}`
    : `https://${STORAGE_REGION}.${STORAGE_HOST}`;
  const url = `${baseUrl}/${STORAGE_ZONE_NAME}/${path.replace(/^\/+/, '')}`;

  const headers: Record<string, string> = {
    AccessKey: ACCESS_KEY,
  };
  if (contentType) headers['Content-Type'] = contentType;

  const bodyBuffer = body instanceof Buffer ? body : Buffer.from(body instanceof ArrayBuffer ? body : await (body as Blob).arrayBuffer());

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: bodyBuffer,
      duplex: 'half',
    } as RequestInit);

    if (!res.ok) {
      const text = await res.text();
      logger.error({ path, status: res.status, body: text }, "Bunny Storage upload failed");
      return { success: false, path, error: `Bunny API ${res.status}: ${text}` };
    }

    const cdnHost = process.env.VITE_CDN_URL || process.env.VITE_BUNNY_CDN_HOSTNAME;
    const cdnUrl = cdnHost
      ? `${cdnHost.replace(/\/$/, '')}/${path.replace(/^\/+/, '')}`
      : undefined;

    return { success: true, path, cdnUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, path }, "Bunny Storage upload exception");
    return { success: false, path, error: message };
  }
}
