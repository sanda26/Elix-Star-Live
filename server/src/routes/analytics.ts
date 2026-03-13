import { FastifyInstance } from 'fastify';

export async function analyticsRoutes(fastify: FastifyInstance) {
  // Track analytics event
  fastify.post('/track', async (request, reply) => {
    const { event, properties } = request.body as { 
      event: string; 
      properties?: Record<string, any> 
    };
    
    const user = request.user as { sub: string } | undefined;
    
    if (!event) {
      return reply.code(400).send({ error: 'Event is required' });
    }
    
    // Log analytics event (in production, store in database)
    console.log('[Analytics]', {
      event,
      userId: user?.sub,
      properties,
      timestamp: new Date().toISOString(),
    });
    
    return reply.send({ success: true });
  });

  // Get analytics (admin only)
  fastify.get('/stats', async (request, reply) => {
    // In production, query database for analytics
    return reply.send({ 
      stats: {
        totalEvents: 0,
        uniqueUsers: 0,
      }
    });
  });
}
