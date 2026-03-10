/**
 * LiveKit service: generate access tokens for creators (publish) and viewers (subscribe).
 * Frontend uses token to connect to LIVEKIT_URL.
 */

import { AccessToken } from 'livekit-server-sdk';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

export function isLiveKitConfigured(): boolean {
  return Boolean(API_KEY && API_SECRET);
}

export interface CreateTokenOptions {
  userId: string;
  roomName: string;
  /** Creator/host can publish; viewer only subscribes. Default false (viewer). */
  canPublish?: boolean;
  /** Display name for the participant. */
  name?: string;
  /** Token TTL. Default 6h. */
  ttl?: string | number;
}

/**
 * Create a LiveKit access token for a user to join a room.
 * Use canPublish: true for the stream host, false for viewers.
 */
export async function createLiveToken(options: CreateTokenOptions): Promise<string> {
  if (!API_KEY || !API_SECRET) {
    throw new Error('LiveKit is not configured (missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET)');
  }

  const { userId, roomName, canPublish = false, name = userId, ttl = '6h' } = options;

  const at = new AccessToken(API_KEY, API_SECRET, {
    identity: userId,
    name,
    ttl,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe: true,
  });

  return await at.toJwt();
}
