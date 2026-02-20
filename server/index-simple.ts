import './config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import { generateHostToken, generateViewerToken, isLiveKitConfigured } from './livekit';
import { runMigrations } from './migrate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;

// --- Supabase Admin Client ---
let supabaseAdmin: ReturnType<typeof createClient> | null = null;
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// --- Middleware ---
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());

// --- Auth helper ---
async function getUserFromAuth(authHeader: string | undefined) {
  if (!authHeader || !supabaseAdmin) return null;
  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const userId = payload.sub;
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const user = (data as any)?.user ?? data;
    return user ? { id: user.id, username: user.user_metadata?.username || 'Anonymous' } : null;
  } catch { return null; }
}

// --- Static files ---
const distPath = path.resolve(__dirname, '..', 'dist');
const indexPath = path.join(distPath, 'index.html');

if (!fs.existsSync(distPath) || !fs.existsSync(indexPath)) {
  console.error('dist folder or index.html not found');
  process.exit(1);
}

// --- Health ---
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    port: PORT,
    uptime: process.uptime(),
    livekit: isLiveKitConfigured(),
    webrtc_mode: isLiveKitConfigured() ? 'sfu' : 'p2p-fallback',
  });
});

// --- Environment injection ---
app.get('/env.js', (_req, res) => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('VITE_')) continue;
    if (typeof v !== 'string') continue;
    env[k] = v;
  }
  if (process.env.LIVEKIT_URL) env['VITE_LIVEKIT_URL'] = process.env.LIVEKIT_URL;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send('window.__ENV = Object.assign({}, window.__ENV || {}, ' + JSON.stringify(env) + ');');
});

// ═══════════════════════════════════════════════════════════
// LiveKit / WebRTC API Endpoints
// ═══════════════════════════════════════════════════════════

