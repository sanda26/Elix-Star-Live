# Anber Live — Stack

**Single stack: Hetzner + Bunny CDN + LiveKit.**
Dead connections removed: Supabase, Vercel, Railway, Netlify, Appwrite, Ghost, custom WebRTC, DigitalOcean.

---

## Architecture

```
Browser / App
     │
     ├── HTTPS  →  Hetzner Node/Fastify backend  (auth, profiles, videos, gifts, payments)
     ├── WSS    →  Hetzner WebSocket              (live chat, gifts, battles, call signaling)
     ├── LiveKit WebRTC  →  LiveKit server        (live video publish / subscribe)
     └── Bunny CDN HTTPS →  Bunny CDN             (video playback, thumbnails, avatars)
```

---

## Service Map

| Purpose          | Service              | Implementation |
|------------------|----------------------|----------------|
| **Auth**         | Hetzner (Node/JWT)   | `POST /api/auth/login` · `POST /api/auth/register` |
| **Profiles**     | Hetzner (Node)       | `GET/PATCH /api/profiles/:userId` |
| **Live video**   | LiveKit              | Host publishes; viewers subscribe. Token from `POST /api/live/start` |
| **Live events**  | Hetzner WebSocket    | Chat, gifts, battles, call signals via `wss://your-server/live/:room` |
| **File storage** | Bunny Storage CDN    | Uploads proxied via `POST /api/media/upload-file` → PUT to Bunny |
| **Video CDN**    | Bunny CDN            | `https://your-zone.b-cdn.net/videos/...` |
| **Avatars CDN**  | Bunny CDN            | `https://your-zone.b-cdn.net/avatars/...` |
| **Payments**     | Stripe               | `POST /api/payments/checkout-session` |
| **Analytics**    | Hetzner (Node)       | `POST /api/analytics/track` |
| **Push tokens**  | Hetzner (Node)       | `POST /api/device-tokens` |
| **Sounds**       | Hetzner (Node)       | `GET /api/sounds` |
| **Hosting**      | Hetzner              | Docker / bare metal; Nginx reverse proxy |

---

## Upload Flow (Bunny Storage)

```
1. Frontend validates file (type / size)
2. POST /api/media/upload-file?path=...&ct=...   ← raw binary body
3. Hetzner backend PUTs file to Bunny Storage with server-side API key
4. Backend returns { path, cdnUrl }
5. Frontend POSTs metadata to /api/videos  (url = cdnUrl from step 4)
```

The Bunny API key **never reaches the browser** — it stays on the Hetzner server.

---

## Live Streaming Flow (LiveKit)

```
Host:
  POST /api/live/start  →  { token, url, room }
  SDK: room.connect(url, token)  →  publish camera + mic tracks

Viewer:
  GET  /api/live/token?room=...  →  { token, url }
  SDK: room.connect(url, token)  →  subscribe to host tracks
```

---

## Call Signaling Flow (Hetzner WebSocket)

```
Caller  → WS send('call_invite',    { callId, calleeId, ... })
Callee  ← WS recv('call_invite')
Callee  → WS send('call_accepted',  { callId, callerId, ... })
Caller  ← WS recv('call_accepted')
Either  → WS send('call_ended',     { callId })
```

No Supabase Realtime, no Appwrite, no custom WebRTC signaling server needed.

---

## Environment Variables

### Frontend (`.env` / `window.__ENV`)

```env
VITE_API_URL=https://your-hetzner-server.example.com
VITE_WS_URL=wss://your-hetzner-server.example.com
VITE_LIVEKIT_URL=wss://your-livekit-server.example.com
VITE_BUNNY_CDN_HOSTNAME=your-zone.b-cdn.net
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key   # optional, for web push
```

### Backend (`server/.env` or Hetzner env)

```env
# Server
PORT=8080
NODE_ENV=production
JWT_SECRET=change-this-to-a-long-random-secret

# Hetzner / Database (optional — uses in-memory store if not set)
DATABASE_URL=postgresql://user:pass@localhost:5432/anber_live

# LiveKit
LIVEKIT_URL=wss://your-livekit-server.example.com
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# Bunny Storage CDN
BUNNY_STORAGE_ZONE=your-storage-zone-name
BUNNY_STORAGE_API_KEY=your-bunny-storage-api-key
BUNNY_STORAGE_REGION=de          # de | ny | la | sg | syd
VITE_BUNNY_CDN_HOSTNAME=your-zone.b-cdn.net

# Stripe (optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# CORS
ALLOWED_ORIGINS=https://your-app.example.com,https://www.your-app.example.com
API_URL=https://your-hetzner-server.example.com
```

---

## Removed / Dead Connections

| Service       | Status   | Replaced by |
|---------------|----------|-------------|
| **Supabase**  | ❌ Removed | Hetzner Node/Fastify + Bunny Storage |
| **Vercel**    | ❌ Removed | Hetzner (self-hosted) |
| **Railway**   | ❌ Removed | Hetzner (self-hosted) |
| **Netlify**   | ❌ Removed | Hetzner (self-hosted) |
| **Appwrite**  | ❌ Removed | Hetzner Node/Fastify |
| **Ghost**     | ❌ Removed | Not in this stack |
| **Custom WebRTC** | ❌ Removed | LiveKit (handles WebRTC internally) |
| **DigitalOcean** | ❌ Removed | Hetzner |

---

## Deployment (Hetzner)

```bash
# 1. SSH into your Hetzner server
# 2. Clone / pull repo
git pull origin main

# 3. Build frontend
npm install && npm run build

# 4. Start backend (Docker recommended)
docker-compose up -d --build

# 5. Check health
curl https://your-server.example.com/health
# → { "status": "ok", "stack": "Hetzner + Bunny CDN + LiveKit" }

# 6. Check env (dev only)
curl http://localhost:8080/api/env-check
```

---

## WiFi / WebSocket Keep-Alive

The WebSocket service (`src/lib/websocket.ts`) sends a `ping` every **25 seconds**
and auto-reconnects with exponential back-off (up to 15 attempts) on any disconnect.
This keeps the connection alive through mobile network switches and app backgrounding.