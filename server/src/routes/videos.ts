import { FastifyInstance } from "fastify";

// ── In-memory stores ─────────────────────────────────────────────────────────
// Replace with PostgreSQL queries on Hetzner in production.

interface VideoRecord {
  id: string;
  userId: string;
  url: string;
  thumbnailUrl: string;
  description: string;
  hashtags: string[];
  isPublic: boolean;
  duetWithVideoId?: string;
  engagementScore: number;
  isEligibleForFyp: boolean;
  stats: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface SoundTrack {
  id: number;
  title: string;
  artist: string;
  duration: string;
  url: string;
  license: string;
  source: string;
  clipStartSeconds: number;
  clipEndSeconds: number;
  isActive: boolean;
}

const videos = new Map<string, VideoRecord>();
const videoLikes = new Map<string, Set<string>>(); // videoId → Set of userIds

// Built-in sound library — add your own CDN-hosted tracks here.
// URL should point to Bunny CDN once audio files are uploaded.
const soundLibrary: SoundTrack[] = [
  {
    id: 1,
    title: "Chill Vibes",
    artist: "Anber Music",
    duration: "2:30",
    url: "",
    license: "royalty-free",
    source: "Bunny CDN",
    clipStartSeconds: 0,
    clipEndSeconds: 150,
    isActive: false, // Set to true after uploading to Bunny CDN
  },
];

// ── Route registration ────────────────────────────────────────────────────────

export async function videoRoutes(fastify: FastifyInstance) {
  // ── GET /api/videos ─────────────────────────────────────────────────────────
  // Returns the full video list (FYP-eligible first).
  fastify.get("/", async () => {
    const videoList = Array.from(videos.values())
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .map((v) => ({
        id: v.id,
        userId: v.userId,
        url: v.url,
        thumbnailUrl: v.thumbnailUrl,
        description: v.description,
        hashtags: v.hashtags,
        isPublic: v.isPublic,
        engagementScore: v.engagementScore,
        isEligibleForFyp: v.isEligibleForFyp,
        stats: v.stats,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }));

    return { videos: videoList };
  });

  // ── GET /api/videos/:id ──────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const { id } = request.params;
    const video = videos.get(id);

    if (!video) {
      return reply.code(404).send({ error: "Video not found" });
    }

    return reply.send({ video });
  });

  // ── POST /api/videos ─────────────────────────────────────────────────────────
  // Create a new video metadata record after the binary has been uploaded to Bunny CDN.
  fastify.post<{
    Body: {
      id?: string;
      url: string;
      thumbnailUrl?: string;
      description?: string;
      hashtags?: string[];
      isPublic?: boolean;
      duetWithVideoId?: string;
    };
  }>(
    "/",
    { preHandler: (fastify as any).verifyJWT },
    async (request, reply) => {
      const {
        id: requestedId,
        url,
        thumbnailUrl,
        description,
        hashtags,
        isPublic,
        duetWithVideoId,
      } = request.body;

      const user = request.user as { sub: string } | undefined;

      if (!url) {
        return reply.code(400).send({ error: "url is required" });
      }
      if (!user) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const videoId = requestedId || crypto.randomUUID();
      const now = new Date().toISOString();

      const record: VideoRecord = {
        id: videoId,
        userId: user.sub,
        url,
        thumbnailUrl: thumbnailUrl || "",
        description: description || "",
        hashtags: hashtags || [],
        isPublic: isPublic !== false, // default to public
        duetWithVideoId,
        engagementScore: 0,
        isEligibleForFyp: false,
        stats: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 },
        createdAt: now,
        updatedAt: now,
      };

      videos.set(videoId, record);

      return reply.code(201).send({
        id: videoId,
        success: true,
        video: record,
      });
    },
  );

  // ── PATCH /api/videos/:id/fyp ────────────────────────────────────────────────
  // Update FYP eligibility and engagement score.
  // Called by the frontend FYP eligibility engine (src/lib/fypEligibility.ts).
  fastify.patch<{
    Params: { id: string };
    Body: {
      engagementScore?: number;
      isEligibleForFyp?: boolean;
      boost?: boolean;
    };
  }>("/:id/fyp", async (request, reply) => {
    const { id } = request.params;
    const { engagementScore, isEligibleForFyp, boost } = request.body ?? {};

    // Allow upsert — create a minimal record if not found yet
    let video = videos.get(id);
    if (!video) {
      // Accept FYP update even before the video record is fully seeded
      const now = new Date().toISOString();
      video = {
        id,
        userId: "",
        url: "",
        thumbnailUrl: "",
        description: "",
        hashtags: [],
        isPublic: true,
        engagementScore: 0,
        isEligibleForFyp: false,
        stats: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 },
        createdAt: now,
        updatedAt: now,
      };
    }

    if (typeof engagementScore === "number") {
      video.engagementScore = engagementScore;
    }
    if (typeof isEligibleForFyp === "boolean") {
      video.isEligibleForFyp = isEligibleForFyp;
    }
    // A boost sets the minimum score so new videos get early FYP impressions
    if (boost && video.engagementScore < 50) {
      video.engagementScore = 50;
      video.isEligibleForFyp = true;
    }

    video.updatedAt = new Date().toISOString();
    videos.set(id, video);

    return reply.send({
      success: true,
      id,
      engagementScore: video.engagementScore,
      isEligibleForFyp: video.isEligibleForFyp,
    });
  });

  // ── POST /api/videos/:id/fyp ─────────────────────────────────────────────────
  // Same as PATCH but accepts POST (called by VideoUploadService boost step).
  fastify.post<{
    Params: { id: string };
    Body: {
      boost?: boolean;
      engagementScore?: number;
      isEligibleForFyp?: boolean;
    };
  }>("/:id/fyp", async (request, reply) => {
    const { id } = request.params;
    const { engagementScore, isEligibleForFyp, boost } = request.body ?? {};

    let video = videos.get(id);
    if (!video) {
      const now = new Date().toISOString();
      video = {
        id,
        userId: "",
        url: "",
        thumbnailUrl: "",
        description: "",
        hashtags: [],
        isPublic: true,
        engagementScore: 0,
        isEligibleForFyp: false,
        stats: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 },
        createdAt: now,
        updatedAt: now,
      };
    }

    if (typeof engagementScore === "number") {
      video.engagementScore = engagementScore;
    }
    if (typeof isEligibleForFyp === "boolean") {
      video.isEligibleForFyp = isEligibleForFyp;
    }
    if (boost && video.engagementScore < 50) {
      video.engagementScore = 50;
      video.isEligibleForFyp = true;
    }

    video.updatedAt = new Date().toISOString();
    videos.set(id, video);

    return reply.send({
      success: true,
      id,
      engagementScore: video.engagementScore,
      isEligibleForFyp: video.isEligibleForFyp,
    });
  });

  // ── POST /api/videos/:id/like ────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    "/:id/like",
    { preHandler: (fastify as any).verifyJWT },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user as { sub: string } | undefined;

      if (!user) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const video = videos.get(id);
      if (!video) {
        return reply.code(404).send({ error: "Video not found" });
      }

      if (!videoLikes.has(id)) videoLikes.set(id, new Set());
      const likers = videoLikes.get(id)!;

      const alreadyLiked = likers.has(user.sub);
      if (alreadyLiked) {
        likers.delete(user.sub);
        video.stats.likes = Math.max(0, video.stats.likes - 1);
      } else {
        likers.add(user.sub);
        video.stats.likes++;
      }

      video.updatedAt = new Date().toISOString();
      videos.set(id, video);

      return reply.send({
        success: true,
        liked: !alreadyLiked,
        likes: video.stats.likes,
      });
    },
  );

  // ── POST /api/videos/:id/view ────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    "/:id/view",
    async (request, reply) => {
      const { id } = request.params;
      const video = videos.get(id);

      if (video) {
        video.stats.views++;
        video.updatedAt = new Date().toISOString();
        videos.set(id, video);
      }

      return reply.send({ success: true });
    },
  );

  // ── DELETE /api/videos/:id ───────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: (fastify as any).verifyJWT },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user as { sub: string } | undefined;

      const video = videos.get(id);
      if (!video) {
        return reply.code(404).send({ error: "Video not found" });
      }
      if (video.userId !== user?.sub) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      videos.delete(id);
      videoLikes.delete(id);

      return reply.send({ success: true, id });
    },
  );

  // ── GET /api/sounds ──────────────────────────────────────────────────────────
  // Returns the sound library for the upload / create flow.
  // Upload your audio files to Bunny CDN and set the url + isActive fields above.
  fastify.get("/sounds", async () => {
    // Reachable via /api/videos/sounds — frontend calls /api/sounds
    // Register this separately in index.ts if needed at /api/sounds.
    const active = soundLibrary.filter((t) => t.isActive);
    return { tracks: active };
  });
}

// ── Standalone sounds route ───────────────────────────────────────────────────
// Registered at /api/sounds in index.ts
export async function soundRoutes(fastify: FastifyInstance) {
  fastify.get("/", async () => {
    const active = soundLibrary.filter((t) => t.isActive);
    return { tracks: active };
  });
}
