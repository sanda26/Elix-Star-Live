import "./config";
import express from "express";
import cors from "cors";
import compression from "compression";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  createCheckoutSession,
  createPaymentIntent,
  createPromoteCheckoutSession,
  createSubscriptionSession,
  handleGetCoinPackages,
} from "./routes/checkout";
import { handleStripeWebhook } from "./routes/webhook";
import { handleLiveKitWebhook } from "./routes/livekit-webhook";
import {
  handleAnalytics,
  handleBlockUser,
  handleDeleteAccount,
  handleReport,
  handleSendNotification,
  handleVerifyPurchase,
  handlePromoteIAPComplete,
} from "./routes/misc";
import {
  handleForYouFeed,
  handleTrackView,
  handleTrackInteraction,
  handleGetVideoScore,
} from "./routes/feed";
import {
  addVideo,
  getVideo,
  getAllVideos,
  getVideosByUser,
  deleteVideo,
  replaceVideos,
  type Video,
} from "./lib/videoStore";
import { initPostgres, loadVideosFromDb, saveVideoToDb, dbUpdateViewerCount } from "./lib/postgres";
import {
  handleGetCreatorBalance,
  handleGetCreatorEarnings,
  handleCreatorWithdraw,
  handleGetCreatorPayouts,
  handleSetPayoutMethod,
  handleGetPayoutMethods,
  handleAdminListPayouts,
  handleAdminApprovePayout,
  handleAdminRejectPayout,
  handleAdminChargeback,
  handleShopBuy,
  handleShopRefund,
  handleShopPurchases,
} from "./routes/payout";
import { handleLiveModerationCheck } from "./routes/moderation";
import {
  handleLogin,
  handleRegister,
  handleLogout,
  handleMe,
  handleResendConfirmation,
  handleAppleStart,
  handleGuestLogin,
  handleDeleteAccount,
} from "./routes/auth";
import {
  handleGetStreams,
  handleLiveStart,
  handleLiveEnd,
  handleGetLiveToken,
  removeActiveStream,
  isStreamHost,
} from "./routes/livestream";
import { handleUploadVideo, handleUploadAvatar } from "./routes/upload";
import { uploadToBunny, isBunnyConfigured } from "./services/bunny";
import { isLiveKitConfigured } from "./services/livekit";
import { getTokenFromRequest, verifyAuthToken } from "./routes/auth";
import { handleSendGift } from "./routes/gifts";
import {
  handleGetProfile,
  handleGetProfileByUsername,
  handleGetFollowers,
  handleGetFollowing,
  handlePatchProfile,
  handleFollow,
  handleUnfollow,
  handleSeedProfile,
  handleAddTestCoins,
} from "./routes/profiles";
import {
  handleGetWallet,
  handleGetWalletTransactions,
} from "./routes/wallet";
import { addFeedSubscriber, removeFeedSubscriber, broadcastToFeedSubscribers } from "./feedBroadcast";
import { logger } from "./lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = Number(process.env.PORT) || 8080;

// HSTS — enforce HTTPS in production via Strict-Transport-Security
app.use((_req, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  next();
});

// Middleware (credentials: true so auth cookie works when frontend is on another origin)
app.use(cors({ credentials: true, origin: true }));
app.use(compression());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ms,
    });
  });
  next();
});

// Webhooks need raw body for signature verification
app.use(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);
app.post(
  "/api/livekit/webhook",
  express.raw({ type: "application/webhook+json" }),
  handleLiveKitWebhook,
);

// Video upload: raw body (binary)
app.use(
  "/api/upload/video",
  express.raw({
    type: ["application/octet-stream", "video/mp4", "video/webm"],
    limit: "500mb",
  }),
  handleUploadVideo,
);

// Media upload: raw body (binary) — must be registered BEFORE express.json()
app.use(
  "/api/media/upload-file",
  express.raw({
    type: [
      "application/octet-stream",
      "video/mp4",
      "video/webm",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
    limit: "600mb",
  }),
);

// Other routes use JSON
app.use(express.json());

// Health check endpoint (must be before static files)
const BUILD_VERSION = "2026-03-15T07:00-inline-live-gift-fix";
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    version: BUILD_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    port: PORT,
    videoCount: getAllVideos().length,
    services: {
      livekit: isLiveKitConfigured(),
      bunnyStorage: isBunnyConfigured(),
      database: Boolean(process.env.DATABASE_URL),
      livekitUrl: Boolean(process.env.LIVEKIT_URL),
      viteEnvCount: Object.keys(process.env).filter(k => k.startsWith("VITE_")).length,
    },
  });
});
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    version: BUILD_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    port: PORT,
    videoCount: getAllVideos().length,
    services: {
      livekit: isLiveKitConfigured(),
      bunnyStorage: isBunnyConfigured(),
      database: Boolean(process.env.DATABASE_URL),
      livekitUrl: Boolean(process.env.LIVEKIT_URL),
      viteEnvCount: Object.keys(process.env).filter(k => k.startsWith("VITE_")).length,
    },
  });
});

// Auth API (login, register, logout, me, resend-confirmation, apple/start, guest)
app.post("/api/auth/login", handleLogin);
app.post("/api/auth/guest", handleGuestLogin);
app.post("/api/auth/register", handleRegister);
app.post("/api/auth/logout", handleLogout);
app.post("/api/auth/delete", handleDeleteAccount);
app.get("/api/auth/me", handleMe);
app.post("/api/auth/resend-confirmation", handleResendConfirmation);
app.post("/api/auth/apple/start", handleAppleStart);

// Profile (alias for /api/auth/me)
app.get("/api/profile", handleMe);

// Live streaming (LiveKit tokens + stream lifecycle)
app.get("/api/live/streams", handleGetStreams);
app.post("/api/live/start", handleLiveStart);
app.post("/api/live/end", handleLiveEnd);
app.get("/api/live/token", handleGetLiveToken);

// Upload video to Bunny Storage
// (route mounted above with express.raw)

// Gifts (REST; real-time still via WebSocket in room)
app.post("/api/gifts/send", handleSendGift);

// API Routes
app.post("/api/create-checkout-session", createCheckoutSession);
app.post("/api/create-promote-checkout", createPromoteCheckoutSession);
app.post("/api/create-payment-intent", createPaymentIntent);
app.post("/api/create-subscription", createSubscriptionSession);
app.get("/api/coin-packages", handleGetCoinPackages);
app.post("/api/analytics", handleAnalytics);
app.post("/api/analytics/track", handleAnalytics);
app.post("/api/block-user", handleBlockUser);
app.post("/api/test-coins", handleAddTestCoins);

