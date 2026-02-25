import './config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createCheckoutSession, createPaymentIntent, createPromoteCheckoutSession, createSubscriptionSession } from './routes/checkout';
import { handleStripeWebhook } from './routes/webhook';
import {
  handleAnalytics,
  handleBlockUser,
  handleDeleteAccount,
  handleReport,
  handleSendNotification,
  handleVerifyPurchase,
  handlePromoteIAPComplete,
} from './routes/misc';
import {
  handleForYouFeed,
  handleTrackView,
  handleTrackInteraction,
  handleGetVideoScore,
} from './routes/feed';
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
} from './routes/payout';
import { handleLiveModerationCheck } from './routes/moderation';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(compression());

// Webhook needs raw body
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Other routes use JSON
app.use(express.json());

// Health check endpoint (must be before static files)
app.get('/health', (_req, res) => {
  try {
    if (process.env.NODE_ENV !== 'production') console.log('Health check requested');
    res.status(200).json({ 
      status: 'ok', 
      uptime: process.uptime(), 
      timestamp: new Date().toISOString(),
      port: PORT
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

// API Routes
app.post('/api/create-checkout-session', createCheckoutSession);
app.post('/api/create-promote-checkout', createPromoteCheckoutSession);
app.post('/api/create-payment-intent', createPaymentIntent);
app.post('/api/create-subscription', createSubscriptionSession);
app.post('/api/analytics', handleAnalytics);
app.post('/api/block-user', handleBlockUser);
app.post('/api/delete-account', handleDeleteAccount);
app.post('/api/report', handleReport);
app.post('/api/live/moderation/check', handleLiveModerationCheck);
app.post('/api/send-notification', handleSendNotification);
app.post('/api/verify-purchase', handleVerifyPurchase);
app.post('/api/promote-iap-complete', handlePromoteIAPComplete);

// Feed & Recommendation API
app.get('/api/feed/foryou', handleForYouFeed);
app.post('/api/feed/track-view', handleTrackView);
app.post('/api/feed/track-interaction', handleTrackInteraction);
app.get('/api/feed/score/:videoId', handleGetVideoScore);

// No-refund enforcement: block any coin refund/restore/reverse attempts
app.post('/api/refund', (_req, res) => res.status(403).json({ error: 'All coin purchases are final and non-refundable.' }));
app.post('/api/restore-coins', (_req, res) => res.status(403).json({ error: 'All coin purchases are final and non-refundable.' }));
app.post('/api/reverse-gift', (_req, res) => res.status(403).json({ error: 'Gifts are final and cannot be reversed.' }));
app.post('/api/cancel-purchase', (_req, res) => res.status(403).json({ error: 'All coin purchases are final and non-refundable.' }));

// Creator Payout API
app.get('/api/creator/balance', handleGetCreatorBalance);
app.get('/api/creator/earnings', handleGetCreatorEarnings);
app.post('/api/creator/withdraw', handleCreatorWithdraw);
app.get('/api/creator/payouts', handleGetCreatorPayouts);
app.post('/api/creator/payout-method', handleSetPayoutMethod);
app.get('/api/creator/payout-methods', handleGetPayoutMethods);

// Admin Payout API
app.get('/api/admin/payouts', handleAdminListPayouts);
app.post('/api/admin/payout/:id/approve', handleAdminApprovePayout);
app.post('/api/admin/payout/:id/reject', handleAdminRejectPayout);
app.post('/api/admin/chargeback', handleAdminChargeback);

// Admin Account Management
app.post('/api/admin/unfreeze/:userId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.slice(7);
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const { createClient } = await import('@supabase/supabase-js');
    const adminClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await adminClient.rpc('admin_unfreeze_account', {
      p_user_id: req.params.userId,
      p_note: req.body.note || null,
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Unfreeze failed' });
  }
});

// Shop Item Purchase & Refund API
app.post('/api/shop/buy', handleShopBuy);
app.post('/api/shop/refund', handleShopRefund);
app.get('/api/shop/purchases', handleShopPurchases);

// Runtime env.js endpoint for VITE_ variables
app.get('/env.js', (_req, res) => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('VITE_')) continue;
    if (typeof v !== 'string') continue;
    env[k] = v;
  }
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send('window.__ENV = Object.assign({}, window.__ENV || {}, ' + JSON.stringify(env) + ');');
});

// Serve static files from dist
const distPath = join(__dirname, '..', 'dist');
const indexPath = join(distPath, 'index.html');

// Log dist path on startup for debugging
console.log(`Serving static files from: ${distPath}`);
console.log(`Index path: ${indexPath}`);

import fs from 'fs';
if (!fs.existsSync(indexPath)) {
  console.error(`ERROR: index.html not found at ${indexPath}`);
  console.error('Available files:', fs.existsSync(distPath) ? fs.readdirSync(distPath).join(', ') : 'dist folder missing');
} else {
  console.log('index.html found successfully. Content preview:', fs.readFileSync(indexPath, 'utf8').substring(0, 200));
}

app.use(express.static(distPath, {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
}));

// Fallback for SPA - all non-API routes serve index.html
app.get(/.*/, (req, res) => {
  if (process.env.NODE_ENV !== 'production') console.log(`Serving fallback for ${req.url}`);
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Return 200 so deployment succeeds and we can debug
    res.status(200).send('<h1>App build not found</h1><p>dist/index.html is missing. Check build logs.</p>');
  }
});

// WebSocket Server
// We attach it to the same HTTP server to share the port 3000
const wss = new WebSocketServer({ server });

console.log(`WebSocket server attached to HTTP server on port ${PORT}`);

// --- WebSocket Logic (Copied from websocket-server.ts) ---

let supabaseAdmin: ReturnType<typeof createClient> | null = null;
try {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseServiceRoleKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    console.log('Supabase client initialized successfully');
  } else {
    console.log('SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set, running without authentication');
  }
} catch (e) {
  console.error("Supabase init failed, running without authentication:", e);
  console.log('Server will continue but WebSocket authentication will be disabled');
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
  s_rose: 1, s_heart: 5, s_coffee: 15, s_diamond: 300, s_crown: 1500,
  s_panda: 10, s_butterfly: 25, s_cat: 50, s_dog: 100, s_sun: 250,
  s_rainbow: 500, s_unicorn: 1000, global_universe: 1000000,
  horse_gallop: 5000, rex_dino: 12000, treasure_chest: 15000, war_bird: 15000,
  kitty_treasure: 17000, frost_wolf: 18000, voyager_ship: 19000, fiery_lion: 21000,
  night_panther: 22000, titan_gorilla: 23000, misty_wolf: 25000, cosmic_panther: 26000,
  star_wand: 28000, beast_relic: 31000, crystal_rhino: 32000, storm_phoenix: 34000,
  ice_sorceress: 37000, fire_phoenix: 38000, lavarok: 40000, blazing_wizard: 42000,
  aelyra_flameveil: 45000, golden_lion: 46000, dragon_egg: 49000, lava_demon: 52000,
  dragon_wrath: 55000, flames_royalty: 55000, fire_unicorn: 55000, thunder_falcon: 58000,
  infernal_lion: 60000, fantasy_unicorn: 61000, sky_guardian: 64000, majestic_bird: 65000,
  flame_king: 65000, majestic_phoenix: 70000, molten_fury: 75000, universe: 80000,
  lava_rampage: 80000, guardian_chest: 85000, storm_warrior: 85000, pink_jet: 88000,
  frost_lion: 90000, night_owl: 90000, drake_cub: 95000, romantic_jet: 99000,
  guardian_vault: 100000, elix_gold_universe: 120000, lightning_hypercar: 150000,
};

