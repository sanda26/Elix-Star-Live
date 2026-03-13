import { FastifyInstance } from 'fastify';
import { LiveKit } from '../services/livekit';

// In-memory stream store
const activeStreams = new Map<string, { streamKey: string; hostUserId: string; isLive: boolean; startedAt: string }>();

export async function liveRoutes(fastify: FastifyInstance) {
  // Get token for room
  fastify.get('/token', { preHandler: (fastify as any).verifyJWT }, async (request, reply) => {
    const { room } = request.query as { room: string };
    const user = request.user as { sub: string } | undefined;
    
    if (!room) return reply.code(400).send({ error: 'Room is required' });
    
    try {
      const token = await LiveKit.createToken({
        userId: user?.sub || 'anonymous',
        roomName: room,
        canPublish: false, // Viewer by default
      });
      
      return reply.send({ token, url: LiveKit.getUrl() });
    } catch (error) {
      console.error('Failed to generate token:', error);
      return reply.code(500).send({ error: 'Failed to generate token' });
    }
  });

  // Start stream (host) - requires authentication
  fastify.post('/start', { preHandler: (fastify as any).verifyJWT }, async (request, reply) => {
    const { room } = request.body as { room: string };
    const user = request.user as { sub: string } | undefined;
    
    if (!room) return reply.code(400).send({ error: 'Room is required' });
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    
    try {
      const token = await LiveKit.createToken({
        userId: user.sub,
        roomName: room,
        canPublish: true, // Host can publish
      });
      
      // Store active stream
      activeStreams.set(room, {
        streamKey: room,
        hostUserId: user.sub,
        isLive: true,
        startedAt: new Date().toISOString(),
      });
      
      return reply.send({ 
        token, 
        url: LiveKit.getUrl(), 
        room,
        isLive: true 
      });
    } catch (error) {
      console.error('Failed to start stream:', error);
      return reply.code(500).send({ error: 'Failed to start stream' });
    }
  });

  // End stream
  fastify.post('/end', async (request, reply) => {
    const { room } = request.body as { room: string };
    const user = request.user as { sub: string } | undefined;
    
    if (!room) return reply.code(400).send({ error: 'Room is required' });
    
    const stream = activeStreams.get(room);
    if (stream && stream.hostUserId === user?.sub) {
      activeStreams.delete(room);
    }
    
    return reply.send({ success: true, room });
  });

  // Get active streams
  fastify.get('/streams', async () => {
    const streams = Array.from(activeStreams.values()).map(s => ({
      streamKey: s.streamKey,
      hostUserId: s.hostUserId,
      isLive: s.isLive,
      startedAt: s.startedAt,
    }));
    
    return { streams };
  });
}
