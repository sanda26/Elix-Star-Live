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
} from "./routes/checkout";
import { handleStripeWebhook } from "./routes/webhook";
import { handleLiveKitWebhook } from "./routes/livekit-webhook";
import {
  handleAnalytics,
  handleBlockUser,
  handleReport,
  handleSendNotification,
  handleVerifyPurchase,
  handlePromoteIAPComplete,
} from "./routes/misc";
import {
  handleForYouFeed,
  handleFriendsFeed,
  handleTrackView,
  handleTrackInteraction,
  handleGetVideoScore,
  invalidateFeedCache,
} from "./routes/feed";
import {
  handleGetVideoComments,
  handlePostVideoComment,
  handleDeleteVideoComment,
} from "./routes/comments";
import { handleGetMyActivity } from "./routes/activity";
import {
  handlePostLiveShare,
  handleGetLiveShareRequests,
} from "./routes/liveShareInbox";
import { setLiveShareNotifier } from "./lib/liveShareNotify";
import { executeLiveShareSend } from "./lib/liveShareOps";
import {
  addVideo,
  getVideo,
  getAllVideos,
  getVideosByUser,
  deleteVideo,
  replaceVideos,
  incrementStat,
  decrementStat,
  type Video,
} from "./lib/videoStore";
import {
  initPostgres,
  loadVideosFromDb,
  saveVideoToDb,
  deleteVideoFromDb,
  dbUpdateViewerCount,
  getPool,
  isPostgresConfigured,
  dbEnsureBattleCreatorBuckets,
  dbAddBattleScoreAndFetchAll,
  dbAddBattleScoreTeamSideAndFetchAll,
  dbDeleteBattleBuckets,
  dbSyncBattleCreatorSlot,
  type BattleSessionScoreContext,
} from "./lib/postgres";
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
import { createShopCheckoutSession } from "./routes/shopCheckout";
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
  handleListProfiles,
} from "./routes/profiles";
import { addFeedSubscriber, removeFeedSubscriber, broadcastToFeedSubscribers } from "./feedBroadcast";
import { handleGetThreads, handleCreateThread, handleGetMessages, handleSendMessage, handleDeleteThread } from "./routes/chat";
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

/** Dev-only: confirm a single shared battle state (not per-socket). */
if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug/battle", (_req, res) => {
    const list = Array.from(battles.entries()).map(([hostRoomKey, s]) => ({
      mapKey: hostRoomKey,
      hostRoomId: s.hostRoomId,
      opponentRoomId: s.opponentRoomId,
      status: s.status,
      players: {
        A1: s.hostScore,
        A2: s.player3Score,
        B1: s.opponentScore,
        B2: s.player4Score,
      },
      teamA: s.hostScore + s.player3Score,
      teamB: s.opponentScore + s.player4Score,
    }));
    res.json({ sharedBattlesInMemory: list.length, battles: list });
  });
}
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
app.post("/api/auth/forgot-password", (_req, res) => {
  res.json({ message: "If an account exists with that email, a reset link has been sent." });
});
app.post("/api/auth/reset-password", (_req, res) => {
  res.status(501).json({ error: "Password reset is not yet available. Please contact support." });
});

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
app.post("/api/analytics", handleAnalytics);
app.post("/api/analytics/track", handleAnalytics);
app.post("/api/block-user", handleBlockUser);
app.post("/api/test-coins", handleAddTestCoins);

// Profiles
app.get("/api/profiles", handleListProfiles);
app.get("/api/profiles/by-username/:username", handleGetProfileByUsername);
app.get("/api/profiles/:userId", handleGetProfile);
app.get("/api/profiles/:userId/followers", handleGetFollowers);
app.get("/api/profiles/:userId/following", handleGetFollowing);
app.patch("/api/profiles/:userId", handlePatchProfile);
app.post("/api/profiles/:userId/follow", handleFollow);
app.post("/api/profiles/:userId/unfollow", handleUnfollow);
app.post("/api/profiles", handleSeedProfile);

app.get("/api/activity", handleGetMyActivity);
app.post("/api/live-share", handlePostLiveShare);
app.get("/api/inbox/live-share-requests", handleGetLiveShareRequests);

// Chat / Direct Messages
app.get("/api/chat/threads", handleGetThreads);
app.post("/api/chat/threads", handleCreateThread);
app.get("/api/chat/threads/:threadId/messages", handleGetMessages);
app.post("/api/chat/threads/:threadId/messages", handleSendMessage);
app.delete("/api/chat/threads/:threadId", handleDeleteThread);

app.post("/api/delete-account", handleDeleteAccount);
app.post("/api/report", handleReport);
app.post("/api/live/moderation/check", handleLiveModerationCheck);
app.post("/api/send-notification", handleSendNotification);
app.post("/api/verify-purchase", handleVerifyPurchase);
app.post("/api/promote-iap-complete", handlePromoteIAPComplete);

// Feed & Recommendation API
app.get("/api/feed/foryou", handleForYouFeed);
app.get("/api/feed/friends", handleFriendsFeed);
app.post("/api/feed/track-view", handleTrackView);
app.post("/api/feed/track-interaction", handleTrackInteraction);
app.get("/api/feed/score/:videoId", handleGetVideoScore);

// Comments (For You)
app.get("/api/videos/:id/comments", handleGetVideoComments);
app.post("/api/videos/:id/comments", handlePostVideoComment);
app.delete("/api/videos/:id/comments/:commentId", handleDeleteVideoComment);

// ── Like / Save (in-memory; persists across session via Zustand on client) ──────────────────────
const likesMap = new Map<string, Set<string>>(); // videoId → Set<userId>
const savesMap = new Map<string, Set<string>>(); // videoId → Set<userId>