// Profiles
app.get("/api/profiles/by-username/:username", handleGetProfileByUsername);
app.get("/api/profiles/:userId", handleGetProfile);
app.get("/api/profiles/:userId/followers", handleGetFollowers);
app.get("/api/profiles/:userId/following", handleGetFollowing);
app.patch("/api/profiles/:userId", handlePatchProfile);
app.post("/api/profiles/:userId/follow", handleFollow);
app.post("/api/profiles/:userId/unfollow", handleUnfollow);
app.post("/api/profiles", handleSeedProfile);

app.post("/api/delete-account", handleDeleteAccount);
app.post("/api/report", handleReport);
app.post("/api/live/moderation/check", handleLiveModerationCheck);
app.post("/api/send-notification", handleSendNotification);
app.post("/api/verify-purchase", handleVerifyPurchase);
app.post("/api/iap/verify", handleVerifyPurchase);
app.post("/api/promote-iap-complete", handlePromoteIAPComplete);
app.get("/api/wallet", handleGetWallet);
app.get("/api/wallet/transactions", handleGetWalletTransactions);

// Feed & Recommendation API
app.get("/api/feed/foryou", handleForYouFeed);
app.post("/api/feed/track-view", handleTrackView);
app.post("/api/feed/track-interaction", handleTrackInteraction);
app.get("/api/feed/score/:videoId", handleGetVideoScore);

// ── Video CRUD (in-memory store; persists to Postgres when DATABASE_URL set) ───────────────────
app.post("/api/videos", async (req, res) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: "Not authenticated." });
    const payload = verifyAuthToken(token);
    if (!payload) return res.status(401).json({ error: "Invalid or expired session." });

    const body = req.body;
    if (!body || !body.url) {
      return res.status(400).json({ error: "url is required" });
    }

    // Look up the real user profile
    const { getOrCreateProfile } = await import("./routes/profiles");
    const profile = getOrCreateProfile(payload.sub);

    const id =
      body.id || `vid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const video: Video = {
      id,
      url: body.url,
      thumbnail: body.thumbnailUrl || body.thumbnail_url || body.thumbnail || "",
      duration: body.duration || 0,
      userId: payload.sub,
      username: profile.username || body.username || "user",
      displayName: profile.displayName || body.displayName || "User",
      avatar: profile.avatarUrl || body.avatar || "",
      description: body.description || "",
      hashtags: body.hashtags || [],
      music: body.music || null,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      createdAt: body.createdAt || new Date().toISOString(),
      privacy: body.privacy || "public",
    };

    addVideo(video);
    await saveVideoToDb(video);
    logger.info({ videoId: id, total: getAllVideos().length }, "Video created");

    return res.status(201).json(video);
  } catch (err: any) {
    logger.error({ err: err?.message || err }, "POST /api/videos failed");
    return res.status(500).json({ error: "Failed to create video" });
  }
});

app.get("/api/videos", (_req, res) => {
  const videos = getAllVideos();
  res.json({ videos, total: videos.length });
});

app.get("/api/videos/:id", (req, res) => {
  const video = getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  res.json(video);
});

app.get("/api/videos/user/:userId", (req, res) => {
  const videos = getVideosByUser(req.params.userId);
  res.json({ videos, total: videos.length });
});

app.delete("/api/videos/:id", (req, res) => {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  const payload = verifyAuthToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired session." });

  const video = getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  if (video.userId !== payload.sub) return res.status(403).json({ error: "You can only delete your own videos." });

  deleteVideo(req.params.id);
  res.json({ ok: true });
});

// No-refund enforcement: block any coin refund/restore/reverse attempts
app.post("/api/refund", (_req, res) =>
  res
    .status(403)
    .json({ error: "All coin purchases are final and non-refundable." }),
);
app.post("/api/restore-coins", (_req, res) =>
  res
    .status(403)
    .json({ error: "All coin purchases are final and non-refundable." }),
);
app.post("/api/reverse-gift", (_req, res) =>
  res.status(403).json({ error: "Gifts are final and cannot be reversed." }),
);
app.post("/api/cancel-purchase", (_req, res) =>
  res
    .status(403)
    .json({ error: "All coin purchases are final and non-refundable." }),
);

// Creator Payout API
app.get("/api/creator/balance", handleGetCreatorBalance);
app.get("/api/creator/earnings", handleGetCreatorEarnings);
app.post("/api/creator/withdraw", handleCreatorWithdraw);
app.get("/api/creator/payouts", handleGetCreatorPayouts);
app.post("/api/creator/payout-method", handleSetPayoutMethod);
app.get("/api/creator/payout-methods", handleGetPayoutMethods);

// Admin Payout API
app.get("/api/admin/payouts", handleAdminListPayouts);
app.post("/api/admin/payout/:id/approve", handleAdminApprovePayout);
app.post("/api/admin/payout/:id/reject", handleAdminRejectPayout);
app.post("/api/admin/chargeback", handleAdminChargeback);

// Admin account management — endpoint disabled
app.post("/api/admin/unfreeze/:userId", (_req, res) => {
  res.status(501).json({ error: "Admin unfreeze not available." });
});

// Shop Item Purchase & Refund API
app.post("/api/shop/buy", handleShopBuy);
app.post("/api/shop/refund", handleShopRefund);
app.get("/api/shop/purchases", handleShopPurchases);

// ── Bunny Storage media routes (frontend calls these) ──────────────
app.post("/api/media/upload-file", async (req, res) => {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  const payload = verifyAuthToken(token);
  if (!payload)
    return res.status(401).json({ error: "Invalid or expired session." });

  if (!isBunnyConfigured()) {
    return res.status(503).json({ error: "Bunny storage not configured." });
  }

  const storagePath = (req.query.path as string)?.trim();
  const ct =
    (req.query.ct as string)?.trim() ||
    req.headers["content-type"] ||
    "application/octet-stream";

  if (!storagePath || storagePath.includes("..")) {
    return res
      .status(400)
      .json({ error: "path query param is required and must be safe." });
  }

  const body = req.body;
  if (!body || !(body instanceof Buffer) || body.length === 0) {
    return res
      .status(400)
      .json({ error: "Request body must be non-empty binary." });
  }

  const result = await uploadToBunny(storagePath, body, ct);
  if (!result.success) {
    return res.status(502).json({ error: result.error || "Upload failed." });
  }

  return res.status(200).json({ path: result.path, cdnUrl: result.cdnUrl });
});

app.delete("/api/media/delete", async (req, res) => {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  const payload = verifyAuthToken(token);
  if (!payload)
    return res.status(401).json({ error: "Invalid or expired session." });

  const { path: storagePath } = req.body ?? {};
  if (!storagePath || typeof storagePath !== "string") {
    return res.status(400).json({ error: "path is required in body." });
  }

  // Delete from Bunny Storage
  const STORAGE_REGION = process.env.BUNNY_STORAGE_REGION || "de";
  const STORAGE_ZONE = (process.env.BUNNY_STORAGE_ZONE || "").split(".")[0];
  const ACCESS_KEY = process.env.BUNNY_STORAGE_API_KEY;
  if (!ACCESS_KEY || !STORAGE_ZONE) {
    return res.status(503).json({ error: "Bunny storage not configured." });
  }

  const baseUrl =
    STORAGE_REGION === "de"
      ? "https://storage.bunnycdn.com"
      : `https://${STORAGE_REGION}.storage.bunnycdn.com`;
  const url = `${baseUrl}/${STORAGE_ZONE}/${storagePath.replace(/^\/+/, "")}`;

  try {
    const delRes = await fetch(url, {
      method: "DELETE",
      headers: { AccessKey: ACCESS_KEY },
    });
    if (!delRes.ok && delRes.status !== 404) {
      return res
        .status(500)
        .json({ error: `Bunny delete failed (${delRes.status})` });
    }
    return res.status(200).json({ success: true, path: storagePath });
  } catch (err) {
    return res.status(502).json({ error: "Could not reach Bunny Storage" });
  }
});

