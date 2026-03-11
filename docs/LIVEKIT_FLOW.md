# LiveKit flow in this app

- **Server (Node)** only creates **tokens** (using `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET`). It does **not** send or receive video.
- **Video** is sent and received **only** between the **browser (client)** and **LiveKit** (your `LIVEKIT_URL`).

## Steps

1. **Host goes live**
   - App calls `POST /api/live/start` with `{ room: streamId }` (with auth cookie).
   - Server creates a LiveKit token with `canPublish: true` and returns `{ token, url: LIVEKIT_URL }`.
   - **Browser** uses `livekit-client`: `room.connect(url, token)` then `publishTrack(camera, mic)`.
   - So the **client** connects to LiveKit and publishes; the server never sees the stream.

2. **Viewer opens a live stream**
   - App calls `GET /api/live/token?room=<streamId>` (with auth cookie).
   - Server creates a LiveKit token with `canPublish: false` and returns `{ token, url }`.
   - **Browser** uses `livekit-client`: `room.connect(url, token)`, then on `TrackSubscribed` attaches the remote video track to the `<video>` element.
   - So the **client** connects to LiveKit and subscribes; video goes client ↔ LiveKit.

## Env (server)

- `LIVEKIT_URL` – e.g. `wss://your-project.livekit.cloud` (must be set or clients get no URL).
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` – used only to **sign tokens** on the server.

## If video never appears

- **Host:** If you see a toast "Live video could not start", the browser failed to connect to LiveKit or publish (check console for `[LiveKit] Host connect/publish failed`). Confirm `LIVEKIT_URL` and keys on the server; confirm the host request gets back a non‑empty `url` and `token`.
- **Viewer:** If you see "Could not connect to stream" or "Stream offline", either the viewer token/URL is wrong or the host is not publishing yet. In LiveKit Cloud dashboard, check that the room exists and the host participant has published tracks when someone is live.
