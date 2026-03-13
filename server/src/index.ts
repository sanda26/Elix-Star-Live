import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import postgres from "@fastify/postgres";
import swagger from "@fastify/swagger";
import { config } from "./utils/config";

// Import routes
import { authRoutes } from "./routes/auth";
import { liveRoutes } from "./routes/live";
import { mediaRoutes } from "./routes/media";
import { paymentRoutes } from "./routes/payments";
import { analyticsRoutes } from "./routes/analytics";
import { giftRoutes } from "./routes/gifts";
import { videoRoutes } from "./routes/videos";
import { profileRoutes } from "./routes/profiles";
import { soundRoutes } from "./routes/videos";

const fastify = Fastify({
  logger: true,
  // Global body limit — individual routes (e.g. /api/media/upload-file)
  // override this with their own higher limit via the route-level bodyLimit option.
  bodyLimit: 10 * 1024 * 1024, // 10 MB default
});

// ── Content-type parsers ────────────────────────────────────────────────────
// Register a parser for raw binary uploads so the Bunny proxy endpoint
// receives a Buffer instead of Fastify trying to JSON-parse the video bytes.
fastify.addContentTypeParser(
  "application/octet-stream",
  { parseAs: "buffer", bodyLimit: 600 * 1024 * 1024 }, // 600 MB for large videos
  (_req, body, done) => {
    done(null, body);
  },
);

// ── Core plugins ────────────────────────────────────────────────────────────
await fastify.register(cors, {
  origin: config.allowedOrigins,
  credentials: true,
});
await fastify.register(helmet);
await fastify.register(jwt, {
  secret: config.jwtSecret,
});

// JWT verification decorator used by protected routes via { preHandler: fastify.verifyJWT }
fastify.decorate("verifyJWT", async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

// ── Database (optional — only if DATABASE_URL is set) ──────────────────────
// In production on Hetzner, point DATABASE_URL to a local Postgres instance.
if (config.databaseUrl) {
  await fastify.register(postgres, {
    connectionString: config.databaseUrl,
  });
  fastify.log.info("PostgreSQL connected");
} else {
  fastify.log.warn(
    "DATABASE_URL not set — using in-memory stores (data lost on restart). " +
      "Set DATABASE_URL in .env to persist data on Hetzner.",
  );
}

// ── Swagger / OpenAPI docs ──────────────────────────────────────────────────
await fastify.register(swagger, {
  openapi: {
    info: {
      title: "Anber Live API",
      description:
        "Hetzner-hosted backend. Stack: Hetzner (Node/Fastify) + Bunny Storage CDN + LiveKit.",
      version: "2.0.0",
    },
    servers: [{ url: config.apiUrl }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
});

// ── API Routes ──────────────────────────────────────────────────────────────
fastify.register(authRoutes, { prefix: "/api/auth" });
fastify.register(liveRoutes, { prefix: "/api/live" });
fastify.register(mediaRoutes, { prefix: "/api/media" });
fastify.register(paymentRoutes, { prefix: "/api/payments" });
fastify.register(analyticsRoutes, { prefix: "/api/analytics" });
fastify.register(giftRoutes, { prefix: "/api/gifts" });
fastify.register(videoRoutes, { prefix: "/api/videos" });
fastify.register(profileRoutes, { prefix: "/api/profiles" });
fastify.register(soundRoutes, { prefix: "/api/sounds" });

// ── Device token routes (inline — lightweight enough) ───────────────────────
// POST   /api/device-tokens  — register a push token
// DELETE /api/device-tokens  — unregister a push token
const deviceTokens = new Map<
  string,
  { userId: string; token: string; platform: string; updatedAt: string }
>();

fastify.post<{
  Body: { userId: string; token: string; platform: string };
}>(
  "/api/device-tokens",
  { preHandler: (fastify as any).verifyJWT },
  async (request, reply) => {
    const { userId, token, platform } = request.body ?? {};
    if (!userId || !token || !platform) {
      return reply
        .code(400)
        .send({ error: "userId, token and platform are required" });
    }
    const key = `${userId}:${platform}`;
    deviceTokens.set(key, {
      userId,
      token,
      platform,
      updatedAt: new Date().toISOString(),
    });
    return reply.send({ success: true });
  },
);

fastify.delete<{
  Body: { userId: string; token?: string; platform: string };
}>(
  "/api/device-tokens",
  { preHandler: (fastify as any).verifyJWT },
  async (request, reply) => {
    const { userId, platform } = request.body ?? {};
    if (!userId || !platform) {
      return reply
        .code(400)
        .send({ error: "userId and platform are required" });
    }
    const key = `${userId}:${platform}`;
    deviceTokens.delete(key);
    return reply.send({ success: true });
  },
);

// ── Notification send route (stub — wire up FCM / APNs in production) ───────
fastify.post<{
  Body: { title: string; body: string; data?: Record<string, unknown> };
}>(
  "/api/notifications/send",
  { preHandler: (fastify as any).verifyJWT },
  async (request, reply) => {
    const { title, body } = request.body ?? {};
    if (!title || !body) {
      return reply.code(400).send({ error: "title and body are required" });
    }
    // TODO: Integrate FCM / APNs using tokens from deviceTokens map
    fastify.log.info({ title, body }, "[Notification] send requested (stub)");
    return reply.send({ success: true, queued: true });
  },
);

// ── Health check ────────────────────────────────────────────────────────────
fastify.get("/health", async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
  service: "anber-live-server",
  stack: "Hetzner + Bunny CDN + LiveKit",
}));

// ── Env summary (dev only) ──────────────────────────────────────────────────
fastify.get("/api/env-check", async (_, reply) => {
  if (process.env.NODE_ENV === "production") {
    return reply.code(403).send({ error: "Not available in production" });
  }
  return {
    hetzner: {
      port: config.port,
      apiUrl: config.apiUrl,
      hasJwtSecret:
        !!config.jwtSecret &&
        config.jwtSecret !== "your-secret-key-change-in-production",
      hasDatabase: !!config.databaseUrl,
    },
    bunny: {
      hasStorageZone: !!config.bunnyStorageZone,
      hasApiKey: !!config.bunnyStorageApiKey,
      storageRegion: config.bunnyStorageRegion || "de",
      hasCdnHostname: !!config.bunnyCdnHostname,
    },
    livekit: {
      hasUrl: !!config.livekitUrl,
      hasApiKey: !!config.livekitApiKey,
      hasApiSecret: !!config.livekitApiSecret,
    },
    stripe: {
      hasSecretKey: !!config.stripeSecretKey,
      hasWebhookSecret: !!config.stripeWebhookSecret,
    },
  };
});

// ── Start ───────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: "0.0.0.0" });
    console.log(`\n🚀 Anber Live server  →  http://localhost:${config.port}`);
    console.log(
      `📦 Bunny CDN          →  ${config.bunnyCdnHostname || "(not configured)"}`,
    );
    console.log(
      `🎥 LiveKit            →  ${config.livekitUrl || "(not configured)"}`,
    );
    console.log(
      `🗄️  Database          →  ${config.databaseUrl ? "PostgreSQL (Hetzner)" : "in-memory"}`,
    );
    console.log(
      `📚 Swagger docs       →  http://localhost:${config.port}/docs`,
    );
    console.log(
      `❤️  Health check      →  http://localhost:${config.port}/health\n`,
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