app.post("/api/videos/:id/like", async (req, res) => {
  const videoId = req.params.id;
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  const payload = verifyAuthToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid session." });
  const userId = payload.sub;

  const db = getPool();
  if (db) {
    try {
      await db.query(
        `INSERT INTO likes (user_id, video_id, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, video_id) DO NOTHING`,
        [userId, videoId],
      );
      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM likes WHERE video_id = $1`,
        [videoId],
      );
      const likes = Number(countRes.rows?.[0]?.count || 0);
      await db.query(`UPDATE videos SET likes = $2 WHERE id = $1`, [videoId, likes]).catch(() => {});
      const v = getVideo(videoId);
      if (v) v.likes = likes;
      return res.json({ liked: true, likes });
    } catch {
      return res.status(500).json({ error: "Failed to persist like" });
    }
  }

  if (!likesMap.has(videoId)) likesMap.set(videoId, new Set());
  const set = likesMap.get(videoId)!;
  if (set.has(userId)) return res.json({ liked: true, likes: getVideo(videoId)?.likes || 0 });
  set.add(userId);
  incrementStat(videoId, "likes");
  const video = getVideo(videoId);
  return res.json({ liked: true, likes: video?.likes || 0 });
});

app.post("/api/videos/:id/unlike", async (req, res) => {
  const videoId = req.params.id;
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  const payload = verifyAuthToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid session." });
  const userId = payload.sub;

  const db = getPool();
  if (db) {
    try {
      await db.query(`DELETE FROM likes WHERE user_id = $1 AND video_id = $2`, [userId, videoId]);
      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM likes WHERE video_id = $1`,
        [videoId],
      );
      const likes = Number(countRes.rows?.[0]?.count || 0);
      await db.query(`UPDATE videos SET likes = $2 WHERE id = $1`, [videoId, likes]).catch(() => {});
      const v = getVideo(videoId);
      if (v) v.likes = likes;
      return res.json({ liked: false, likes });
    } catch {
      return res.status(500).json({ error: "Failed to persist unlike" });
    }
  }

  const set = likesMap.get(videoId);
  if (!set || !set.has(userId)) return res.json({ liked: false, likes: getVideo(videoId)?.likes || 0 });
  set.delete(userId);
  decrementStat(videoId, "likes");
  const video = getVideo(videoId);
  return res.json({ liked: false, likes: video?.likes || 0 });
});

app.post("/api/videos/:id/save", async (req, res) => {
  const videoId = req.params.id;
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  const payload = verifyAuthToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid session." });
  const userId = payload.sub;

  const db = getPool();
  if (db) {
    try {
      await db.query(
        `INSERT INTO saves (user_id, video_id, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, video_id) DO NOTHING`,
        [userId, videoId],
      );
      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM saves WHERE video_id = $1`,
        [videoId],
      );
      const saves = Number(countRes.rows?.[0]?.count || 0);
      await db.query(`UPDATE videos SET saves = $2 WHERE id = $1`, [videoId, saves]).catch(() => {});
      const v = getVideo(videoId);
      if (v) v.saves = saves;
      return res.json({ saved: true, saves });
    } catch {
      return res.status(500).json({ error: "Failed to persist save" });
    }
  }

  if (!savesMap.has(videoId)) savesMap.set(videoId, new Set());
  const set = savesMap.get(videoId)!;
  if (set.has(userId)) return res.json({ saved: true, saves: getVideo(videoId)?.saves || 0 });
  set.add(userId);
  incrementStat(videoId, "saves");
  const video = getVideo(videoId);
  return res.json({ saved: true, saves: video?.saves || 0 });
});

app.post("/api/videos/:id/unsave", async (req, res) => {
  const videoId = req.params.id;
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  const payload = verifyAuthToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid session." });
  const userId = payload.sub;

  const db = getPool();
  if (db) {
    try {
      await db.query(`DELETE FROM saves WHERE user_id = $1 AND video_id = $2`, [userId, videoId]);
      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM saves WHERE video_id = $1`,
        [videoId],
      );
      const saves = Number(countRes.rows?.[0]?.count || 0);
      await db.query(`UPDATE videos SET saves = $2 WHERE id = $1`, [videoId, saves]).catch(() => {});
      const v = getVideo(videoId);
      if (v) v.saves = saves;
      return res.json({ saved: false, saves });
    } catch {
      return res.status(500).json({ error: "Failed to persist unsave" });
    }
  }

  const set = savesMap.get(videoId);
  if (!set || !set.has(userId)) return res.json({ saved: false, saves: getVideo(videoId)?.saves || 0 });
  set.delete(userId);
  decrementStat(videoId, "saves");
  const video = getVideo(videoId);
  return res.json({ saved: false, saves: video?.saves || 0 });
});

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
    if (isPostgresConfigured()) {
      try {
        await saveVideoToDb(video);
      } catch (err: any) {
        logger.error({ err: err?.message || err, videoId: id }, "POST /api/videos DB save failed — video kept in memory");
      }
    }
    invalidateFeedCache();
    logger.info({ videoId: id, total: getAllVideos().length }, "Video created");

    return res.status(201).json(video);
  } catch (err: any) {
    logger.error({ err: err?.message || err }, "POST /api/videos failed");
    return res.status(500).json({ error: "Failed to create video" });
  }
});