function getGiftValue(giftId: string): number {
  return GIFT_VALUES[giftId] || 0;
}

function normalizeBattleTarget(rawTarget: unknown): 'host' | 'opponent' | null {
  if (rawTarget === 'host' || rawTarget === 'opponent') return rawTarget;
  if (rawTarget === 'me') return 'host';
  if (rawTarget === 'player4') return 'opponent';
  if (rawTarget === 'player3') return 'host';
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
  hostScore: number;
  opponentScore: number;
  endsAt: number;         // Unix timestamp (ms) when battle ends
  timeLeft: number;       // computed from endsAt for convenience
  status: 'WAITING' | 'COUNTDOWN' | 'ACTIVE' | 'ENDED';
  winner: 'host' | 'opponent' | 'draw' | null;
  timer: ReturnType<typeof setInterval> | null;
  createdAt: number;
  hostReady: boolean;
  opponentReady: boolean;
}

const battles = new Map<string, BattleSession>();     // roomId -> BattleSession
const userBattleRoom = new Map<string, string>();      // userId -> roomId (which battle they're in)

function createBattle(hostRoomId: string, hostUserId: string, hostName: string): BattleSession {
  const session: BattleSession = {
    id: `battle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    hostRoomId,
    hostUserId,
    hostName,
    opponentUserId: '',
    opponentName: '',
    hostScore: 0,
    opponentScore: 0,
    endsAt: 0,
    timeLeft: 300,
    status: 'WAITING',
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

function joinBattle(roomId: string, opponentUserId: string, opponentName: string): BattleSession | null {
  const session = battles.get(roomId);
  if (!session || session.status !== 'WAITING') return null;
  session.opponentUserId = opponentUserId;
  session.opponentName = opponentName;
  userBattleRoom.set(opponentUserId, roomId);

  broadcastBattleState(roomId, session);
  return session;
}

function startBattleTimer(roomId: string) {
  const session = battles.get(roomId);
  if (!session) return;
  session.status = 'ACTIVE';
  session.endsAt = Date.now() + 300 * 1000; // 5 minutes from now
  session.timeLeft = 300;
  broadcastBattleState(roomId, session);

  session.timer = setInterval(() => {
    const s = battles.get(roomId);
    if (!s || s.status !== 'ACTIVE') {
      if (s?.timer) clearInterval(s.timer);
      return;
    }
    s.timeLeft = Math.max(0, Math.round((s.endsAt - Date.now()) / 1000));

    broadcastToRoom(roomId, 'battle_tick', {
      timeLeft: s.timeLeft,
      hostScore: s.hostScore,
      opponentScore: s.opponentScore,
      endsAt: s.endsAt,
    });

    if (s.timeLeft <= 0) {
      endBattle(roomId);
    }
  }, 1000);
}

function addBattleScoreForTarget(roomId: string, target: 'host' | 'opponent', points: number) {
  const session = battles.get(roomId);
  if (!session || session.status !== 'ACTIVE') return;

  if (target === 'host') {
    session.hostScore += points;
  } else {
    session.opponentScore += points;
  }

  broadcastToRoom(roomId, 'battle_score', {
    hostScore: session.hostScore,
    opponentScore: session.opponentScore,
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

  session.status = 'ENDED';
  if (session.hostScore > session.opponentScore) {
    session.winner = 'host';
  } else if (session.opponentScore > session.hostScore) {
    session.winner = 'opponent';
  } else {
    session.winner = 'draw';
  }

  broadcastToRoom(roomId, 'battle_ended', {
    hostScore: session.hostScore,
    opponentScore: session.opponentScore,
    winner: session.winner,
    hostName: session.hostName,
    opponentName: session.opponentName,
  });

  // Cleanup after 10 seconds
  setTimeout(() => {
    const s = battles.get(roomId);
    if (s) {
      userBattleRoom.delete(s.hostUserId);
      userBattleRoom.delete(s.opponentUserId);
      battles.delete(roomId);
    }
  }, 10000);
}

function broadcastBattleState(roomId: string, session: BattleSession) {
  if (session.endsAt > 0) {
    session.timeLeft = Math.max(0, Math.round((session.endsAt - Date.now()) / 1000));
  }
  broadcastToRoom(roomId, 'battle_state_sync', {
    id: session.id,
    status: session.status,
    hostUserId: session.hostUserId,
    hostName: session.hostName,
    opponentUserId: session.opponentUserId,
    opponentName: session.opponentName,
    hostScore: session.hostScore,
    opponentScore: session.opponentScore,
    timeLeft: session.timeLeft,
    endsAt: session.endsAt,
    winner: session.winner,
    hostReady: session.hostReady,
    opponentReady: session.opponentReady,
  });
}

wss.on('connection', async (ws: WebSocket, req) => {
  let client: Client | null = null;

  try {
    console.log('New connection');

    if (!req.url) {
      ws.close(1008, 'Missing URL');
      return;
    }

    // Parse room and token from URL
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let roomId = url.searchParams.get('room');
    const token = url.searchParams.get('token');

    // If room not in query, try from pathname (e.g., /live/roomId)
    if (!roomId && url.pathname.startsWith('/live/')) {
      roomId = url.pathname.split('/')[2]; // /live/roomId -> roomId
    }

    if (!supabaseAdmin) {
      console.log('WebSocket authentication not available, closing connection');
      ws.close(1008, 'Authentication not available');
      return;
    }

    // Authentication required
    if (!roomId || !token) {
      ws.close(1008, 'Missing room or token');
      return;
    }

    // Decode JWT to get user ID
    let userId: string;
    try {
      const parts = token.split('.');
      if (parts.length < 2) throw new Error('Malformed token');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      userId = payload.sub;
      if (!userId) throw new Error('No sub in token');
    } catch (e) {
      console.error('Token decode failed:', e);
      ws.close(1008, 'Invalid token');
      return;
    }

    // Verify user exists using admin API
    const { data: userData, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !userData) {
      ws.close(1008, 'Invalid token');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userObj = (userData as any)?.user ?? userData;

    // Get username, avatar, display_name, level, country from profile
    let username = userObj?.user_metadata?.username || 'Anonymous';
    let displayName = '';
    let avatarUrl = '';
    let level = 1;
    let country = '';
    if (supabaseAdmin) {
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('username, display_name, avatar_url, level')
          .eq('user_id', userObj?.id ?? userId)
          .single();
        if (profile?.username) username = profile.username;
        if (profile?.display_name) displayName = profile.display_name;
        if (profile?.avatar_url) avatarUrl = profile.avatar_url;
        if (profile?.level) level = profile.level;
      } catch { /* ignore */ }
    }

    client = {
      ws,
      userId: userObj?.id ?? userId,
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
    const viewers: { user_id: string; username: string; display_name: string; avatar_url: string; level: number; country: string }[] = [];
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

    sendToClient(client, 'connected', {
      room_id: roomId,
      user_count: roomClients.size,
    });

    sendToClient(client, 'room_state', {
      viewers,
    });

    // Broadcast user joined
    broadcastToRoom(roomId, 'user_joined', {
      user_id: client.userId,
      username: client.username,
      display_name: client.displayName,
      avatar_url: client.avatarUrl,
      level: client.level,
      country: client.country,
    }, client);

    // Update viewer count
    await updateViewerCount(roomId);

    // If there's an active battle in this room, send state to new joiner
    const activeBattleOnJoin = battles.get(roomId);
    if (activeBattleOnJoin && activeBattleOnJoin.status !== 'ENDED') {
      if (activeBattleOnJoin.endsAt > 0) {
        activeBattleOnJoin.timeLeft = Math.max(0, Math.round((activeBattleOnJoin.endsAt - Date.now()) / 1000));
      }
      sendToClient(client, 'battle_state_sync', {
        id: activeBattleOnJoin.id,
        status: activeBattleOnJoin.status,
        hostUserId: activeBattleOnJoin.hostUserId,
        hostName: activeBattleOnJoin.hostName,
        opponentUserId: activeBattleOnJoin.opponentUserId,
        opponentName: activeBattleOnJoin.opponentName,
        hostScore: activeBattleOnJoin.hostScore,
        opponentScore: activeBattleOnJoin.opponentScore,
        timeLeft: activeBattleOnJoin.timeLeft,
        endsAt: activeBattleOnJoin.endsAt,
        winner: activeBattleOnJoin.winner,
      });
    }

  } catch (error) {
    console.error('Connection setup error:', error);
    ws.close(1011, 'Server error');
    return;
  }

  // Add error handler
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Handle messages
  ws.on('message', async (data) => {
    aliveClients.add(ws);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return;
      }
      const { event, data: eventData } = parsed;
      
      if (process.env.NODE_ENV !== 'production') console.log('Received message:', event, eventData);

      // Dev-only: allow unauthenticated join for local testing
      if (process.env.NODE_ENV !== 'production' && event === 'join_room' && eventData && eventData.skipAuth) {
        const { roomId, userId, username } = eventData;
        
        client = {
          ws,
          userId,
          roomId,
          username,
          displayName: username,
          avatarUrl: '',
          level: 1,
          country: '',
          connectedAt: new Date(),
        };
        
        clients.set(ws, client);
        
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId)!.add(client);
        
        sendToClient(client, 'room_joined', {
          roomId,
          userId,
          username
        });
        
        return;
      }

      if (!client) {
        console.error('Message from unauthenticated client');
        return;
      }

      await handleMessage(client, event, eventData);
    } catch (error) {
      console.error('Failed to handle message:', error);
      try {
        if (client) {
          sendToClient(client, 'error', { message: 'Invalid message format' });
        }
      } catch { /* prevent double-throw */ }
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    console.log('Client disconnected');
    
    if (!client) return;

    try {
      const room = rooms.get(client.roomId);
      if (room) {
        room.delete(client);

        // Broadcast user_left AND rtc_leave so WebRTC peers clean up
        broadcastToRoom(client.roomId, 'user_left', {
          user_id: client.userId,
          username: client.username,
          avatar_url: client.avatarUrl,
        });
        broadcastToRoom(client.roomId, 'rtc_leave', {
          user_id: client.userId,
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
        if (battle && battle.status !== 'ENDED') {
          const isHost = battle.hostUserId === client.userId;
          const isOpponent = battle.opponentUserId === client.userId;
          if (isHost || isOpponent) {
            console.log(`Battle participant ${isHost ? 'host' : 'opponent'} disconnected, ending battle in room ${battleRoomId}`);
            endBattle(battleRoomId);
          }
        }
      }

      clients.delete(ws);
    } catch (err) {
      console.error('Error in close handler:', err);
    }
  });
});

// When a user disconnects, check if they were the stream host and notify all viewers
async function checkAndBroadcastStreamEnd(roomId: string, userId: string) {
  if (!supabaseAdmin) return;
  try {
    const { data } = await supabaseAdmin
      .from('live_streams')
      .select('user_id, is_live')
      .eq('stream_key', roomId)
      .maybeSingle();
    if (data && data.user_id === userId && data.is_live) {
      await supabaseAdmin
        .from('live_streams')
        .update({ is_live: false, viewer_count: 0 })
        .eq('stream_key', roomId);
      broadcastToRoom(roomId, 'stream_ended', {
        stream_key: roomId,
        host_user_id: userId,
        reason: 'host_disconnected',
      });
    }
  } catch (err) {
    console.error('checkAndBroadcastStreamEnd error:', err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// WebSocket rate limiter: per-user per-event
const wsRateLimits = new Map<string, number[]>();
function wsRateCheck(userId: string, event: string, maxPerWindow: number, windowMs: number): boolean {
  const key = `${userId}:${event}`;
  const now = Date.now();
  const timestamps = (wsRateLimits.get(key) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxPerWindow) return false;
  timestamps.push(now);
  wsRateLimits.set(key, timestamps);
  return true;
}

async function handleMessage(client: Client, event: string, data: any) {
  if (!data) data = {};
  
  try {
    switch (event) {
      case 'chat_message':
        if (!wsRateCheck(client.userId, 'chat', 10, 10_000)) break; // max 10 msgs / 10s
        broadcastToRoom(client.roomId, 'chat_message', {
          ...data,
          user_id: client.userId,
          username: client.username,
          timestamp: new Date().toISOString(),
        });
        break;

      case 'gift_sent': {
        if (!wsRateCheck(client.userId, 'gift', 5, 5_000)) break; // max 5 gifts / 5s
        const { transactionId } = data;
        
        if (transactionId && processedTransactions.has(transactionId)) {
          sendToClient(client, 'gift_ack', {
            transactionId,
            status: 'duplicate',
            timestamp: processedTransactions.get(transactionId)
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
        
        broadcastToRoom(client.roomId, 'gift_sent', {
          ...data,
          user_id: client.userId,
          username: client.username,
          timestamp: new Date().toISOString(),
        });
        
        if (transactionId) {
          sendToClient(client, 'gift_ack', {
            transactionId,
            status: 'success',
            timestamp: now
          });
        }

        // Auto-score gifts in active battles — use server-side gift value, NOT client
        const activeBattle = battles.get(client.roomId);
        if (activeBattle && activeBattle.status === 'ACTIVE') {
          const serverGiftValue = getGiftValue(data.giftId);
          if (serverGiftValue > 0) {
            const normalizedTarget = normalizeBattleTarget(data.battleTarget);
            if (normalizedTarget) {
              addBattleScoreForTarget(client.roomId, normalizedTarget, serverGiftValue);
            } else {
              addBattleScoreForTarget(client.roomId, 'host', serverGiftValue);
            }
          }
        }
        break;
      }

      // ═══ BATTLE EVENTS — server-controlled ═══
      case 'battle_create': {
        const existing = battles.get(client.roomId);
        if (existing && existing.status !== 'ENDED') {
          sendToClient(client, 'battle_error', { message: 'Battle already active' });
          break;
        }
        const session = createBattle(client.roomId, client.userId, data.hostName || client.displayName);
        const opponentUserId = typeof data.opponentUserId === 'string' ? data.opponentUserId : '';
        const opponentName = typeof data.opponentName === 'string' ? data.opponentName : '';
        if (opponentUserId && opponentName) {
          session.opponentUserId = opponentUserId;
          session.opponentName = opponentName;
          if (opponentUserId) userBattleRoom.set(opponentUserId, client.roomId);
          startBattleTimer(client.roomId);
        } else {
          sendToClient(client, 'battle_created', {
            battleId: session.id,
            status: session.status,
          });
          broadcastBattleState(client.roomId, session);
        }
        break;
      }

      case 'battle_join': {
        const battleSession = joinBattle(
          client.roomId,
          client.userId,
          data.opponentName || client.displayName
        );
        if (!battleSession) {
          sendToClient(client, 'battle_error', { message: 'No battle to join' });
          break;
        }
        break;
      }

      

      case 'battle_gift_score': {
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

      case 'battle_end': {
        // Host manually ends battle
        const bSession = battles.get(client.roomId);
        if (bSession && bSession.hostUserId === client.userId) {
          endBattle(client.roomId);
        }
        break;
      }

      case 'battle_get_state': {
        const currentBattle = battles.get(client.roomId);
        if (currentBattle) {
          if (currentBattle.endsAt > 0) {
            currentBattle.timeLeft = Math.max(0, Math.round((currentBattle.endsAt - Date.now()) / 1000));
          }
          sendToClient(client, 'battle_state_sync', {
            id: currentBattle.id,
            status: currentBattle.status,
            hostUserId: currentBattle.hostUserId,
            hostName: currentBattle.hostName,
            opponentUserId: currentBattle.opponentUserId,
            opponentName: currentBattle.opponentName,
            hostScore: currentBattle.hostScore,
            opponentScore: currentBattle.opponentScore,
            timeLeft: currentBattle.timeLeft,
            endsAt: currentBattle.endsAt,
            winner: currentBattle.winner,
          });
        }
        break;
      }

      case 'stream_end': {
        if (supabaseAdmin) {
          try {
            await supabaseAdmin
              .from('live_streams')
              .update({ is_live: false, viewer_count: 0 })
              .eq('stream_key', client.roomId)
              .eq('user_id', client.userId);
          } catch {}
        }
        broadcastToRoom(client.roomId, 'stream_ended', {
          stream_key: client.roomId,
          host_user_id: client.userId,
          reason: 'host_ended',
        });
        break;
      }

      case 'booster_activated':
        broadcastToRoom(client.roomId, 'booster_activated', {
          ...data,
          user_id: client.userId,
        });
        break;

      case 'rtc_join': {
        const room = rooms.get(client.roomId);
        if (room && room.size > 15) {
          sendToClient(client, 'room_full', { message: 'Live is full. Try again later.' });
          break;
        }
        broadcastToRoom(client.roomId, 'rtc_join', {
          user_id: client.userId,
          username: client.username,
          avatar_url: client.avatarUrl,
        }, client);
        break;
      }

      case 'rtc_leave': {
        broadcastToRoom(client.roomId, 'rtc_leave', {
          user_id: client.userId,
        }, client);
        break;
      }

      case 'rtc_offer': {
        const offerTarget = data.target_user_id;
        if (offerTarget) {
          sendToUser(client.roomId, offerTarget, 'rtc_offer', {
            sdp: data.sdp,
            from_user_id: client.userId,
          });
        }
        break;
      }

      case 'rtc_answer': {
        const answerTarget = data.target_user_id;
        if (answerTarget) {
          sendToUser(client.roomId, answerTarget, 'rtc_answer', {
            sdp: data.sdp,
            from_user_id: client.userId,
          });
        }
        break;
      }

      case 'rtc_ice_candidate': {
        const iceTarget = data.target_user_id;
        if (iceTarget) {
          sendToUser(client.roomId, iceTarget, 'rtc_ice_candidate', {
            candidate: data.candidate,
            from_user_id: client.userId,
          });
        }
        break;
      }

      default:
        if (process.env.NODE_ENV !== 'production') console.log('Unknown event:', event);
    }
  } catch (err) {
    console.error(`Error handling event '${event}':`, err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendToClient(client: Client, event: string, data: any) {
  try {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString(),
      }));
    }
  } catch (error) {
    console.error('Failed to send to client:', error);
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
    console.error('Failed to serialize message:', error);
    return;
  }

  room.forEach(client => {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(message);
      } catch (error) {
        console.error('Failed to send to user:', error);
      }
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function broadcastToRoom(roomId: string, event: string, data: any, exclude?: Client) {
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
    console.error('Failed to serialize message:', error);
    return;
  }

  room.forEach(client => {
    if (client !== exclude && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(message);
      } catch (error) {
        console.error('Failed to send to client:', error);
      }
    }
  });
}

async function updateViewerCount(roomId: string) {
  try {
    if (!supabaseAdmin) return;
    const room = rooms.get(roomId);
    let count = 0;
    if (room) {
      for (const c of room) {
        // Don't count the host (stream_key === host user_id) as a viewer
        if (c.userId === roomId) continue;
        count++;
      }
    }
    await supabaseAdmin
      .from('live_streams')
      .update({ viewer_count: count })
      .eq('stream_key', roomId);
  } catch (error) {
    console.error('Failed to update viewer count:', error);
  }
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

wss.on('connection', (ws) => {
  aliveClients.add(ws);
  ws.on('pong', () => { aliveClients.add(ws); });
});

wss.on('close', () => { clearInterval(heartbeatTimer); });

// Stale stream cleanup: mark streams as offline if their host has no active WebSocket
// Uses updated_at to avoid killing streams that were recently created/updated
async function cleanupStaleStreams() {
  if (!supabaseAdmin) return;
  try {
    const { data: liveStreams } = await supabaseAdmin
      .from('live_streams')
      .select('stream_key, user_id, updated_at')
      .eq('is_live', true);
    if (!liveStreams || liveStreams.length === 0) return;

    const now = Date.now();

    for (const stream of liveStreams) {
      const room = rooms.get(stream.stream_key);
      const hostConnected = room
        ? Array.from(room).some(c => c.userId === stream.user_id)
        : false;

      if (!hostConnected) {
        // Don't clean up streams updated less than 90 seconds ago — host may be reconnecting
        const updatedAt = stream.updated_at ? new Date(stream.updated_at).getTime() : 0;
        if (now - updatedAt < 90_000) {
          console.log(`Skipping cleanup for fresh stream: ${stream.stream_key} (updated ${Math.round((now - updatedAt) / 1000)}s ago)`);
          continue;
        }

        console.log(`Cleaning up stale stream: ${stream.stream_key} (host ${stream.user_id} not connected, last updated ${Math.round((now - updatedAt) / 1000)}s ago)`);
        await supabaseAdmin
          .from('live_streams')
          .update({ is_live: false, viewer_count: 0 })
          .eq('stream_key', stream.stream_key);

        broadcastToRoom(stream.stream_key, 'stream_ended', {
          stream_key: stream.stream_key,
          host_user_id: stream.user_id,
          reason: 'stale_cleanup',
        });
      }
    }
  } catch (err) {
    console.error('Stale stream cleanup error:', err);
  }
}

// Run cleanup on start (after 60s to allow reconnections after deploy) and every 30 seconds
setTimeout(cleanupStaleStreams, 60_000);
const staleCleanupTimer = setInterval(cleanupStaleStreams, 30_000);
wss.on('close', () => { clearInterval(staleCleanupTimer); });

// Start server
console.log('Server build v3 — viewer count excludes host');
console.log('Starting server...');
console.log(`PORT: ${PORT}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

try {
  // Bind to 0.0.0.0 to work in all environments
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`âœ… Server running successfully on port ${PORT}`);
    console.log(`âœ… Health check available at: http://0.0.0.0:${PORT}/health`);
    console.log('âœ… Server startup completed');
  });
} catch (error) {
  console.error('âŒ Failed to start server:', error);
  process.exit(1);
}

// Prevent server crash on unhandled errors
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