// POST /api/live/start — Host starts a live stream
app.post('/api/live/start', async (req, res) => {
  const user = await getUserFromAuth(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { title } = req.body;
  const roomName = `live-${user.id}-${Date.now()}`;

  // Update live_streams table
  if (supabaseAdmin) {
    await supabaseAdmin.from('live_streams').upsert({
      stream_key: roomName,
      user_id: user.id,
      title: title || user.username,
      is_live: true,
      viewer_count: 0,
    }, { onConflict: 'stream_key' });
  }

  if (isLiveKitConfigured()) {
    const token = generateHostToken(roomName, user.username, user.id);
    return res.json({
      mode: 'sfu',
      room: roomName,
      token,
      livekit_url: process.env.LIVEKIT_URL,
    });
  }

  // P2P fallback — no external SFU needed
  return res.json({
    mode: 'p2p',
    room: roomName,
    ws_url: `wss://${req.headers.host}`,
  });
});

// POST /api/live/join — Viewer joins a live stream
app.post('/api/live/join', async (req, res) => {
  const user = await getUserFromAuth(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { room } = req.body;
  if (!room) return res.status(400).json({ error: 'Missing room' });

  // Update viewer count
  if (supabaseAdmin) {
    const current = rooms.get(room);
    const count = current ? current.size + 1 : 1;
    await supabaseAdmin.from('live_streams').update({ viewer_count: count }).eq('stream_key', room);
  }

  if (isLiveKitConfigured()) {
    const token = generateViewerToken(room, user.username, user.id);
    return res.json({
      mode: 'sfu',
      room,
      token,
      livekit_url: process.env.LIVEKIT_URL,
    });
  }

  return res.json({
    mode: 'p2p',
    room,
    ws_url: `wss://${req.headers.host}`,
  });
});

// POST /api/live/end — Host ends stream
app.post('/api/live/end', async (req, res) => {
  const user = await getUserFromAuth(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { room } = req.body;
  if (supabaseAdmin && room) {
    await supabaseAdmin.from('live_streams').update({ is_live: false, viewer_count: 0 }).eq('stream_key', room).eq('user_id', user.id);
  }

  res.json({ ok: true });
});

// POST /api/battle/start — Start a battle room
app.post('/api/battle/start', async (req, res) => {
  const user = await getUserFromAuth(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { room } = req.body;
  const battleRoom = room || `battle-${user.id}-${Date.now()}`;

  if (isLiveKitConfigured()) {
    const token = generateHostToken(battleRoom, user.username, user.id);
    return res.json({
      mode: 'sfu',
      room: battleRoom,
      token,
      livekit_url: process.env.LIVEKIT_URL,
    });
  }

  return res.json({ mode: 'p2p', room: battleRoom, ws_url: `wss://${req.headers.host}` });
});

// POST /api/battle/join — Second host joins battle
app.post('/api/battle/join', async (req, res) => {
  const user = await getUserFromAuth(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { room } = req.body;
  if (!room) return res.status(400).json({ error: 'Missing room' });

  if (isLiveKitConfigured()) {
    const token = generateHostToken(room, user.username, user.id);
    return res.json({
      mode: 'sfu',
      room,
      token,
      livekit_url: process.env.LIVEKIT_URL,
    });
  }

  return res.json({ mode: 'p2p', room, ws_url: `wss://${req.headers.host}` });
});

// ═══════════════════════════════════════════════════════════
// Static file serving
// ═══════════════════════════════════════════════════════════
app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
    else if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
    else if (filePath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
  }
}));

app.get('/', (_req, res) => {
  try {
    res.setHeader('Content-Type', 'text/html');
    res.send(fs.readFileSync(indexPath, 'utf8'));
  } catch { res.status(500).send('<h1>Error</h1>'); }
});

app.get(/.*/, (_req, res) => {
  try {
    res.setHeader('Content-Type', 'text/html');
    res.send(fs.readFileSync(indexPath, 'utf8'));
  } catch { res.status(500).send('<h1>Error</h1>'); }
});

// ═══════════════════════════════════════════════════════════
// WebSocket Server (chat, gifts, battle events, WebRTC signaling)
// ═══════════════════════════════════════════════════════════
const wss = new WebSocketServer({ server });

interface WsClient {
  ws: WebSocket;
  userId: string;
  roomId: string;
  username: string;
  isHost: boolean;
}

const rooms = new Map<string, Set<WsClient>>();
const clients = new Map<WebSocket, WsClient>();
const processedTx = new Map<string, number>();

wss.on('connection', async (ws, req) => {
  let client: WsClient | null = null;

  try {
    if (!req.url) { ws.close(1008, 'Missing URL'); return; }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let roomId = url.searchParams.get('room');
    const token = url.searchParams.get('token');
    const isHost = url.searchParams.get('host') === 'true';

    if (!roomId && url.pathname.startsWith('/live/')) {
      roomId = url.pathname.split('/')[2];
    }

    if (!roomId) { ws.close(1008, 'Missing room'); return; }

    let userId = 'anon-' + Math.random().toString(36).slice(2);
    let username = 'Guest';

    if (token && supabaseAdmin) {
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        userId = payload.sub || userId;
        const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
        const user = (data as any)?.user ?? data;
        if (user) username = user.user_metadata?.username || 'Anonymous';
      } catch {}
    }

    client = { ws, userId, roomId, username, isHost };
    clients.set(ws, client);

    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId)!.add(client);

    sendTo(client, 'connected', { room_id: roomId, user_count: rooms.get(roomId)!.size });
    broadcastRoom(roomId, 'user_joined', { user_id: userId, username }, client);
    broadcastRoom(roomId, 'viewer_count_update', { count: rooms.get(roomId)!.size });

    if (supabaseAdmin) {
      supabaseAdmin.from('live_streams').update({ viewer_count: rooms.get(roomId)!.size }).eq('stream_key', roomId).then(() => {});
    }
  } catch (e) {
    ws.close(1011, 'Server error');
    return;
  }

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (!client) return;
      await handleWsMessage(client, msg.event, msg.data);
    } catch {}
  });

  ws.on('close', () => {
    if (!client) return;
    const room = rooms.get(client.roomId);
    if (room) {
      room.delete(client);
      broadcastRoom(client.roomId, 'user_left', { user_id: client.userId, username: client.username });
      broadcastRoom(client.roomId, 'viewer_count_update', { count: room.size });
      if (supabaseAdmin) {
        supabaseAdmin.from('live_streams').update({ viewer_count: room.size }).eq('stream_key', client.roomId).then(() => {});
      }
      if (room.size === 0) rooms.delete(client.roomId);
    }
    clients.delete(ws);
  });

  ws.on('error', () => {});
});

