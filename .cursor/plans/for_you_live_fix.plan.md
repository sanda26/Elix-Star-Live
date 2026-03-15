---
name: For You page — no live streams fix
overview: Fix the bug that clears live streams when the API returns empty, and verify server/env so live streams actually appear on the For You page.
todos:
  - id: fix-empty-merge
    content: "VideoFeed: when GET /api/live/streams returns [], still merge with prev instead of overwriting"
  - id: verify-env
    content: "Document/verify server LIVEKIT_* and frontend VITE_API_URL / VITE_WS_URL for production"
isProject: false
---

# For You page — no live streams

## What’s going wrong

On the **For You** page (`/feed`), live streams should show first (from `GET /api/live/streams` and from the feed WebSocket `stream_started`). If you see **no live** at all, it’s usually one of:

1. **Bug in VideoFeed:** When the API returns an empty list, we overwrite the live list and never merge, so streams that just appeared via `stream_started` disappear on the next 3s poll.
2. **Server never returns streams:** LiveKit not configured or `listRooms()` fails/returns [] (e.g. wrong `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`).
3. **Frontend talking to wrong host:** In production, `VITE_API_URL` and `VITE_WS_URL` must point at your backend; otherwise `GET /api/live/streams` and the feed WebSocket don’t hit the server that has LiveKit.

---

## Fix 1 — VideoFeed: keep streams when API returns []

**File:** [src/pages/VideoFeed.tsx](src/pages/VideoFeed.tsx)

**Current behavior (bug):** When `GET /api/live/streams` returns `{ streams: [] }`, we do:

```ts
if (streams.length === 0) {
  setLiveStreams([]);
  setLiveLoading(false);
  return;
}
```

So we **replace** the whole list with `[]`. If a stream was just added by `stream_started` (before LiveKit’s `listRooms()` includes the room), the next poll (3s) wipes it. Result: “no live” or flicker.

**Fix:** When `streams.length === 0`, **do not** early-return. Still build `mapped = []` and run the same **merge** logic as when we have streams:

- `fromApi` = empty set  
- `keptFromPrev` = previous streams that aren’t in `removed`  
- `merged = [...mapped, ...keptFromPrev]` = `keptFromPrev`  
- `setLiveStreams(merged)` and `setLiveLoading(false)`

So streams added by `stream_started` stay until we get `stream_ended` or they appear in the API and then get removed by the server.

**Concrete change:** Remove the block:

```ts
if (streams.length === 0) {
  setLiveStreams([]);
  setLiveLoading(false);
  return;
}
```

Then ensure the rest of the function always runs: build `mapped` from `streams` (so when `streams.length === 0`, `mapped = []`), then run the existing `setLiveStreams((prev) => { ... merge ... })` and `setLiveLoading(false)`.

---

## Fix 2 — Make sure live can appear at all (config / verify)

- **Server:** For `GET /api/live/streams` to return rooms, LiveKit must be configured:
  - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` set in the server env.
  - If any is missing, [server/services/livekit.ts](server/services/livekit.ts) `isLiveKitConfigured()` is false or `listActiveRoomsFromLiveKit()` returns [] and the server falls back to in-memory `activeStreams` (only filled when someone called `POST /api/live/start` on **this** instance).
- **Production frontend:** So that the app talks to your API and WebSocket:
  - Set **build-time** env (e.g. in Coolify): `VITE_API_URL` and `VITE_WS_URL` to your backend base (e.g. `https://your-api.com` and `wss://your-api.com`), **or**
  - Serve `/env.js` with `window.__ENV = { VITE_API_URL, VITE_WS_URL }` so the same values are used at runtime.

After Fix 1, if live **still** doesn’t show:

1. Open DevTools → Network: confirm `GET /api/live/streams` returns 200 and, when someone is live, a non-empty `streams` array.
2. When **logged in**, confirm the feed WebSocket connects: `ws://.../live/__feed__?token=...` (or `wss://...`) and that you receive `stream_started` when a creator goes live.
3. Confirm server logs: no errors from `listRooms()` and that `stream_started` is sent from [server/routes/livestream.ts](server/routes/livestream.ts) on `POST /api/live/start`.

---

## Summary

| Item | Action |
|------|--------|
| **VideoFeed empty response** | Remove early-return when `streams.length === 0`; always merge with previous list so `stream_started` streams aren’t wiped by the next poll. |
| **Still no live** | Verify server LiveKit env; verify `GET /api/live/streams` and feed WebSocket URL (VITE_API_URL / VITE_WS_URL or /env.js). |

After Fix 1, the For You page will keep showing streams that were added in real time until they actually end, and won’t clear them just because one poll returned an empty list.