app.use("/api/media/public", (req, res) => {
  const filePath = req.path.replace(/^\/+/, "");
  if (!filePath) return res.status(400).json({ error: "path is required" });
  const cdnHost = process.env.VITE_BUNNY_CDN_HOSTNAME || "";
  if (!cdnHost)
    return res.status(503).json({ error: "CDN hostname not configured" });
  return res.status(200).json({ url: `https://${cdnHost}/${filePath}` });
});

// Runtime env.js endpoint for VITE_ variables (+ LIVEKIT_URL as VITE_LIVEKIT_URL so client can connect)
app.get("/env.js", (_req, res) => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("VITE_")) continue;
    if (typeof v !== "string") continue;
    env[k] = v;
  }
  if (process.env.LIVEKIT_URL && typeof process.env.LIVEKIT_URL === "string") {
    env.VITE_LIVEKIT_URL = process.env.LIVEKIT_URL;
  }
  if (!env.VITE_GIFT_ASSET_BASE_URL && process.env.BUNNY_STORAGE_HOSTNAME) {
    env.VITE_GIFT_ASSET_BASE_URL = `https://${process.env.BUNNY_STORAGE_HOSTNAME}`;
  }
  if (!env.VITE_BUNNY_CDN_HOSTNAME && process.env.BUNNY_STORAGE_HOSTNAME) {
    env.VITE_BUNNY_CDN_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME;
  }
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res
    .status(200)
    .send(
      "window.__ENV = Object.assign({}, window.__ENV || {}, " +
        JSON.stringify(env) +
        ");",
    );
});

// Serve static files from dist
const distPath = join(__dirname, "..", "dist");
const indexPath = join(distPath, "index.html");

// Log dist path on startup for debugging
console.log(`Serving static files from: ${distPath}`);
console.log(`Index path: ${indexPath}`);

import fs from "fs";
if (!fs.existsSync(indexPath)) {
  console.error(`ERROR: index.html not found at ${indexPath}`);
  console.error(
    "Available files:",
    fs.existsSync(distPath)
      ? fs.readdirSync(distPath).join(", ")
      : "dist folder missing",
  );
} else {
  console.log(
    "index.html found successfully. Content preview:",
    fs.readFileSync(indexPath, "utf8").substring(0, 200),
  );
}

app.use(
  express.static(distPath, {
    maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
  }),
);

// Fallback for SPA - all non-API routes serve index.html
app.use((req, res) => {
  if (process.env.NODE_ENV !== "production")
    console.log(`Serving fallback for ${req.url}`);
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Return 200 so deployment succeeds and we can debug
    res
      .status(200)
      .send(
        "<h1>App build not found</h1><p>dist/index.html is missing. Check build logs.</p>",
      );
  }
});

// Centralized error handler (must be after all routes)
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, method: req.method, url: req.originalUrl }, "Unhandled error");
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// WebSocket Server
// We attach it to the same HTTP server to share the port 3000
const wss = new WebSocketServer({ server });

console.log(`WebSocket server attached to HTTP server on port ${PORT}`);

// --- WebSocket Logic (JWT decode-only for userId) ---

function decodeUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

interface Client {
  ws: WebSocket;
  userId: string;
  roomId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  level: number;
  country: string;
  connectedAt: Date;
}

const rooms = new Map<string, Set<Client>>();
const clients = new Map<WebSocket, Client>();
const processedTransactions = new Map<string, number>();

// ═══════════════════════════════════════════════════════════════
// GIFT REGISTRY — Server-side source of truth for gift values
// ═══════════════════════════════════════════════════════════════
const GIFT_VALUES: Record<string, number> = {
  s_rose: 1,
  s_heart: 5,
  s_coffee: 15,
  s_diamond: 300,
  s_crown: 1500,
  s_panda: 10,
  s_butterfly: 25,
  s_cat: 50,
  s_dog: 100,
  s_sun: 250,
  s_rainbow: 500,
  s_unicorn: 1000,
  global_universe: 1000000,
  horse_gallop: 5000,
  rex_dino: 12000,
  treasure_chest: 15000,
  war_bird: 15000,
  kitty_treasure: 17000,
  frost_wolf: 18000,
  voyager_ship: 19000,
  fiery_lion: 21000,
  night_panther: 22000,
  titan_gorilla: 23000,
  misty_wolf: 25000,
  cosmic_panther: 26000,
  star_wand: 28000,
  beast_relic: 31000,
  crystal_rhino: 32000,
  storm_phoenix: 34000,
  ice_sorceress: 37000,
  fire_phoenix: 38000,
  lavarok: 40000,
  blazing_wizard: 42000,
  aelyra_flameveil: 45000,
  golden_lion: 46000,
  dragon_egg: 49000,
  lava_demon: 52000,
  dragon_wrath: 55000,
  flames_royalty: 55000,
  fire_unicorn: 55000,
  thunder_falcon: 58000,
  infernal_lion: 60000,
  fantasy_unicorn: 61000,
  sky_guardian: 64000,
  majestic_bird: 65000,
  flame_king: 65000,
  majestic_phoenix: 70000,
  molten_fury: 75000,
  universe: 80000,
  lava_rampage: 80000,
  guardian_chest: 85000,
  storm_warrior: 85000,
  pink_jet: 88000,
  frost_lion: 90000,
  night_owl: 90000,
  drake_cub: 95000,
  romantic_jet: 99000,
  guardian_vault: 100000,
  elix_gold_universe: 120000,
  lightning_hypercar: 150000,
};

function getGiftValue(giftId: string): number {
  return GIFT_VALUES[giftId] || 0;
}

function normalizeBattleTarget(rawTarget: unknown): "host" | "opponent" | null {
  if (rawTarget === "host" || rawTarget === "opponent") return rawTarget;
  if (rawTarget === "me") return "host";
  if (rawTarget === "player4") return "opponent";
  if (rawTarget === "player3") return "host";
  return null;
}

