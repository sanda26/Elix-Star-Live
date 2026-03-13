import { FastifyInstance } from 'fastify';

interface Profile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  website: string;
  followers: number;
  following: number;
  videoCount: number;
  coins: number;
  level: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

// In-memory profile store (replace with PostgreSQL on Hetzner in production)
const profiles = new Map<string, Profile>();

function getOrCreateProfile(userId: string, seed?: Partial<Profile>): Profile {
  if (profiles.has(userId)) {
    return profiles.get(userId)!;
  }
  const now = new Date().toISOString();
  const profile: Profile = {
    userId,
    username: seed?.username || `user_${userId.slice(0, 8)}`,
    displayName: seed?.displayName || seed?.username || `User ${userId.slice(0, 8)}`,
    avatarUrl: seed?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(seed?.username || userId.slice(0, 8))}&background=random`,
    bio: seed?.bio || '',
    website: seed?.website || '',
    followers: seed?.followers ?? 0,
    following: seed?.following ?? 0,
    videoCount: seed?.videoCount ?? 0,
    coins: seed?.coins ?? 0,
    level: seed?.level ?? 1,
    isVerified: seed?.isVerified ?? false,
    createdAt: seed?.createdAt || now,
    updatedAt: now,
  };
  profiles.set(userId, profile);
  return profile;
}

export async function profileRoutes(fastify: FastifyInstance) {
  // ── GET /api/profiles/:userId ─────────────────────────────────────
  // Fetch a user's public profile.
  fastify.get<{ Params: { userId: string } }>(
    '/:userId',
    async (request, reply) => {
      const { userId } = request.params;

      if (!userId) {
        return reply.code(400).send({ error: 'userId is required' });
      }

      const profile = getOrCreateProfile(userId);
      return reply.send({ profile });
    },
  );

  // ── GET /api/profiles/:userId/followers ───────────────────────────
  fastify.get<{ Params: { userId: string } }>(
    '/:userId/followers',
    async (request, reply) => {
      const { userId } = request.params;
      const profile = getOrCreateProfile(userId);
      return reply.send({ count: profile.followers, followers: [] });
    },
  );

  // ── GET /api/profiles/:userId/following ───────────────────────────
  fastify.get<{ Params: { userId: string } }>(
    '/:userId/following',
    async (request, reply) => {
      const { userId } = request.params;
      const profile = getOrCreateProfile(userId);
      return reply.send({ count: profile.following, following: [] });
    },
  );

  // ── PATCH /api/profiles/:userId ───────────────────────────────────
  // Update a user's profile. Auth required; users can only update their own.
  fastify.patch<{
    Params: { userId: string };
    Body: Partial<Pick<Profile, 'username' | 'displayName' | 'avatarUrl' | 'bio' | 'website' | 'level' | 'coins'>>;
  }>(
    '/:userId',
    { preHandler: (fastify as any).verifyJWT },
    async (request, reply) => {
      const { userId } = request.params;
      const jwtUser = request.user as { sub: string } | undefined;

      if (!jwtUser || jwtUser.sub !== userId) {
        return reply.code(403).send({ error: 'Forbidden: cannot update another user\'s profile' });
      }

      const profile = getOrCreateProfile(userId);

      const allowed = ['username', 'displayName', 'avatarUrl', 'bio', 'website', 'level', 'coins'] as const;
      for (const key of allowed) {
        const val = (request.body as any)[key];
        if (val !== undefined) {
          (profile as any)[key] = val;
        }
      }
      profile.updatedAt = new Date().toISOString();
      profiles.set(userId, profile);

      return reply.send({ profile });
    },
  );

  // ── POST /api/profiles/:userId/follow ─────────────────────────────
  fastify.post<{ Params: { userId: string } }>(
    '/:userId/follow',
    { preHandler: (fastify as any).verifyJWT },
    async (request, reply) => {
      const { userId } = request.params;
      const jwtUser = request.user as { sub: string } | undefined;

      if (!jwtUser) return reply.code(401).send({ error: 'Unauthorized' });
      if (jwtUser.sub === userId) return reply.code(400).send({ error: 'Cannot follow yourself' });

      const target = getOrCreateProfile(userId);
      const follower = getOrCreateProfile(jwtUser.sub);

      target.followers = Math.max(0, target.followers + 1);
      follower.following = Math.max(0, follower.following + 1);

      profiles.set(userId, target);
      profiles.set(jwtUser.sub, follower);

      return reply.send({ success: true, followers: target.followers });
    },
  );

  // ── POST /api/profiles/:userId/unfollow ───────────────────────────
  fastify.post<{ Params: { userId: string } }>(
    '/:userId/unfollow',
    { preHandler: (fastify as any).verifyJWT },
    async (request, reply) => {
      const { userId } = request.params;
      const jwtUser = request.user as { sub: string } | undefined;

      if (!jwtUser) return reply.code(401).send({ error: 'Unauthorized' });

      const target = getOrCreateProfile(userId);
      const follower = getOrCreateProfile(jwtUser.sub);

      target.followers = Math.max(0, target.followers - 1);
      follower.following = Math.max(0, follower.following - 1);

      profiles.set(userId, target);
      profiles.set(jwtUser.sub, follower);

      return reply.send({ success: true, followers: target.followers });
    },
  );

  // ── POST /api/profiles (seed/upsert for auth flow) ────────────────
  // Called by auth route after registration to initialise a profile row.
  fastify.post<{
    Body: { userId: string; username?: string; email?: string; avatarUrl?: string };
  }>(
    '/',
    async (request, reply) => {
      const { userId, username, email, avatarUrl } = request.body;

      if (!userId) {
        return reply.code(400).send({ error: 'userId is required' });
      }

      const fallbackUsername = username || (email ? email.split('@')[0] : undefined);
      const profile = getOrCreateProfile(userId, {
        username: fallbackUsername,
        displayName: fallbackUsername,
        avatarUrl,
      });

      return reply.code(201).send({ profile });
    },
  );
}
