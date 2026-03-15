# Live System Scan Report

**Date:** 2026-03-15  
**Scope:** Backend API, DB, Bunny/LiveKit, live cards, room creation/join, gifts, video playback, auth.

---

## Bugs Found and Fixed

### 1. Duplicate import (server/index.ts)
- **Issue:** `addVideo` was imported twice from `./lib/videoStore`, causing a redundant declaration.
- **Fix:** Removed the duplicate `addVideo` from the import list.
- **Impact:** Prevents potential lint/compile issues; no runtime change.

### 2. Auth payload type (server/index.ts)
- **Issue:** `verifyAuthToken()` returns `{ sub: string; email: string }` but code used `payload.username`, causing TypeScript errors.
- **Fix:** Used type assertion `(payload as { username?: string }).username` so optional `username` is allowed.
- **Impact:** Type-safe; behavior unchanged if JWT has no username.

---

## Connections Verified (Code Review)

| Area | Status | Notes |
|------|--------|--------|
| **Backend API** | OK | Live routes: GET /api/live/streams, POST /api/live/start, POST /api/live/end, GET /api/live/token. Auth via getTokenFromRequest (Bearer + cookie). |
| **Database** | OK | Postgres optional; initPostgres creates `videos` and `live_streams`. handleGetStreams merges LiveKit rooms + in-memory + dbGetLiveStreams(). |
| **Bunny Storage** | OK | env.js sets VITE_GIFT_ASSET_BASE_URL from BUNNY_STORAGE_HOSTNAME if not set. resolveGiftAssetUrl() in gifts.ts uses __ENV / VITE_GIFT_ASSET_BASE_URL. Gift CDN URLs in GIFTS use giftUrl() → resolveGiftAssetUrl(). |
| **LiveKit** | OK | createLiveToken, getLiveKitUrl(), listActiveRoomsFromLiveKit(). handleLiveStart returns { room, token, stream_key, url }. handleGetLiveToken requires ?room= and returns { room, token, url }. |
| **Live cards in feed** | OK | VideoFeed fetches /api/live/streams for liveStreams, useVideoStore for videos (from /api/feed/foryou). Feed = live items first then videos. Feed WebSocket room __feed__ gets stream_started/stream_ended. |
| **Live room creation** | OK | POST /api/live/start → requireAuth, activeStreams.set(), dbInsertLiveStream(), broadcastToFeedSubscribers('stream_started'), createLiveToken(canPublish: true), return token+url. |
| **Viewer join** | OK | Spectator: GET /api/live/streams to confirm stream exists → setStreamIsLive(true). Then GET /api/live/token?room= → connect LiveKit, attach video/audio. WebSocket connect to /live/{roomId}?token= for chat/gifts. |
| **Gift sending** | OK | handleSendGift (gifts.ts) accepts room_id/gift_id (and streamKey/giftId). Frontend sends gift_sent via WebSocket with giftId, video URL. Creator/Spectator handleGiftSent push { video } to giftQueue; GiftOverlay plays video only (no PNG overlay). |
| **Video playback / CDN** | OK | Gift assets use getGiftAssetBase() → VITE_GIFT_ASSET_BASE_URL or VITE_BUNNY_CDN_HOSTNAME. .env.example has VITE_GIFT_ASSET_BASE_URL. |
| **Auth** | OK | getTokenFromRequest checks Authorization Bearer and cookie. requireAuth used in live start/end/token and gifts/send. |

---

## How to Verify in Production

1. **Health**
   - `curl -s https://YOUR_DOMAIN/health` → `"status":"ok"`, `services.livekit`, `services.bunnyStorage`, `services.database` as expected.
2. **Env (client)**
   - `curl -s https://YOUR_DOMAIN/env.js` → `window.__ENV` includes `VITE_LIVEKIT_URL`, `VITE_GIFT_ASSET_BASE_URL` (or equivalent).
3. **Streams list**
   - After login, `GET /api/live/streams` with credentials → `{ streams: [...] }`.
4. **Go live**
   - POST /api/live/start with auth body `{ room, displayName }` → 200 with `token`, `url`, `stream_key`.
5. **Viewer token**
   - GET /api/live/token?room=STREAM_KEY with auth → 200 with `token`, `url`.
6. **Gift**
   - Send gift from spectator; creator and spectator should both get video overlay (no PNG on stream). Check network: gift assets from Bunny CDN return 200.

---

## Not Changed

- No connections or endpoints removed.
- Debug instrumentation (fetch to 127.0.0.1:7242, /api/debug-log) left in place per request.