// ═══════════════════════════════════════════════════════════════
// BATTLE SYSTEM — Server-controlled sessions, timers, scoring
// ═══════════════════════════════════════════════════════════════
interface BattleSession {
  id: string;
  hostRoomId: string;
  hostUserId: string;
  hostName: string;
  opponentUserId: string;
  opponentName: string;
  opponentRoomId: string;
  player3UserId: string;
  player3Name: string;
  player4UserId: string;
  player4Name: string;
  hostScore: number;
  opponentScore: number;
  player3Score: number;
  player4Score: number;
  endsAt: number; // Unix timestamp (ms) when battle ends
  timeLeft: number; // computed from endsAt for convenience
  status: "WAITING" | "COUNTDOWN" | "ACTIVE" | "ENDED";
  winner: "host" | "opponent" | "player3" | "player4" | "draw" | null;
  timer: ReturnType<typeof setInterval> | null;
  createdAt: number;
  hostReady: boolean;
  opponentReady: boolean;
}

const battles = new Map<string, BattleSession>(); // roomId -> BattleSession
const userBattleRoom = new Map<string, string>(); // userId -> roomId (which battle they're in)
const lastCohostLayoutByRoom = new Map<string, { coHosts: unknown[]; hostUserId: string }>();

function createBattle(
  hostRoomId: string,
  hostUserId: string,
  hostName: string,
): BattleSession {
  const session: BattleSession = {
    id: `battle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    hostRoomId,
    hostUserId,
    hostName,
    opponentUserId: "",
    opponentName: "",
    opponentRoomId: "",
    player3UserId: "",
    player3Name: "",
    player4UserId: "",
    player4Name: "",
    hostScore: 0,
    opponentScore: 0,
    player3Score: 0,
    player4Score: 0,
    endsAt: 0,
    timeLeft: 300,
    status: "WAITING",
    winner: null,
    timer: null,
    createdAt: Date.now(),
    hostReady: false,
    opponentReady: false,
  };
  battles.set(hostRoomId, session);
  userBattleRoom.set(hostUserId, hostRoomId);
  return session;
}

function joinBattle(
  roomId: string,
  userId: string,
  userName: string,
): BattleSession | null {
  const session = battles.get(roomId);
  if (!session || session.status === "ENDED") return null;

  // If this user is already the opponent (pre-filled by battle_create), treat as a successful join
  if (session.opponentUserId === userId || session.player3UserId === userId || session.player4UserId === userId) {
    if (session.status === "WAITING") {
      startBattleTimer(roomId);
    }
    return session;
  }
  if (session.hostUserId === userId) return session;

  if (!session.opponentUserId) {
    session.opponentUserId = userId;
    session.opponentName = userName;
  } else if (!session.player3UserId) {
    session.player3UserId = userId;
    session.player3Name = userName;
  } else if (!session.player4UserId) {
    session.player4UserId = userId;
    session.player4Name = userName;
  } else {
    return null;
  }

  userBattleRoom.set(userId, roomId);
  if (session.status === "WAITING") {
    startBattleTimer(roomId);
  } else {
    broadcastBattleState(roomId, session);
  }
  return session;
}

function startBattleTimer(roomId: string) {
  const session = battles.get(roomId);
  if (!session) return;
  session.status = "ACTIVE";
  session.endsAt = Date.now() + 300 * 1000; // 5 minutes from now
  session.timeLeft = 300;
  broadcastBattleState(roomId, session);

  session.timer = setInterval(() => {
    const s = battles.get(roomId);
    if (!s || s.status !== "ACTIVE") {
      if (s?.timer) clearInterval(s.timer);
      return;
    }
    s.timeLeft = Math.max(0, Math.round((s.endsAt - Date.now()) / 1000));

    broadcastToRoom(roomId, "battle_tick", {
      timeLeft: s.timeLeft,
      hostScore: s.hostScore,
      opponentScore: s.opponentScore,
      player3Score: s.player3Score,
      player4Score: s.player4Score,
      endsAt: s.endsAt,
    });

    if (s.timeLeft <= 0) {
      endBattle(roomId);
    }
  }, 1000);
}

function addBattleScoreForTarget(
  roomId: string,
  target: "host" | "opponent" | "player3" | "player4",
  points: number,
) {
  const session = battles.get(roomId);
  if (!session || session.status !== "ACTIVE") return;

  if (target === "host") {
    session.hostScore += points;
  } else if (target === "opponent") {
    session.opponentScore += points;
  } else if (target === "player3") {
    session.player3Score += points;
  } else if (target === "player4") {
    session.player4Score += points;
  }

  broadcastToRoom(roomId, "battle_score", {
    hostScore: session.hostScore,
    opponentScore: session.opponentScore,
    player3Score: session.player3Score,
    player4Score: session.player4Score,
    lastScorer: target,
    points,
  });
}

function endBattle(roomId: string) {
  const session = battles.get(roomId);
  if (!session) return;

  if (session.timer) {
    clearInterval(session.timer);
    session.timer = null;
  }

  session.status = "ENDED";
  const redTeam = session.hostScore + session.player3Score;
  const blueTeam = session.opponentScore + session.player4Score;

  if (redTeam > blueTeam) {
    session.winner = "host"; // or 'red'
  } else if (blueTeam > redTeam) {
    session.winner = "opponent"; // or 'blue'
  } else {
    session.winner = "draw";
  }

  broadcastToRoom(roomId, "battle_ended", {
    hostScore: session.hostScore,
    opponentScore: session.opponentScore,
    player3Score: session.player3Score,
    player4Score: session.player4Score,
    winner: session.winner,
    hostName: session.hostName,
    opponentName: session.opponentName,
  });

  // Cleanup after 10 seconds
  setTimeout(() => {
    const s = battles.get(roomId);
    if (s) {
      userBattleRoom.delete(s.hostUserId);
      if (s.opponentUserId) userBattleRoom.delete(s.opponentUserId);
      if (s.player3UserId) userBattleRoom.delete(s.player3UserId);
      if (s.player4UserId) userBattleRoom.delete(s.player4UserId);
      battles.delete(roomId);
    }
  }, 10000);
}

function broadcastBattleState(roomId: string, session: BattleSession) {
  if (session.endsAt > 0) {
    session.timeLeft = Math.max(
      0,
      Math.round((session.endsAt - Date.now()) / 1000),
    );
  }
  broadcastToRoom(roomId, "battle_state_sync", {
    id: session.id,
    status: session.status,
    hostUserId: session.hostUserId,
    hostName: session.hostName,
    hostRoomId: session.hostRoomId,
    opponentUserId: session.opponentUserId,
    opponentName: session.opponentName,
    opponentRoomId: session.opponentRoomId,
    player3UserId: session.player3UserId,
    player3Name: session.player3Name,
    player4UserId: session.player4UserId,
    player4Name: session.player4Name,
    hostScore: session.hostScore,
    opponentScore: session.opponentScore,
    player3Score: session.player3Score,
    player4Score: session.player4Score,
    timeLeft: session.timeLeft,
    endsAt: session.endsAt,
    winner: session.winner,
    hostReady: session.hostReady,
    opponentReady: session.opponentReady,
  });
}

wss.on("connection", async (ws: WebSocket, req) => {
  let client: Client | null = null;

  try {
    console.log("New connection");

    if (!req.url) {
      ws.close(1008, "Missing URL");
      return;
    }

    // Parse room and token from URL
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    let roomId = url.searchParams.get("room");
    const token = url.searchParams.get("token");

    // If room not in query, try from pathname (e.g., /live/roomId)
    if (!roomId && url.pathname.startsWith("/live/")) {
      roomId = url.pathname.split("/")[2]; // /live/roomId -> roomId
    }

    if (!roomId || !token) {
      ws.close(1008, "Missing room or token");
      return;
    }

    const userId = decodeUserIdFromToken(token);
    if (!userId) {
      ws.close(1008, "Invalid token");
      return;
    }

    // For You feed subscribers: realtime stream_started / stream_ended only
    if (roomId === "__feed__" || roomId === "feed") {
      client = {
        ws,
        userId,
        roomId: "__feed__",
        username: "Anonymous",
        displayName: "",
        avatarUrl: "",
        level: 1,
        country: "",
        connectedAt: new Date(),
      };
      clients.set(ws, client);
      addFeedSubscriber(ws);
      try {
        ws.send(JSON.stringify({ event: "connected", data: { feed: true }, timestamp: new Date().toISOString() }));
      } catch {
        /* ignore */
      }
      return;
    }

    const username = "Anonymous";
    const displayName = "";
    const avatarUrl = "";
    const level = 1;
    const country = "";

    client = {
      ws,
      userId,
      roomId,
      username,
      displayName: displayName || username,
      avatarUrl,
      level,
      country,
      connectedAt: new Date(),
    };

    clients.set(ws, client);

    // Add to room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId)!.add(client);

    // Send welcome + full room state with deduplicated viewers
    const roomClients = rooms.get(roomId)!;
    const seenUserIds = new Set<string>();
    const viewers: {
      user_id: string;
      username: string;
      display_name: string;
      avatar_url: string;
      level: number;
      country: string;
    }[] = [];
    for (const c of roomClients) {
      if (seenUserIds.has(c.userId)) continue;
      seenUserIds.add(c.userId);
      viewers.push({
        user_id: c.userId,
        username: c.username,
        display_name: c.displayName,
        avatar_url: c.avatarUrl,
        level: c.level,
        country: c.country,
      });
    }

    sendToClient(client, "connected", {
      room_id: roomId,
      user_count: roomClients.size,
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:room_state_sent',message:'Sending room_state to client',data:{roomId,userId:client.userId,hasBattle:!!battles.get(roomId)},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    sendToClient(client, "room_state", {
      viewers,
    });

    // Spectators only join/leave; layout is from the app (creator). Send current room layout to this joiner so they see the same layout as the creator — no spectator layout.
    const lastCohost = lastCohostLayoutByRoom.get(roomId);
    if (lastCohost) {
      sendToClient(client, "cohost_layout_sync", {
        coHosts: lastCohost.coHosts,
        hostUserId: lastCohost.hostUserId,
      });
    }

    // Broadcast user joined
    broadcastToRoom(
      roomId,
      "user_joined",
      {
        user_id: client.userId,
        username: client.username,
        display_name: client.displayName,
        avatar_url: client.avatarUrl,
        level: client.level,
        country: client.country,
      },
      client,
    );

    // Update viewer count
    await updateViewerCount(roomId);

    // If there's an active battle in this room, send state to new joiner
    const activeBattleOnJoin = battles.get(roomId);
    if (activeBattleOnJoin && activeBattleOnJoin.status !== "ENDED") {
      if (activeBattleOnJoin.endsAt > 0) {
        activeBattleOnJoin.timeLeft = Math.max(
          0,
          Math.round((activeBattleOnJoin.endsAt - Date.now()) / 1000),
        );
      }
      sendToClient(client, "battle_state_sync", {
        id: activeBattleOnJoin.id,
        status: activeBattleOnJoin.status,
        hostUserId: activeBattleOnJoin.hostUserId,
        hostName: activeBattleOnJoin.hostName,
        opponentUserId: activeBattleOnJoin.opponentUserId,
        opponentName: activeBattleOnJoin.opponentName,
        player3UserId: activeBattleOnJoin.player3UserId,
        player3Name: activeBattleOnJoin.player3Name,
        player4UserId: activeBattleOnJoin.player4UserId,
        player4Name: activeBattleOnJoin.player4Name,
        hostScore: activeBattleOnJoin.hostScore,
        opponentScore: activeBattleOnJoin.opponentScore,
        player3Score: activeBattleOnJoin.player3Score,
        player4Score: activeBattleOnJoin.player4Score,
        timeLeft: activeBattleOnJoin.timeLeft,
        endsAt: activeBattleOnJoin.endsAt,
        winner: activeBattleOnJoin.winner,
      });
    }
  } catch (error) {
    console.error("Connection setup error:", error);
    ws.close(1011, "Server error");
    return;
  }

  // Add error handler
  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  // Handle messages
  ws.on("message", async (data) => {
    aliveClients.add(ws);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return;
      }
      const { event, data: eventData } = parsed;

      if (process.env.NODE_ENV !== "production")
        console.log("Received message:", event, eventData);

      // Dev-only: allow unauthenticated join for local testing
      if (
        process.env.NODE_ENV !== "production" &&
        event === "join_room" &&
        eventData &&
        eventData.skipAuth
      ) {
        const { roomId, userId, username } = eventData;

        client = {
          ws,
          userId,
          roomId,
          username,
          displayName: username,
          avatarUrl: "",
          level: 1,
          country: "",
          connectedAt: new Date(),
        };

        clients.set(ws, client);

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId)!.add(client);

        sendToClient(client, "room_joined", {
          roomId,
          userId,
          username,
        });

        return;
      }

      if (!client) {
        console.error("Message from unauthenticated client");
        return;
      }

      await handleMessage(client, event, eventData);
    } catch (error) {
      console.error("Failed to handle message:", error);
      try {
        if (client) {
          sendToClient(client, "error", { message: "Invalid message format" });
        }
      } catch {
        /* prevent double-throw */
      }
    }
  });

  // Handle disconnect
  ws.on("close", () => {
    console.log("Client disconnected");

    if (!client) return;

    try {
      if (client.roomId === "__feed__") {
        removeFeedSubscriber(ws);
        clients.delete(ws);
        return;
      }

      const room = rooms.get(client.roomId);
      if (room) {
        room.delete(client);

        broadcastToRoom(client.roomId, "user_left", {
          user_id: client.userId,
          username: client.username,
          avatar_url: client.avatarUrl,
        });

        updateViewerCount(client.roomId).catch(() => {});

        // Check if the disconnected user was the stream host
        checkAndBroadcastStreamEnd(client.roomId, client.userId);

        if (room.size === 0) {
          rooms.delete(client.roomId);
        }
      }

      // End battle if host or opponent disconnects
      const battleRoomId = userBattleRoom.get(client.userId);
      if (battleRoomId) {
        const battle = battles.get(battleRoomId);
        if (battle && battle.status !== "ENDED") {
          const isHost = battle.hostUserId === client.userId;
          const isOpponent = battle.opponentUserId === client.userId;
          if (isHost || isOpponent) {
            console.log(
              `Battle participant ${isHost ? "host" : "opponent"} disconnected, ending battle in room ${battleRoomId}`,
            );
            endBattle(battleRoomId);
          }
        }
      }

      clients.delete(ws);
    } catch (err) {
      console.error("Error in close handler:", err);
    }
  });
});

// When a user disconnects, check if they were the stream host and notify all viewers
async function checkAndBroadcastStreamEnd(roomId: string, userId: string) {
  if (!isStreamHost(roomId, userId)) return;
  removeActiveStream(roomId, userId);
  lastCohostLayoutByRoom.delete(roomId);
  broadcastToRoom(roomId, "stream_ended", {
    stream_key: roomId,
    host_user_id: userId,
    reason: "host_disconnected",
  });
  broadcastToFeedSubscribers("stream_ended", { stream_key: roomId });
}

 
// WebSocket rate limiter: per-user per-event
const wsRateLimits = new Map<string, number[]>();
function wsRateCheck(
  userId: string,
  event: string,
  maxPerWindow: number,
  windowMs: number,
): boolean {
  const key = `${userId}:${event}`;
  const now = Date.now();
  const timestamps = (wsRateLimits.get(key) || []).filter(
    (t) => now - t < windowMs,
  );
  if (timestamps.length >= maxPerWindow) return false;
  timestamps.push(now);
  wsRateLimits.set(key, timestamps);
  return true;
}

async function handleMessage(client: Client, event: string, data: any) {
  if (!data) data = {};

  try {
    switch (event) {
      case "chat_message":
        if (!wsRateCheck(client.userId, "chat", 100, 10_000)) break; // max 100 msgs / 10s
        broadcastToRoom(client.roomId, "chat_message", {
          ...data,
          user_id: client.userId,
          username: client.username,
          timestamp: new Date().toISOString(),
        });
        break;

      case "heart_sent":
        if (!wsRateCheck(client.userId, "heart", 30, 2_000)) break;
        broadcastToRoom(client.roomId, "heart_sent", {
          user_id: client.userId,
          username: data?.username || client.username,
          avatar: data?.avatar || "",
          timestamp: new Date().toISOString(),
        });
        break;

      case "gift_sent": {
        if (!wsRateCheck(client.userId, "gift", 50, 5_000)) break; // max 50 gifts / 5s
        const { transactionId } = data;

        if (transactionId && processedTransactions.has(transactionId)) {
          sendToClient(client, "gift_ack", {
            transactionId,
            status: "duplicate",
            timestamp: processedTransactions.get(transactionId),
          });
          return;
        }

        const now = Date.now();
        if (transactionId) {
          processedTransactions.set(transactionId, now);

          const fiveMinutesAgo = now - 5 * 60 * 1000;
          for (const [id, timestamp] of processedTransactions) {
            if (timestamp < fiveMinutesAgo) {
              processedTransactions.delete(id);
            }
          }
        }

        broadcastToRoom(client.roomId, "gift_sent", {
          ...data,
          user_id: client.userId,
          username: client.username,
          timestamp: new Date().toISOString(),
        });

        if (transactionId) {
          sendToClient(client, "gift_ack", {
            transactionId,
            status: "success",
            timestamp: now,
          });
        }

        // Auto-score gifts in active battles — use server-side gift value, NOT client
        const activeBattle = battles.get(client.roomId);
        if (activeBattle && activeBattle.status === "ACTIVE") {
          const serverGiftValue = getGiftValue(data.giftId);
          if (serverGiftValue > 0) {
            const normalizedTarget = normalizeBattleTarget(data.battleTarget);
            if (normalizedTarget) {
              addBattleScoreForTarget(
                client.roomId,
                normalizedTarget,
                serverGiftValue,
              );
            } else {
              addBattleScoreForTarget(client.roomId, "host", serverGiftValue);
            }
          }
        }
        break;
      }

      // ═══ BATTLE EVENTS — server-controlled ═══
      case "battle_create": {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:battle_create',message:'battle_create received',data:{roomId:client.roomId,userId:client.userId,opponentUserId:data.opponentUserId,opponentName:data.opponentName},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        const existing = battles.get(client.roomId);
        if (existing) {
          if (existing.timer) clearInterval(existing.timer);
          userBattleRoom.delete(existing.hostUserId);
          userBattleRoom.delete(existing.opponentUserId);
          battles.delete(client.roomId);
        }
        const session = createBattle(
          client.roomId,
          client.userId,
          data.hostName || client.displayName,
        );
        const opponentUserId =
          typeof data.opponentUserId === "string" ? data.opponentUserId : "";
        const opponentName =
          typeof data.opponentName === "string" ? data.opponentName : "";
        const opponentRoomId =
          typeof data.opponentRoomId === "string" ? data.opponentRoomId : "";
        if (opponentUserId && opponentName) {
          session.opponentUserId = opponentUserId;
          session.opponentName = opponentName;
          session.opponentRoomId = opponentRoomId;
          if (opponentUserId) userBattleRoom.set(opponentUserId, client.roomId);
          startBattleTimer(client.roomId);
        } else {
          sendToClient(client, "battle_created", {
            battleId: session.id,
            status: session.status,
          });
          broadcastBattleState(client.roomId, session);
        }
        break;
      }

      case "battle_join": {
        // #region agent log
        const _bjBattle = battles.get(client.roomId);
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:battle_join',message:'battle_join received',data:{roomId:client.roomId,userId:client.userId,opponentName:data.opponentName,battleExists:!!_bjBattle,battleStatus:_bjBattle?.status,battleOpponentUserId:_bjBattle?.opponentUserId},timestamp:Date.now(),hypothesisId:'C,D'})}).catch(()=>{});
        // #endregion
        const battleSession = joinBattle(
          client.roomId,
          client.userId,
          data.opponentName || client.displayName,
        );
        if (!battleSession) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:battle_join_FAILED',message:'joinBattle returned null!',data:{roomId:client.roomId,userId:client.userId},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          sendToClient(client, "battle_error", {
            message: "No battle to join",
          });
          break;
        }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:battle_join_OK',message:'joinBattle succeeded',data:{roomId:client.roomId,userId:client.userId,sessionStatus:battleSession.status},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        break;
      }

      case "battle_gift_score": {
        // Manual score event — validate target, use server gift value
        const bRoom = userBattleRoom.get(client.userId) || client.roomId;
        const target = normalizeBattleTarget(data.target);
        if (!target) break;
        const giftId = data.giftId;
        const serverPoints = giftId ? getGiftValue(giftId) : 0;
        if (serverPoints > 0) {
          addBattleScoreForTarget(bRoom, target, serverPoints);
        }
        break;
      }

      case "battle_spectator_vote": {
        const voteRoom = client.roomId;
        const voteBattle = battles.get(voteRoom);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:battle_spectator_vote',message:'incoming spectator vote',data:{roomId:voteRoom,hasBattle:!!voteBattle,status:voteBattle?.status,target:data?.target},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        if (!voteBattle || voteBattle.status !== "ACTIVE") break;
        const voteTarget = data.target === "host" ? "host" : "opponent";
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:battle_spectator_vote',message:'adding spectator vote points',data:{roomId:voteRoom,target:voteTarget,points:5},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        addBattleScoreForTarget(voteRoom, voteTarget, 5);
        sendToClient(client, "battle_vote_ack", { target: voteTarget, points: 5 });
        break;
      }

      case "battle_end": {
        // Host manually ends battle
        const bSession = battles.get(client.roomId);
        if (bSession && bSession.hostUserId === client.userId) {
          endBattle(client.roomId);
        }
        break;
      }

      case "battle_get_state": {
        const currentBattle = battles.get(client.roomId);
        if (currentBattle) {
          if (currentBattle.endsAt > 0) {
            currentBattle.timeLeft = Math.max(
              0,
              Math.round((currentBattle.endsAt - Date.now()) / 1000),
            );
          }
          sendToClient(client, "battle_state_sync", {
            id: currentBattle.id,
            status: currentBattle.status,
            hostUserId: currentBattle.hostUserId,
            hostName: currentBattle.hostName,
            opponentUserId: currentBattle.opponentUserId,
            opponentName: currentBattle.opponentName,
            player3UserId: currentBattle.player3UserId,
            player3Name: currentBattle.player3Name,
            player4UserId: currentBattle.player4UserId,
            player4Name: currentBattle.player4Name,
            hostScore: currentBattle.hostScore,
            opponentScore: currentBattle.opponentScore,
            player3Score: currentBattle.player3Score,
            player4Score: currentBattle.player4Score,
            timeLeft: currentBattle.timeLeft,
            endsAt: currentBattle.endsAt,
            winner: currentBattle.winner,
          });
        }
        break;
      }

      // ═══ BATTLE INVITES — host ↔ invited creators ═══
      case "battle_invite_send": {
        if (!wsRateCheck(client.userId, "battle_invite_send", 100, 60_000))
          break;
        const targetUserId =
          typeof data.targetUserId === "string" ? data.targetUserId : "";
        if (!targetUserId) break;
        const payload = {
          hostUserId: client.userId,
          hostName: data.hostName || client.displayName,
          hostAvatar: data.hostAvatar || client.avatarUrl || "",
          streamKey: client.roomId,
        };
        sendToUserGlobal(targetUserId, "battle_invite", payload);
        console.log(
          "[battle_invite] sent to userId:",
          targetUserId,
          "from:",
          client.userId,
        );
        break;
      }

      case "battle_invite_accept": {
        if (!wsRateCheck(client.userId, "battle_invite_accept", 100, 60_000))
          break;
        const hostUserId =
          typeof data.hostUserId === "string" ? data.hostUserId : "";
        if (!hostUserId) break;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:battle_invite_accept',message:'Opponent accepted battle invite',data:{opponentUserId:client.userId,opponentRoom:client.roomId,hostUserId,streamKeyFromData:data.streamKey},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        sendToUserGlobal(hostUserId, "battle_invite_accepted", {
          requesterUserId: client.userId,
          requesterName: data.requesterName || client.displayName,
          requesterAvatar: data.requesterAvatar || client.avatarUrl || "",
          streamKey: client.roomId,
        });
        break;
      }

      case "stream_end": {
        lastCohostLayoutByRoom.delete(client.roomId);
        removeActiveStream(client.roomId, client.userId);
        broadcastToRoom(client.roomId, "stream_ended", {
          stream_key: client.roomId,
          host_user_id: client.userId,
          reason: "host_ended",
        });
        broadcastToFeedSubscribers("stream_ended", { stream_key: client.roomId });
        break;
      }

      // ═══ CO-HOST INVITES & REQUESTS ═══
      case "cohost_invite_send": {
        if (!wsRateCheck(client.userId, "cohost_invite_send", 200, 60_000))
          break;
        const targetUserId =
          typeof data.targetUserId === "string" ? data.targetUserId : "";
        if (!targetUserId) break;
        const cohostSent = sendToUserGlobal(targetUserId, "cohost_invite", {
          hostUserId: client.userId,
          hostName: data.hostName || client.displayName,
          hostAvatar: data.hostAvatar || client.avatarUrl || "",
          streamKey: client.roomId,
        });
        sendToClient(client, "cohost_invite_ack", { targetUserId, delivered: cohostSent });
        break;
      }

      case "cohost_invite_accept": {
        if (!wsRateCheck(client.userId, "cohost_invite_accept", 200, 60_000))
          break;
        const hostUserId =
          typeof data.hostUserId === "string" ? data.hostUserId : "";
        if (!hostUserId) break;
        sendToUserGlobal(hostUserId, "cohost_invite_accepted", {
          cohostUserId: client.userId,
          cohostName: data.cohostName || client.displayName,
          cohostAvatar: data.cohostAvatar || client.avatarUrl || "",
          streamKey: data.streamKey || client.roomId,
        });
        break;
      }

      case "cohost_request_send": {
        if (!wsRateCheck(client.userId, "cohost_request_send", 100, 60_000))
          break;
        const hostUserId =
          typeof data.hostUserId === "string" ? data.hostUserId : "";
        if (!hostUserId) break;
        sendToUserGlobal(hostUserId, "cohost_request", {
          requesterUserId: client.userId,
          requesterName: data.requesterName || client.displayName,
          requesterAvatar: data.requesterAvatar || client.avatarUrl || "",
        });
        break;
      }

      case "cohost_request_accept": {
        if (!wsRateCheck(client.userId, "cohost_request_accept", 200, 60_000))
          break;
        const requesterUserId =
          typeof data.requesterUserId === "string" ? data.requesterUserId : "";
        if (!requesterUserId) break;
        sendToUserGlobal(requesterUserId, "cohost_request_accepted", {
          hostUserId: client.userId,
          hostName: data.hostName || client.displayName,
          hostAvatar: data.hostAvatar || client.avatarUrl || "",
          streamKey: client.roomId,
        });
        break;
      }

      case "cohost_request_decline": {
        if (!wsRateCheck(client.userId, "cohost_request_decline", 200, 60_000))
          break;
        const requesterUserId =
          typeof data.requesterUserId === "string" ? data.requesterUserId : "";
        if (!requesterUserId) break;
        sendToUserGlobal(requesterUserId, "cohost_request_declined", {
          hostUserId: client.userId,
          hostName: data.hostName || client.displayName,
        });
        break;
      }

      case "cohost_layout_sync": {
        const roomId = typeof data.roomId === "string" ? data.roomId : client.roomId;
        const rawCoHosts = Array.isArray(data.coHosts) ? data.coHosts : [];
        const hostUserId = typeof data.hostUserId === "string" ? data.hostUserId : client.userId;
        // Deduplicate by userId and exclude the host from the co-host list
        const seen = new Set<string>();
        const coHosts = rawCoHosts.filter((h: any) => {
          const uid = typeof h.userId === "string" ? h.userId : "";
          if (!uid || uid === hostUserId || seen.has(uid)) return false;
          seen.add(uid);
          return true;
        });
        if (roomId) {
          lastCohostLayoutByRoom.set(roomId, { coHosts, hostUserId });
          broadcastToRoom(roomId, "cohost_layout_sync", {
            coHosts,
            hostUserId,
          });
        }
        break;
      }

      case "booster_activated":
        broadcastToRoom(client.roomId, "booster_activated", {
          ...data,
          user_id: client.userId,
        });
        break;

      default:
        if (process.env.NODE_ENV !== "production")
          console.log("Unknown event:", event);
    }
  } catch (err) {
    console.error(`Error handling event '${event}':`, err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendToClient(client: Client, event: string, data: any) {
  try {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(
        JSON.stringify({
          event,
          data,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  } catch (error) {
    console.error("Failed to send to client:", error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendToUser(roomId: string, userId: string, event: string, data: any) {
  const room = rooms.get(roomId);
  if (!room) return;

  let message: string;
  try {
    message = JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to serialize message:", error);
    return;
  }

  room.forEach((client) => {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(message);
      } catch (error) {
        console.error("Failed to send to user:", error);
      }
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendToUserGlobal(userId: string, event: string, data: any): number {
  let message: string;
  try {
    message = JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to serialize message:", error);
    return 0;
  }

  let sent = 0;
  clients.forEach((client) => {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(message);
        sent += 1;
      } catch (error) {
        console.error("Failed to send to user (global):", error);
      }
    }
  });
  if (sent === 0) {
    console.warn(
      `[${event}] no connected client for userId:`,
      userId,
      "(invitee may be offline or on another page)",
    );
  }
  return sent;
}

 
function broadcastToRoom(
  roomId: string,
  event: string,
  data: any,
  exclude?: Client,
) {
  const room = rooms.get(roomId);
  if (!room) return;

  let message: string;
  try {
    message = JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to serialize message:", error);
    return;
  }

  room.forEach((client) => {
    if (client !== exclude && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(message);
      } catch (error) {
        console.error("Failed to send to client:", error);
      }
    }
  });
}

async function updateViewerCount(roomId: string) {
  const room = rooms.get(roomId);
  const count = room ? room.size : 0;
  broadcastToRoom(roomId, "viewer_count", { count });
  dbUpdateViewerCount(roomId, count).catch(() => {});
}

// WebSocket heartbeat: detect and clean up ghost connections every 30s
const HEARTBEAT_INTERVAL = 30_000;
const aliveClients = new WeakSet<WebSocket>();

const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!aliveClients.has(ws)) {
      ws.terminate();
      return;
    }
    aliveClients.delete(ws);
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on("connection", (ws) => {
  aliveClients.add(ws);
  ws.on("pong", () => {
    aliveClients.add(ws);
  });
});

wss.on("close", () => {
  clearInterval(heartbeatTimer);
});

// Stale stream cleanup: mark streams as offline if their host has no active WebSocket
// Uses updated_at to avoid killing streams that were recently created/updated
async function cleanupStaleStreams() {
  // Feature disabled
}

// Run cleanup on start (after 60s to allow reconnections after deploy) and every 30 seconds
setTimeout(cleanupStaleStreams, 60_000);
const staleCleanupTimer = setInterval(cleanupStaleStreams, 30_000);
wss.on("close", () => {
  clearInterval(staleCleanupTimer);
});

// Start server
logger.info({ port: PORT, nodeEnv: process.env.NODE_ENV }, "Starting server...");

try {
  // Bind to 0.0.0.0 to work in all environments
  server.listen(PORT, "0.0.0.0", async () => {
    await initPostgres();
    const dbVideos = await loadVideosFromDb();
    if (dbVideos.length > 0) {
      replaceVideos(dbVideos);
      logger.info({ count: dbVideos.length }, "Videos loaded from database");
    }

    // Remove any leftover demo/seed videos
    const allVids = getAllVideos();
    for (const v of allVids) {
      if (v.userId?.startsWith('demo_user_') || v.id?.startsWith('seed_')) {
        deleteVideo(v.id);
      }
    }

    // No more demo videos — real uploads only
    if (false) {
      const sampleVideos: Video[] = [
        {
          id: "seed_big_buck_bunny",
          url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          thumbnail:
            "https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
          duration: 60,
          userId: "demo_user_big_buck_bunny",
          username: "bigbunny",
          displayName: "Big Buck Bunny",
          avatar: "",
          description: "Big Buck Bunny — demo video",
          hashtags: ["bigbuckbunny", "demo", "elixstar"],
          music: null,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          createdAt: new Date().toISOString(),
          privacy: "public",
        },
        {
          id: "seed_sintel",
          url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
          thumbnail:
            "https://storage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg",
          duration: 60,
          userId: "demo_user_sintel",
          username: "sintel",
          displayName: "Sintel",
          avatar: "",
          description: "Sintel — demo video",
          hashtags: ["sintel", "demo", "elixstar"],
          music: null,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          createdAt: new Date().toISOString(),
          privacy: "public",
        },
      ];
      for (const v of sampleVideos) addVideo(v);
      logger.info({ count: sampleVideos.length }, "Seed demo videos added (Big Buck Bunny, Sintel)");
    }

    logger.info({ port: PORT, version: BUILD_VERSION }, "Server running successfully");
  });
} catch (error) {
  logger.fatal({ err: error }, "Failed to start server");
  process.exit(1);
}

// Prevent server crash on unhandled errors
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled Promise Rejection");
});
process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught Exception");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("Shutting down...");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
