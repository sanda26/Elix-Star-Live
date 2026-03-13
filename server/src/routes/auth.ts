import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { config } from '../utils/config';

interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  avatarUrl: string;
  coins: number;
  createdAt: string;
}

// In-memory user store (replace with PostgreSQL in production)
const users = new Map<string, User>();

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', async (request, reply) => {
    const { email, password, username } = request.body as { email: string; password: string; username: string };
    
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }
    
    // Check if user exists
    if (users.has(email)) {
      return reply.code(409).send({ error: 'User already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const user: User = {
      id: crypto.randomUUID(),
      email,
      username: username || email.split('@')[0],
      passwordHash,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(username || email)}&background=random`,
      coins: 0,
      createdAt: new Date().toISOString(),
    };
    
    users.set(email, user);
    
    // Generate JWT
    const token = await fastify.jwt.sign({ 
      sub: user.id, 
      email: user.email,
      username: user.username 
    });
    
    return reply.send({ 
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatarUrl,
        coins: user.coins,
        created_at: user.createdAt,
      },
      session: { access_token: token, accessToken: token }
    });
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }
    
    const user = users.get(email);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    
    const token = await fastify.jwt.sign({ 
      sub: user.id, 
      email: user.email,
      username: user.username 
    });
    
    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatarUrl,
        coins: user.coins,
        created_at: user.createdAt,
      },
      session: { access_token: token, accessToken: token }
    });
  });

  // Get current user
  fastify.get('/me', async (request, reply) => {
    try {
      const user = request.user as { sub: string; email: string; username: string };
      
      // Find user in store (in production, query database)
      const userData = Array.from(users.values()).find(u => u.id === user.sub);
      
      if (!userData) {
        return reply.code(404).send({ error: 'User not found' });
      }
      
      return reply.send({
        user: {
          id: userData.id,
          email: userData.email,
          username: userData.username,
          avatar_url: userData.avatarUrl,
          coins: userData.coins,
          created_at: userData.createdAt,
        },
        session: { access_token: request.headers.authorization?.replace('Bearer ', '') }
      });
    } catch (error) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });
}