async function handleWsMessage(client: WsClient, event: string, data: any) {
  switch (event) {
    case 'chat_message':
      broadcastRoom(client.roomId, 'chat_message', {
        ...data, user_id: client.userId, username: client.username, timestamp: new Date().toISOString(),
      });
      break;

    case 'gift_sent': {
      const txId = data.transactionId;
      if (txId && processedTx.has(txId)) {
        sendTo(client, 'gift_ack', { transactionId: txId, status: 'duplicate' });
        return;
      }
      if (txId) {
        processedTx.set(txId, Date.now());
        const cutoff = Date.now() - 300_000;
        for (const [k, v] of processedTx) { if (v < cutoff) processedTx.delete(k); }
      }
      broadcastRoom(client.roomId, 'gift_sent', {
        ...data, user_id: client.userId, username: client.username, timestamp: new Date().toISOString(),
      });
      if (txId) sendTo(client, 'gift_ack', { transactionId: txId, status: 'success' });
      break;
    }

    // --- WebRTC P2P Signaling (fallback when no LiveKit) ---
    case 'webrtc_offer':
      broadcastRoom(client.roomId, 'webrtc_offer', {
        from: client.userId, sdp: data.sdp, target: data.target,
      }, client);
      break;

    case 'webrtc_answer': {
      const room = rooms.get(client.roomId);
      if (room) {
        for (const c of room) {
          if (c.userId === data.target) {
            sendTo(c, 'webrtc_answer', { from: client.userId, sdp: data.sdp });
            break;
          }
        }
      }
      break;
    }

    case 'webrtc_ice': {
      const targetId = data.target;
      const room = rooms.get(client.roomId);
      if (room) {
        for (const c of room) {
          if (targetId ? c.userId === targetId : c !== client) {
            sendTo(c, 'webrtc_ice', { from: client.userId, candidate: data.candidate });
          }
        }
      }
      break;
    }

    case 'webrtc_request_offer':
      // Viewer requesting host to send an offer
      for (const c of rooms.get(client.roomId) || []) {
        if (c.isHost) {
          sendTo(c, 'webrtc_request_offer', { from: client.userId, username: client.username });
        }
      }
      break;

    // --- Battle events ---
    case 'battle_invite':
      broadcastRoom(data.challenger_stream_id || client.roomId, 'battle_invite', data);
      break;

    case 'battle_accepted':
    case 'battle_declined':
      broadcastRoom(data.host_stream_id || client.roomId, event, data);
      break;

    case 'battle_score_update':
      broadcastRoom(client.roomId, 'battle_score_update', data);
      break;

    case 'booster_activated':
      broadcastRoom(client.roomId, 'booster_activated', { ...data, user_id: client.userId });
      break;
  }
}

function sendTo(client: WsClient, event: string, data: any) {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
  }
}

function broadcastRoom(roomId: string, event: string, data: any, exclude?: WsClient) {
  const room = rooms.get(roomId);
  if (!room) return;
  const msg = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  for (const c of room) {
    if (c !== exclude && c.ws.readyState === WebSocket.OPEN) {
      try { c.ws.send(msg); } catch {}
    }
  }
}

// ═══════════════════════════════════════════════════════════
// Start
// ═══════════════════════════════════════════════════════════
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Elix server running on port ${PORT}`);
  console.log(`WebRTC mode: ${isLiveKitConfigured() ? 'LiveKit SFU' : 'P2P fallback'}`);
  if (isLiveKitConfigured()) console.log(`LiveKit URL: ${process.env.LIVEKIT_URL}`);
  await runMigrations();
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('uncaughtException', (e) => { console.error('Uncaught:', e); process.exit(1); });
process.on('unhandledRejection', (r) => { console.error('Unhandled:', r); process.exit(1); });
