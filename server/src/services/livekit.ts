import { AccessToken } from 'livekit-server-sdk';
import { config } from '../utils/config';

export class LiveKit {
  static getUrl(): string {
    return config.livekitUrl;
  }

  static async createToken(options: {
    userId: string;
    roomName: string;
    canPublish?: boolean;
    name?: string;
  }): Promise<string> {
    if (!config.livekitApiKey || !config.livekitApiSecret) {
      throw new Error('LiveKit not configured');
    }

    const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
      identity: options.userId,
      name: options.name || options.userId,
      ttl: '6h',
    });

    at.addGrant({
      roomJoin: true,
      room: options.roomName,
      canPublish: options.canPublish || false,
      canSubscribe: true,
    });

    return await at.toJwt();
  }
}
