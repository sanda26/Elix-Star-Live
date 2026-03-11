# Anber Live — Stack (TikTok-style)

**Single stack: Bunny + Hetzner + LiveKit.** No Supabase, Vercel, Ghost, WebRTC (custom), Digital Ocean, Railway, or Appwrite.

## Connections

| Purpose        | Service   | Role |
|----------------|-----------|------|
| **Auth**       | Node (Hetzner) | JWT login/register; session in cookie. |
| **Live video** | LiveKit   | Host publishes camera/mic; viewers subscribe. Token from backend. |
| **Storage**    | Bunny     | Video uploads, thumbnails, avatars (Bunny Storage + CDN). |
| **Hosting**    | Hetzner   | Node server runs here; serve app + API. |

## Flow (like TikTok)

1. **Feed** — Backend API (e.g. `/api/feed/for-you`) returns videos + active live rooms. Live cards point to `/watch/:roomId`.
2. **Watch video** — Video URL from Bunny CDN; playback in app.
3. **Watch live** — Viewer gets token from `GET /api/live/token?room=...`, connects to LiveKit, subscribes to host track.
4. **Go live** — Host gets token from `POST /api/live/start`, connects to LiveKit, publishes camera + mic.
5. **Upload** — Video/thumbnail uploaded via backend to Bunny.

## Removed / not used

- **Supabase** — No DB or auth from Supabase. Backend uses in-memory auth store (or future Postgres on Hetzner).
- **Vercel / Railway / Appwrite / Digital Ocean / Ghost** — Not in this stack.
- **Custom WebRTC** — Live is LiveKit only. Co-host/battle features can be re-added later via LiveKit multi-participant if needed.

## Env (summary)

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` — Live streaming.
- `BUNNY_*` — Storage and video CDN.
- `JWT_SECRET` — Auth.
- `VITE_API_URL`, `VITE_WS_URL` — Frontend points to your Hetzner server.
