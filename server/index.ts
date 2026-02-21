import './config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createCheckoutSession, createPaymentIntent } from './routes/checkout';
import { handleStripeWebhook } from './routes/webhook';
import {
  handleAnalytics,
  handleBlockUser,
  handleDeleteAccount,
  handleReport,
  handleSendNotification,
  handleVerifyPurchase
} from './routes/misc';
import {
  handleForYouFeed,
  handleTrackView,
  handleTrackInteraction,
  handleGetVideoScore,
} from './routes/feed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());

// Webhook needs raw body
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Other routes use JSON
app.use(express.json());

// Health check endpoint (must be before static files)
app.get('/health', (_req, res) => {
  try {
    console.log('Health check requested');
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
app.post('/api/create-payment-intent', createPaymentIntent);
app.post('/api/analytics', handleAnalytics);
app.post('/api/block-user', handleBlockUser);
app.post('/api/delete-account', handleDeleteAccount);
app.post('/api/report', handleReport);
app.post('/api/send-notification', handleSendNotification);
app.post('/api/verify-purchase', handleVerifyPurchase);

// Feed & Recommendation API
app.get('/api/feed/foryou', handleForYouFeed);
app.post('/api/feed/track-view', handleTrackView);
app.post('/api/feed/track-interaction', handleTrackInteraction);
app.get('/api/feed/score/:videoId', handleGetVideoScore);

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

app.use(express.static(distPath));

// Fallback for SPA - all non-API routes serve index.html
app.get(/.*/, (req, res) => {
  console.log(`Serving fallback for ${req.url}`);
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
  timeLeft: number;       // seconds remaining
  status: 'WAITING' | 'COUNTDOWN' | 'ACTIVE' | 'ENDED';
  winner: 'host' | 'opponent' | 'draw' | null;
  timer: ReturnType<typeof setInterval> | null;
  createdAt: number;
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
    timeLeft: 300, // 5 minutes
    status: 'WAITING',
    winner: null,
    timer: null,
    createdAt: Date.now(),
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
  session.status = 'COUNTDOWN';
  userBattleRoom.set(opponentUserId, roomId);

  // Broadcast countdown (3, 2, 1) then start
  broadcastBattleState(roomId, session);

  let countdown = 3;
  const countdownTimer = setInterval(() => {
    countdown--;
    broadcastToRoom(roomId, 'battle_countdown', { count: countdown });
    if (countdown <= 0) {
      clearInterval(countdownTimer);
      startBattleTimer(roomId);
    }
  }, 1000);

  return session;
}

function startBattleTimer(roomId: string) {
  const session = battles.get(roomId);
  if (!session) return;
  session.status = 'ACTIVE';
  broadcastBattleState(roomId, session);

  session.timer = setInterval(() => {
    const s = battles.get(roomId);
    if (!s || s.status !== 'ACTIVE') {
      if (s?.timer) clearInterval(s.timer);
      return;
    }
    s.timeLeft--;

    // Broadcast time update every second
    broadcastToRoom(roomId, 'battle_tick', {
      timeLeft: s.timeLeft,
      hostScore: s.hostScore,
      opponentScore: s.opponentScore,
    });

    if (s.timeLeft <= 0) {
      endBattle(roomId);
    }
  }, 1000);
}

function addBattleScore(roomId: string, scorerUserId: string, points: number) {
  const session = battles.get(roomId);
  if (!session || session.status !== 'ACTIVE') return;

  if (scorerUserId === session.hostUserId || scorerUserId !== session.opponentUserId) {
    // Gift sent TO host (viewer supporting host) or host's own side
    session.hostScore += points;
  } else {
    session.opponentScore += points;
  }

  broadcastToRoom(roomId, 'battle_score', {
    hostScore: session.hostScore,
    opponentScore: session.opponentScore,
    lastScorer: scorerUserId === session.hostUserId ? 'host' : 'opponent',
    points,
  });
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
    winner: session.winner,
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

    // Send welcome + full room state with all current viewers
    const roomClients = rooms.get(roomId)!;
    const viewers = Array.from(roomClients).map(c => ({
      user_id: c.userId,
      username: c.username,
      display_name: c.displayName,
      avatar_url: c.avatarUrl,
      level: c.level,
      country: c.country,
    }));

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

        broadcastToRoom(client.roomId, 'user_left', {
          user_id: client.userId,
          username: client.username,
          avatar_url: client.avatarUrl,
        });

        updateViewerCount(client.roomId).catch(() => {});

        if (room.size === 0) {
          rooms.delete(client.roomId);
        }
      }

      clients.delete(ws);
    } catch (err) {
      console.error('Error in close handler:', err);
    }
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleMessage(client: Client, event: string, data: any) {
  if (!data) data = {};
  
  try {
    switch (event) {
      case 'chat_message':
        broadcastToRoom(client.roomId, 'chat_message', {
          ...data,
          user_id: client.userId,
          username: client.username,
          timestamp: new Date().toISOString(),
        });
        break;

      case 'gift_sent': {
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

        // Auto-score gifts in active battles
        const activeBattle = battles.get(client.roomId);
        if (activeBattle && activeBattle.status === 'ACTIVE') {
          const giftCoins = typeof data.coins === 'number' ? data.coins : 0;
          if (giftCoins > 0) {
            const giftTarget = data.battleTarget as string | undefined;
            if (giftTarget === 'opponent') {
              addBattleScoreForTarget(client.roomId, 'opponent', giftCoins);
            } else {
              addBattleScoreForTarget(client.roomId, 'host', giftCoins);
            }
          }
        }
        break;
      }

      // ═══ BATTLE EVENTS — server-controlled ═══
      case 'battle_create': {
        // Host creates a battle session
        const existing = battles.get(client.roomId);
        if (existing && existing.status !== 'ENDED') {
          sendToClient(client, 'battle_error', { message: 'Battle already active' });
          break;
        }
        const session = createBattle(client.roomId, client.userId, data.hostName || client.displayName);
        sendToClient(client, 'battle_created', {
          battleId: session.id,
          status: session.status,
        });
        broadcastBattleState(client.roomId, session);
        break;
      }

      case 'battle_join': {
        // Opponent joins the battle
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
        // When a gift is sent during battle, frontend tells server which side to score
        const bRoom = userBattleRoom.get(client.userId) || client.roomId;
        const target = data.target as 'host' | 'opponent';
        const points = typeof data.points === 'number' ? data.points : 0;
        if (target && points > 0) {
          addBattleScoreForTarget(bRoom, target, points);
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
        // Client requests current battle state (e.g. on reconnect)
        const currentBattle = battles.get(client.roomId);
        if (currentBattle) {
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
            winner: currentBattle.winner,
          });
        }
        break;
      }

      case 'battle_score_update':
        broadcastToRoom(client.roomId, 'battle_score_update', data);
        break;

      case 'booster_activated':
        broadcastToRoom(client.roomId, 'booster_activated', {
          ...data,
          user_id: client.userId,
        });
        break;

      case 'battle_invite': {
        const targetRoom = data.challenger_stream_id;
        if (targetRoom) broadcastToRoom(targetRoom, 'battle_invite', data);
        break;
      }

      case 'battle_accepted':
      case 'battle_declined': {
        const hostRoom = data.host_stream_id;
        if (hostRoom) broadcastToRoom(hostRoom, event, data);
        break;
      }

      case 'rtc_join': {
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
    const count = room ? room.size : 0;
    await supabaseAdmin
      .from('live_streams')
      .update({ viewer_count: count })
      .eq('stream_key', roomId);
  } catch (error) {
    console.error('Failed to update viewer count:', error);
  }
}

// Start server
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
