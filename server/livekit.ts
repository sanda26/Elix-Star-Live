import { AccessToken } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

export const isLiveKitConfigured = () => !!LIVEKIT_API_KEY && !!LIVEKIT_API_SECRET;

export function generateToken(
  roomName: string,
  participantName: string,
  participantIdentity: string,
  options: { canPublish?: boolean; canSubscribe?: boolean } = {}
): string {
  const { canPublish = false, canSubscribe = true } = options;

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantIdentity,
    name: participantName,
    ttl: '6h',
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish,
    canSubscribe,
    canPublishData: true,
  });

  return token.toJwt() as unknown as string;
}

export function generateHostToken(roomName: string, username: string, userId: string): string {
  return generateToken(roomName, username, userId, { canPublish: true, canSubscribe: true });
}

export function generateViewerToken(roomName: string, username: string, userId: string): string {
  return generateToken(roomName, username, userId, { canPublish: false, canSubscribe: true });
}
