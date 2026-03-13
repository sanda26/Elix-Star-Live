import { FastifyInstance } from 'fastify';

// Gift catalog
const gifts = [
  { id: '1', name: 'Rose', cost: 10, type: 'image', emoji: '🌹' },
  { id: '2', name: 'Heart', cost: 50, type: 'image', emoji: '❤️' },
  { id: '3', name: 'Diamond', cost: 100, type: 'image', emoji: '💎' },
  { id: '4', name: 'Crown', cost: 500, type: 'image', emoji: '👑' },
  { id: '5', name: 'Rocket', cost: 1000, type: 'video', emoji: '🚀' },
];

export async function giftRoutes(fastify: FastifyInstance) {
  // Get gift catalog
  fastify.get('/', async () => {
    return { gifts };
  });

  // Send gift
  fastify.post('/send', async (request, reply) => {
    const { giftId, streamKey } = request.body as { giftId: string; streamKey: string };
    const user = request.user as { sub: string } | undefined;
    
    if (!giftId || !streamKey) {
      return reply.code(400).send({ error: 'Gift ID and stream key are required' });
    }
    
    const gift = gifts.find(g => g.id === giftId);
    if (!gift) {
      return reply.code(404).send({ error: 'Gift not found' });
    }
    
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    
    // In production, deduct coins from user and credit to stream host
    console.log(`[Gift] User ${user.sub} sent ${gift.name} to stream ${streamKey}`);
    
    return reply.send({ 
      success: true, 
      gift,
      message: `Sent ${gift.name}!` 
    });
  });
}