app.get("/api/videos", (_req, res) => {
  const videos = getAllVideos().filter(v => v.url && v.url.trim());
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

app.delete("/api/videos/:id", async (req, res) => {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  const payload = verifyAuthToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired session." });

  const video = getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  if (video.userId !== payload.sub) return res.status(403).json({ error: "You can only delete your own videos." });

  try {
    await deleteVideoFromDb(req.params.id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Database delete failed";
    logger.error({ err: msg, videoId: req.params.id }, "DELETE /api/videos/:id DB failed");
    return res.status(500).json({ error: "Could not delete video from database. Try again." });
  }

  deleteVideo(req.params.id);
  invalidateFeedCache();
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
app.post("/api/shop/checkout", createShopCheckoutSession);
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
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
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

async function resolveSocketIdentity(userId: string): Promise<{
  username: string;
  displayName: string;
  avatarUrl: string;
  level: number;
  country: string;
}> {
  const fallbackUsername = `user_${String(userId).slice(0, 8)}`;
  const fallbackDisplayName = `User ${String(userId).slice(0, 8)}`;
  try {
    const pool = getPool();
    if (!pool) {
      return {
        username: fallbackUsername,
        displayName: fallbackDisplayName,
        avatarUrl: "",
        level: 1,
        country: "",
      };
    }

    const result = await pool.query<{
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
      level: number | null;
    }>(
      `
      SELECT
        COALESCE(
          NULLIF(TRIM(p.username), ''),
          NULLIF(TRIM(p.display_name), ''),
          NULLIF(TRIM(au.username), ''),
          NULLIF(TRIM(au.display_name), '')
        ) AS username,
        COALESCE(
          NULLIF(TRIM(p.display_name), ''),
          NULLIF(TRIM(p.username), ''),
          NULLIF(TRIM(au.display_name), ''),
          NULLIF(TRIM(au.username), '')
        ) AS display_name,
        COALESCE(
          NULLIF(TRIM(p.avatar_url), ''),
          NULLIF(TRIM(au.avatar_url), '')
        ) AS avatar_url,
        COALESCE(p.level, 1) AS level
      FROM (SELECT * FROM profiles WHERE user_id = $1 LIMIT 1) p
      FULL OUTER JOIN (SELECT * FROM auth_users WHERE id = $1 LIMIT 1) au ON true
      LIMIT 1
      `,
      [userId],
    );

    const row = result.rows?.[0];
    return {
      username: String(row?.username || "").trim() || fallbackUsername,
      displayName:
        String(row?.display_name || "").trim() ||
        String(row?.username || "").trim() ||
        fallbackDisplayName,
      avatarUrl: String(row?.avatar_url || "").trim(),
      level:
        typeof row?.level === "number" && Number.isFinite(row.level) && row.level > 0
          ? Math.floor(row.level)
          : 1,
      country: "",
    };
  } catch {
    return {
      username: fallbackUsername,
      displayName: fallbackDisplayName,
      avatarUrl: "",
      level: 1,
      country: "",
    };
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
/** Cumulative live appreciation taps (heart_sent) per room — synced to all clients. */
const roomLiveLikes = new Map<string, number>();
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

function normalizeBattleTarget(
  rawTarget: unknown,
): "host" | "opponent" | "player3" | "player4" | null {
  if (rawTarget == null || rawTarget === "") return null;
  const s = String(rawTarget).trim().toLowerCase();
  if (s === "host" || s === "red") return "host";
  if (s === "opponent" || s === "blue" || s === "guest") return "opponent";
  if (s === "player3" || s === "p3") return "player3";
  if (s === "player4" || s === "p4") return "player4";
  // "me" is ambiguous (host vs opponent stream); gift_sent resolves it via room + userId
  if (s === "me") return null;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// BATTLE SYSTEM — Server-controlled sessions, timers, scoring
//
// Logical model (same as in-memory session):
//   players: { A1: hostScore, A2: player3Score, B1: opponentScore, B2: player4Score }
//   multiplier: { A: teamRedMultiplier, B: teamBlueMultiplier }  // tap only; server authority
//   teamA = A1+A2, teamB = B1+B2 (derived)
//
// WebSocket events (Socket.IO-style names, no Socket.IO dependency):
//   Client → server: battle:tap { team: "A"|"B" } | battle_spectator_vote (legacy)
//   Server → all:   battle:score_update every 300ms while ACTIVE; battle_score on each change (legacy)
//   Booster: booster:spawn (host), booster:catch { team }, booster:activated / booster:spawn broadcast
//   Chat during battle: +1 battleLikes → likes:update { total }
//
// Gifts: addBattleScoreForTarget — one bucket per gift (unchanged).
//
// When DATABASE_URL is set (e.g. Neon), each creator’s points live in Postgres table
// `battle_creator_buckets` (one row per slot per host_room_id). In-memory session scores
// mirror DB after each update; if DB fails, we fall back to in-memory for that request.
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
  /** Applied to spectator tap points for whole red side (both A1 and A2). Default 1. */
  teamRedMultiplier: number;
  /** Applied to spectator tap points for whole blue side (both B1 and B2). Default 1. */
  teamBlueMultiplier: number;
  /** Battle-scoped like counter (e.g. +1 per chat message while battle active). */
  battleLikes: number;
}

// IMPORTANT: `battles` is keyed ONLY by the host's stream room id (`hostRoomId`). That is the
// single source of truth for a PK session. Do NOT use `battles.get(client.roomId)` when the
// socket is on the opponent's stream — lookups will miss. Use `resolveBattleSessionForRoom`,
// `userBattleRoom.get(userId)`, `resolveActiveBattleRoomId`, or `joinBattle(session.hostRoomId, …)`.
const battles = new Map<string, BattleSession>();
/** Maps participant userId → host `hostRoomId` for the battle they belong to. */
const userBattleRoom = new Map<string, string>();
/** For PK trace logs: skip duplicate EMITTING lines when team totals unchanged between 300ms ticks. */
const lastBattleEmitSnapshotByHostRoom = new Map<string, string>();
const lastCohostLayoutByRoom = new Map<string, { coHosts: unknown[]; hostUserId: string }>();

/** Set DEBUG_BATTLE_SCORE=0 to silence. Otherwise traces run in non-production or when DEBUG_BATTLE_SCORE=1. */
function isBattlePkTrace(): boolean {
  if (process.env.DEBUG_BATTLE_SCORE === "0") return false;
  return process.env.DEBUG_BATTLE_SCORE === "1" || process.env.NODE_ENV !== "production";
}

/** Pending server-spawned booster (catch only sends team — multiplier comes from here). */
type PendingBooster = { team: "A" | "B"; multiplier: number; expiresAt: number };
const pendingBoosterByRoom = new Map<string, PendingBooster>();

/** Host room id for an active battle, or opponent’s room mapped to host battle room. */
function resolveActiveBattleRoomId(roomId: string, userId: string): string | null {
  const here = battles.get(roomId);
  if (here && here.status === "ACTIVE") return roomId;
  const fromUser = userBattleRoom.get(userId);
  if (fromUser) {
    const s = battles.get(fromUser);
    if (s && s.status === "ACTIVE") return fromUser;
  }
  for (const [rId, s] of battles) {
    if (s.status === "ACTIVE" && s.opponentRoomId === roomId) return rId;
  }
  return null;
}

/**
 * Shared battle state is global (`battles` Map). Key is always the host's `hostRoomId`.
 * Viewers who open the opponent's stream join WS with `roomId === opponentRoomId` — they must
 * still receive the same session (otherwise they see empty scores until a random broadcast).
 */
function resolveBattleSessionForRoom(roomId: string): BattleSession | null {
  if (!roomId) return null;
  const direct = battles.get(roomId);
  if (direct && direct.status !== "ENDED") return direct;
  for (const [, session] of battles) {
    if (session.status === "ENDED") continue;
    if (session.hostRoomId === roomId) return session;
    if (session.opponentRoomId && session.opponentRoomId === roomId) return session;
  }
  return null;
}

function buildBattleScoreUpdatePayload(session: BattleSession) {
  const players = {
    A1: session.hostScore,
    A2: session.player3Score,
    B1: session.opponentScore,
    B2: session.player4Score,
  };
  const teamA = players.A1 + players.A2;
  const teamB = players.B1 + players.B2;
  return {
    battleId: session.id,
    players,
    multiplier: { A: session.teamRedMultiplier, B: session.teamBlueMultiplier },
    teamA,
    teamB,
    likes: session.battleLikes,
  };
}

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
    teamRedMultiplier: 1,
    teamBlueMultiplier: 1,
    battleLikes: 0,
  };
  battles.set(hostRoomId, session);
  userBattleRoom.set(hostUserId, hostRoomId);
  if (isPostgresConfigured()) {
    void dbEnsureBattleCreatorBuckets(battleSessionToScoreCtx(session)).catch((err) =>
      logger.error({ err, hostRoomId }, "dbEnsureBattleCreatorBuckets on createBattle failed"),
    );
  }
  return session;
}

function battleSessionToScoreCtx(s: BattleSession): BattleSessionScoreContext {
  return {
    hostRoomId: s.hostRoomId,
    id: s.id,
    hostUserId: s.hostUserId,
    opponentUserId: s.opponentUserId,
    player3UserId: s.player3UserId,
    player4UserId: s.player4UserId,
  };
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
    if (session.opponentUserId === userId && !session.opponentRoomId) {
      for (const [, c] of clients) {
        if (c.userId === userId && c.roomId && c.roomId !== roomId) {
          session.opponentRoomId = c.roomId;
          break;
        }
      }
    }
    if (session.status === "WAITING") {
      startBattleTimer(roomId);
    }
    return session;
  }
  if (session.hostUserId === userId) return session;

  if (!session.opponentUserId) {
    session.opponentUserId = userId;
    session.opponentName = userName;
    if (!session.opponentRoomId) {
      for (const [, c] of clients) {
        if (c.userId === userId && c.roomId && c.roomId !== roomId) {
          session.opponentRoomId = c.roomId;
          break;
        }
      }
    }
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
  if (isPostgresConfigured()) {
    if (session.opponentUserId === userId) {
      void dbSyncBattleCreatorSlot(roomId, "opponent", userId);
    } else if (session.player3UserId === userId) {
      void dbSyncBattleCreatorSlot(roomId, "player3", userId);
    } else if (session.player4UserId === userId) {
      void dbSyncBattleCreatorSlot(roomId, "player4", userId);
    }
    void dbEnsureBattleCreatorBuckets(battleSessionToScoreCtx(session)).catch((err) =>
      logger.error({ err, roomId }, "dbEnsureBattleCreatorBuckets on joinBattle failed"),
    );
  }
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
    // No battle_tick broadcast — clients count down locally; scores only change on battle_score / sync.
    if (s.timeLeft <= 0) {
      endBattle(roomId);
    }
  }, 1000);
}

/** Rate-limit scored spectator taps: max 5 per second per user per battle room. */
const battleSpectatorTapTimestamps = new Map<string, number[]>();
function allowBattleSpectatorTapScore(userId: string, roomId: string, maxPerSec: number): boolean {
  const key = `${userId}:${roomId}`;
  const now = Date.now();
  const windowMs = 1000;
  const arr = (battleSpectatorTapTimestamps.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= maxPerSec) return false;
  arr.push(now);
  battleSpectatorTapTimestamps.set(key, arr);
  return true;
}

/** Spectator/creator PK tap: map to team only — same points go to BOTH players on that side. */
function normalizeSpectatorVoteTeam(raw: unknown): "red" | "blue" | null {
  const s = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  if (s === "host" || s === "player3" || s === "red" || s === "left" || s === "a") return "red";
  if (s === "opponent" || s === "player4" || s === "blue" || s === "right" || s === "b") return "blue";
  return null;
}

function applyBattleScoreInMemory(
  session: BattleSession,
  target: "host" | "opponent" | "player3" | "player4",
  points: number,
) {
  if (target === "host") {
    session.hostScore += points;
  } else if (target === "opponent") {
    session.opponentScore += points;
  } else if (target === "player3") {
    session.player3Score += points;
  } else if (target === "player4") {
    session.player4Score += points;
  }
}

function broadcastBattleScoreFromSession(
  session: BattleSession,
  roomId: string,
  target: "host" | "opponent" | "player3" | "player4",
  points: number,
) {
  const scorePayload = {
    hostScore: session.hostScore,
    opponentScore: session.opponentScore,
    player3Score: session.player3Score,
    player4Score: session.player4Score,
    lastScorer: target,
    points,
    hostUserId: session.hostUserId,
    opponentUserId: session.opponentUserId,
    player3UserId: session.player3UserId,
    player4UserId: session.player4UserId,
    hostName: session.hostName,
    opponentName: session.opponentName,
    player3Name: session.player3Name,
    player4Name: session.player4Name,
  };
  broadcastToRoom(roomId, "battle_score", scorePayload);
  broadcastToBattleParticipants(roomId, session, "battle_score", scorePayload);
  // #region agent log
  fetch('http://127.0.0.1:7765/ingest/504ee8d9-85af-4146-9e87-ee22d4845d37',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d3b772'},body:JSON.stringify({sessionId:'d3b772',runId:'run-current',hypothesisId:'H3',location:'server/index.ts:broadcastBattleScoreFromSession',message:'server battle_score broadcast',data:{roomId,target,points,hostScore:session.hostScore,opponentScore:session.opponentScore,player3Score:session.player3Score,player4Score:session.player4Score},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (isBattlePkTrace()) {
    const A = session.hostScore + session.player3Score;
    const B = session.opponentScore + session.player4Score;
    console.log("UPDATE AFTER:", { A, B, battleKey: roomId });
  }
}

/** Add points to exactly one of P1–P4; Neon buckets when DATABASE_URL set, else memory. */
function addBattleScoreForTarget(
  roomId: string,
  target: "host" | "opponent" | "player3" | "player4",
  points: number,
) {
  const session = battles.get(roomId);
  if (!session || session.status !== "ACTIVE") return;

  if (isPostgresConfigured()) {
    void (async () => {
      const s = battles.get(roomId);
      if (!s || s.status !== "ACTIVE") return;
      const row = await dbAddBattleScoreAndFetchAll(roomId, target, points, battleSessionToScoreCtx(s));
      if (row) {
        s.hostScore = row.host;
        s.opponentScore = row.opponent;
        s.player3Score = row.player3;
        s.player4Score = row.player4;
        broadcastBattleScoreFromSession(s, roomId, target, points);
      } else {
        applyBattleScoreInMemory(s, target, points);
        broadcastBattleScoreFromSession(s, roomId, target, points);
        logger.warn({ roomId, target }, "battle score: DB unavailable, used in-memory fallback");
      }
    })();
    return;
  }

  applyBattleScoreInMemory(session, target, points);
  broadcastBattleScoreFromSession(session, roomId, target, points);
}

/** PK tap: add the same points to both players on red (host+player3) or blue (opponent+player4). */
function addBattleScoreForTeamSide(
  roomId: string,
  side: "red" | "blue",
  pointsPerPlayer: number,
) {
  const session = battles.get(roomId);
  if (!session || session.status !== "ACTIVE") return;

  if (isPostgresConfigured()) {
    void (async () => {
      const s = battles.get(roomId);
      if (!s || s.status !== "ACTIVE") return;
      const row = await dbAddBattleScoreTeamSideAndFetchAll(
        roomId,
        side,
        pointsPerPlayer,
        battleSessionToScoreCtx(s),
      );
      if (row) {
        s.hostScore = row.host;
        s.opponentScore = row.opponent;
        s.player3Score = row.player3;
        s.player4Score = row.player4;
        broadcastBattleScoreFromSession(s, roomId, side === "red" ? "host" : "opponent", pointsPerPlayer);
      } else {
        applyBattleScoreInMemory(s, side === "red" ? "host" : "opponent", pointsPerPlayer);
        applyBattleScoreInMemory(s, side === "red" ? "player3" : "player4", pointsPerPlayer);
        broadcastBattleScoreFromSession(s, roomId, side === "red" ? "host" : "opponent", pointsPerPlayer);
        logger.warn({ roomId, side }, "battle team score: DB unavailable, used in-memory fallback");
      }
    })();
    return;
  }

  applyBattleScoreInMemory(session, side === "red" ? "host" : "opponent", pointsPerPlayer);
  applyBattleScoreInMemory(session, side === "red" ? "player3" : "player4", pointsPerPlayer);
  broadcastBattleScoreFromSession(session, roomId, side === "red" ? "host" : "opponent", pointsPerPlayer);
}

function endBattle(roomId: string) {
  const session = battles.get(roomId);
  if (!session) return;

  pendingBoosterByRoom.delete(roomId);

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

  const endedPayload = {
    hostScore: session.hostScore,
    opponentScore: session.opponentScore,
    player3Score: session.player3Score,
    player4Score: session.player4Score,
    winner: session.winner,
    hostName: session.hostName,
    opponentName: session.opponentName,
    player3Name: session.player3Name,
    player4Name: session.player4Name,
    hostUserId: session.hostUserId,
    opponentUserId: session.opponentUserId,
  };
  broadcastToRoom(roomId, "battle_ended", endedPayload);
  broadcastToBattleParticipants(roomId, session, "battle_ended", endedPayload);

  if (isPostgresConfigured()) {
    void dbDeleteBattleBuckets(roomId).catch((err) =>
      logger.error({ err, roomId }, "dbDeleteBattleBuckets on endBattle failed"),
    );
  }

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
  const statePayload = {
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
  };
  broadcastToRoom(roomId, "battle_state_sync", statePayload);
  broadcastToBattleParticipants(roomId, session, "battle_state_sync", statePayload);
}

function broadcastToBattleParticipants(
  roomId: string,
  session: BattleSession,
  event: string,
  data: any,
) {
  // Broadcast to all battle-related rooms (opponent's room, etc.) so spectators there see scores
  const extraRoomIds = [session.opponentRoomId].filter(
    (r): r is string => typeof r === "string" && r.length > 0 && r !== roomId,
  );
  for (const extraRoom of extraRoomIds) {
    broadcastToRoom(extraRoom, event, data);
  }

  // Send directly to any participant not already reached via room broadcasts
  const participantIds = [
    session.hostUserId,
    session.opponentUserId,
    session.player3UserId,
    session.player4UserId,
  ].filter((id): id is string => typeof id === "string" && id.length > 0);
  if (participantIds.length === 0) return;

  const reachedUserIds = new Set<string>();
  for (const rId of [roomId, ...extraRoomIds]) {
    const room = rooms.get(rId);
    if (room) {
      room.forEach((client) => {
        if (client?.userId) reachedUserIds.add(client.userId);
      });
    }
  }

  for (const userId of participantIds) {
    if (!reachedUserIds.has(userId)) {
      sendToUserGlobal(userId, event, data);
    }
  }
}

/** Server authority: full battle snapshot to all clients ~300ms while ACTIVE (anti-cheat friendly). */
setInterval(() => {
  for (const [roomId, session] of battles) {
    if (session.status !== "ACTIVE") continue;
    const payload = buildBattleScoreUpdatePayload(session);
    if (isBattlePkTrace()) {
      const sig = `${payload.teamA},${payload.teamB}`;
      if (lastBattleEmitSnapshotByHostRoom.get(roomId) !== sig) {
        lastBattleEmitSnapshotByHostRoom.set(roomId, sig);
        const hostClients = rooms.get(roomId)?.size ?? 0;
        const oppR = session.opponentRoomId;
        const oppClients =
          typeof oppR === "string" && oppR.length > 0 ? (rooms.get(oppR)?.size ?? 0) : 0;
        console.log("EMITTING:", {
          teamA: payload.teamA,
          teamB: payload.teamB,
          battleKey: roomId,
        });
        console.log("ROOM SIZE:", {
          hostRoom: roomId,
          hostClients,
          opponentRoom: oppR || "(none)",
          opponentClients: oppClients,
          note: "Custom WS rooms map (not Socket.io); expect 1+ per stream with viewers.",
        });
      }
    }
    broadcastToRoom(roomId, "battle:score_update", payload);
    broadcastToBattleParticipants(roomId, session, "battle:score_update", payload);
  }
}, 300);

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

    const identity = await resolveSocketIdentity(userId);
    const username = identity.username;
    const displayName = identity.displayName;
    const avatarUrl = identity.avatarUrl;
    const level = identity.level;
    const country = identity.country;

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

    sendToClient(client, "room_state", {
      viewers,
      live_likes: roomLiveLikes.get(roomId) ?? 0,
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

    // If there's a battle for this stream (host OR opponent room URL), send the same shared state
    const activeBattleOnJoin = resolveBattleSessionForRoom(roomId);
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
        hostRoomId: activeBattleOnJoin.hostRoomId,
        hostUserId: activeBattleOnJoin.hostUserId,
        hostName: activeBattleOnJoin.hostName,
        opponentUserId: activeBattleOnJoin.opponentUserId,
        opponentName: activeBattleOnJoin.opponentName,
        opponentRoomId: activeBattleOnJoin.opponentRoomId,
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
        hostReady: activeBattleOnJoin.hostReady,
        opponentReady: activeBattleOnJoin.opponentReady,
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
        {
          const battleRoom = resolveActiveBattleRoomId(client.roomId, client.userId);
          if (battleRoom) {
            const b = battles.get(battleRoom);
            if (b && b.status === "ACTIVE") {
              b.battleLikes += 1;
              const likesPayload = { total: b.battleLikes, battleId: b.id };
              broadcastToRoom(battleRoom, "likes:update", likesPayload);
              broadcastToBattleParticipants(battleRoom, b, "likes:update", likesPayload);
            }
          }
        }
        break;

      case "heart_sent":
        if (!wsRateCheck(client.userId, "heart", 30, 2_000)) break;
        {
          const roomId = client.roomId;
          const next = (roomLiveLikes.get(roomId) ?? 0) + 1;
          roomLiveLikes.set(roomId, next);
          broadcastToRoom(roomId, "heart_sent", {
            user_id: client.userId,
            username: data?.username || client.username,
            avatar: data?.avatar || "",
            timestamp: new Date().toISOString(),
            live_likes: next,
          });
        }
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
        // Look up battle by client's room first, then by userBattleRoom, then by opponentRoomId
        let battleRoomId = client.roomId;
        if (!battles.has(battleRoomId)) {
          const fromUser = userBattleRoom.get(client.userId);
          if (fromUser) {
            battleRoomId = fromUser;
          } else {
            for (const [rId, s] of battles) {
              if (s.opponentRoomId === client.roomId) { battleRoomId = rId; break; }
            }
          }
        }
        const activeBattle = battles.get(battleRoomId);
        if (activeBattle && activeBattle.status === "ACTIVE") {
          const giftIdRaw = String(data.giftId ?? "").trim();
          let serverGiftValue = getGiftValue(giftIdRaw);
          if (serverGiftValue <= 0) {
            const c = Number(data.coins);
            if (Number.isFinite(c) && c > 0) {
              serverGiftValue = Math.min(Math.floor(c), 1_000_000_000);
            }
          }
          if (serverGiftValue > 0) {
            let normalizedTarget = normalizeBattleTarget(data.battleTarget);
            const isBattleParticipant =
              client.userId === activeBattle.hostUserId ||
              client.userId === activeBattle.opponentUserId ||
              client.userId === activeBattle.player3UserId ||
              client.userId === activeBattle.player4UserId;
            if (!normalizedTarget && client.userId === activeBattle.opponentUserId) {
              normalizedTarget = "opponent";
            }
            if (!normalizedTarget && client.userId === activeBattle.hostUserId) {
              normalizedTarget = "host";
            }
            if (!normalizedTarget && activeBattle.player3UserId && client.userId === activeBattle.player3UserId) {
              normalizedTarget = "player3";
            }
            if (!normalizedTarget && activeBattle.player4UserId && client.userId === activeBattle.player4UserId) {
              normalizedTarget = "player4";
            }
            // Spectators / ambiguous: credit only the room that matches host vs opponent — never dump everything on one side.
            if (!normalizedTarget) {
              if (
                activeBattle.opponentRoomId &&
                client.roomId === activeBattle.opponentRoomId
              ) {
                normalizedTarget = "opponent";
              } else if (client.roomId === activeBattle.hostRoomId) {
                normalizedTarget = "host";
              } else {
                normalizedTarget = null;
              }
            }
            // #region agent log
            fetch('http://127.0.0.1:7765/ingest/504ee8d9-85af-4146-9e87-ee22d4845d37',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d3b772'},body:JSON.stringify({sessionId:'d3b772',runId:'run-current',hypothesisId:'H2',location:'server/index.ts:gift_sent',message:'server normalized battle target',data:{giftId:giftIdRaw,rawBattleTarget:data.battleTarget ?? null,normalizedTarget,serverGiftValue,clientRoomId:client.roomId,battleRoomId},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            if (normalizedTarget) {
              addBattleScoreForTarget(battleRoomId, normalizedTarget, serverGiftValue);
            }
          }
        }
        break;
      }

      // ═══ BATTLE EVENTS — server-controlled ═══
      case "battle_create": {
        const existing = battles.get(client.roomId);
        if (existing) {
          if (existing.timer) clearInterval(existing.timer);
          userBattleRoom.delete(existing.hostUserId);
          userBattleRoom.delete(existing.opponentUserId);
          if (isPostgresConfigured()) {
            void dbDeleteBattleBuckets(client.roomId).catch((err) =>
              logger.error({ err, roomId: client.roomId }, "dbDeleteBattleBuckets on battle_create replace failed"),
            );
          }
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
        let opponentRoomId =
          typeof data.opponentRoomId === "string" ? data.opponentRoomId : "";
        if (!opponentRoomId && opponentUserId) {
          for (const [, c] of clients) {
            if (c.userId === opponentUserId && c.roomId && c.roomId !== client.roomId) {
              opponentRoomId = c.roomId;
              break;
            }
          }
        }
        if (opponentUserId && opponentName) {
          session.opponentUserId = opponentUserId;
          session.opponentName = opponentName;
          session.opponentRoomId = opponentRoomId;
          if (opponentUserId) userBattleRoom.set(opponentUserId, client.roomId);
          if (isPostgresConfigured()) {
            void dbEnsureBattleCreatorBuckets(battleSessionToScoreCtx(session)).catch((err) =>
              logger.error({ err }, "dbEnsureBattleCreatorBuckets after opponent prefilled failed"),
            );
            void dbSyncBattleCreatorSlot(session.hostRoomId, "opponent", opponentUserId);
          }
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
        /** Battles live under the host's `hostRoomId` key — never `battles.get(opponentStreamRoomId)`. */
        let session = resolveBattleSessionForRoom(client.roomId);
        if (!session) {
          const hostRoom = userBattleRoom.get(client.userId);
          if (hostRoom) session = battles.get(hostRoom) ?? null;
        }
        if (!session || session.status === "ENDED") {
          sendToClient(client, "battle_error", {
            message: "No battle to join",
          });
          break;
        }
        const battleSession = joinBattle(
          session.hostRoomId,
          client.userId,
          data.opponentName || client.displayName,
        );
        if (!battleSession) {
          sendToClient(client, "battle_error", {
            message: "No battle to join",
          });
          break;
        }
        if (process.env.NODE_ENV !== "production") {
          const s = battleSession;
          console.log("BATTLE STATE:", {
            battleId: s.id,
            room: s.hostRoomId,
            players: {
              A1: s.hostScore,
              A2: s.player3Score,
              B1: s.opponentScore,
              B2: s.player4Score,
            },
          });
        }
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

      /** Client intent only: team A or B — server applies base × multiplier to both players on that side. */
      case "battle:tap": {
        const battleRoom = resolveActiveBattleRoomId(client.roomId, client.userId);
        if (!battleRoom) break;
        const b = battles.get(battleRoom);
        if (!b || b.status !== "ACTIVE") break;
        if (!allowBattleSpectatorTapScore(client.userId, battleRoom, 5)) break;
        const team = String(data?.team ?? "").toUpperCase();
        if (team !== "A" && team !== "B") break;
        const side = team === "A" ? "red" : "blue";
        const mult = Math.max(1, team === "A" ? b.teamRedMultiplier : b.teamBlueMultiplier);
        const pointsPerPlayer = Math.round(5 * mult);
        addBattleScoreForTeamSide(battleRoom, side, pointsPerPlayer);
        sendToClient(client, "battle_vote_ack", {
          side: team === "A" ? "red" : "blue",
          team,
          pointsPerPlayer,
          basePoints: 5,
          multiplier: mult,
        });
        break;
      }

      case "battle_spectator_vote": {
        const voteRoom = resolveActiveBattleRoomId(client.roomId, client.userId);
        const voteBattle = voteRoom ? battles.get(voteRoom) : undefined;
        if (!voteBattle || voteBattle.status !== "ACTIVE") break;
        if (!allowBattleSpectatorTapScore(client.userId, voteRoom, 5)) break;
        const team = normalizeSpectatorVoteTeam(data.target);
        if (!team) break;
        const mult = Math.max(
          1,
          team === "red" ? voteBattle.teamRedMultiplier : voteBattle.teamBlueMultiplier,
        );
        const base = 5;
        const pointsPerPlayer = Math.round(base * mult);
        addBattleScoreForTeamSide(voteRoom, team, pointsPerPlayer);
        sendToClient(client, "battle_vote_ack", {
          side: team,
          pointsPerPlayer,
          basePoints: base,
          multiplier: mult,
        });
        break;
      }

      case "battle_end": {
        // Host manually ends battle (works when WS roomId is host or opponent stream key)
        const bSession = resolveBattleSessionForRoom(client.roomId);
        if (bSession && bSession.hostUserId === client.userId) {
          endBattle(bSession.hostRoomId);
        }
        break;
      }

      case "battle_get_state": {
        const currentBattle = resolveBattleSessionForRoom(client.roomId);
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
            hostRoomId: currentBattle.hostRoomId,
            hostUserId: currentBattle.hostUserId,
            hostName: currentBattle.hostName,
            opponentUserId: currentBattle.opponentUserId,
            opponentName: currentBattle.opponentName,
            opponentRoomId: currentBattle.opponentRoomId,
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
            hostReady: currentBattle.hostReady,
            opponentReady: currentBattle.opponentReady,
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

      case "live_share_send": {
        if (!wsRateCheck(client.userId, "live_share_send", 60, 60_000)) break;
        const targetUserId =
          typeof data.targetUserId === "string" ? data.targetUserId.trim() : "";
        const streamKeyRaw =
          typeof data.streamKey === "string" && data.streamKey.trim()
            ? data.streamKey.trim()
            : client.roomId;
        const hostUserId =
          typeof data.hostUserId === "string" ? data.hostUserId.trim() : "";
        void executeLiveShareSend({
          sharerId: client.userId,
          sharerName:
            (typeof data.sharerName === "string" && data.sharerName) ||
            client.displayName ||
            client.username ||
            "Someone",
          sharerAvatar:
            (typeof data.sharerAvatar === "string" && data.sharerAvatar) ||
            client.avatarUrl ||
            "",
          targetUserId,
          streamKey: streamKeyRaw,
          hostUserId,
          hostName: typeof data.hostName === "string" ? data.hostName : "",
          hostAvatar: typeof data.hostAvatar === "string" ? data.hostAvatar : "",
        }).then((r) => {
          sendToClient(client, "live_share_ack", {
            ok: r.ok,
            persisted: r.persisted,
          });
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

      /** Host-only: spawn a catchable booster (multiplier is server-controlled). */
      case "booster:spawn": {
        if (!wsRateCheck(client.userId, "booster_spawn", 8, 60_000)) break;
        const battleRoom = resolveActiveBattleRoomId(client.roomId, client.userId);
        const s = battleRoom ? battles.get(battleRoom) : undefined;
        if (!s || s.status !== "ACTIVE" || s.hostUserId !== client.userId) break;
        const team = String(data?.team ?? "").toUpperCase();
        if (team !== "A" && team !== "B") break;
        const multiplier = Math.min(10, Math.max(2, Math.floor(Number(data?.multiplier)) || 5));
        const duration = Math.min(60000, Math.max(2000, Math.floor(Number(data?.duration)) || 8000));
        pendingBoosterByRoom.set(battleRoom, {
          team: team as "A" | "B",
          multiplier,
          expiresAt: Date.now() + duration,
        });
        const payload = { team, multiplier, duration };
        broadcastToRoom(battleRoom, "booster:spawn", payload);
        broadcastToBattleParticipants(battleRoom, s, "booster:spawn", payload);
        break;
      }

      /** Client sends team only — multiplier applied from pending server spawn. */
      case "booster:catch": {
        if (!wsRateCheck(client.userId, "booster_catch", 12, 5_000)) break;
        const battleRoom = resolveActiveBattleRoomId(client.roomId, client.userId);
        if (!battleRoom) break;
        const s = battles.get(battleRoom);
        if (!s || s.status !== "ACTIVE") break;
        const pending = pendingBoosterByRoom.get(battleRoom);
        if (!pending || Date.now() > pending.expiresAt) {
          pendingBoosterByRoom.delete(battleRoom);
          break;
        }
        const team = String(data?.team ?? "").toUpperCase();
        if (team !== pending.team) break;
        const mult = pending.multiplier;
        const durationMs = 8000;
        if (team === "A") s.teamRedMultiplier = mult;
        else s.teamBlueMultiplier = mult;
        pendingBoosterByRoom.delete(battleRoom);
        setTimeout(() => {
          const s2 = battles.get(battleRoom);
          if (!s2 || s2.status !== "ACTIVE") return;
          if (team === "A") s2.teamRedMultiplier = 1;
          else s2.teamBlueMultiplier = 1;
        }, durationMs);
        const ack = { team, multiplier: mult, duration: durationMs };
        broadcastToRoom(battleRoom, "booster:activated", ack);
        broadcastToBattleParticipants(battleRoom, s, "booster:activated", ack);
        break;
      }

      case "booster_activated": {
        const b = battles.get(client.roomId);
        if (b && b.status === "ACTIVE" && b.hostUserId === client.userId) {
          const team = String(data?.team ?? "").toLowerCase();
          const m = Number(data?.multiplier);
          const cap = (x: number) => Math.min(10, Math.max(1, x));
          if (
            (team === "red" || team === "a" || team === "left") &&
            Number.isFinite(m) &&
            m >= 1
          ) {
            b.teamRedMultiplier = cap(m);
          }
          if (
            (team === "blue" || team === "b" || team === "right") &&
            Number.isFinite(m) &&
            m >= 1
          ) {
            b.teamBlueMultiplier = cap(m);
          }
        }
        broadcastToRoom(client.roomId, "booster_activated", {
          ...data,
          user_id: client.userId,
        });
        break;
      }

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

setLiveShareNotifier(sendToUserGlobal);

 
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

    const { loadFollowsFromDb } = await import("./routes/profiles");
    await loadFollowsFromDb();
    logger.info("Follows loaded from database");

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
