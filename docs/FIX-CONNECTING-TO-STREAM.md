# Plan: Fix "Connecting to stream..." (video never loads)

Follow in order. Stop at the first step that fails and fix it before going on.

---

## Step 1: Server has LiveKit env (2 min)

**On the server:**

```bash
cd /var/www/elix
grep -E "LIVEKIT_URL|LIVEKIT_API_KEY|LIVEKIT_API_SECRET" .env
```

- You must see 3 lines (URL, KEY, SECRET) with values, not empty.
- If any are missing or empty → add them to `/var/www/elix/.env`, then:

```bash
pm2 restart elix
pm2 save
```

---

## Step 2: API returns token + url (2 min)

**In the browser (desktop or phone with remote debugging):**

1. Log in as the **viewer** (the account that will watch).
2. Open DevTools (F12) → **Network** tab.
3. Go to the stream that shows "Connecting to stream..." (or open `/watch/STREAM_ID` for a live stream).
4. In Network, find the request: **`token`** or **`live/token`** (URL like `.../api/live/token?room=...`).

**Check the response:**

- **Status 401** → You are not logged in as viewer. Log in and try again.
- **Status 503** → Server says "Live streaming is not configured". Step 1 failed (env not loaded). Restart app and check `.env` path.
- **Status 200** → Open the response body. It must contain:
  - `"token": "eyJ..."`
  - `"url": "wss://...livekit.cloud"` (or similar)

If **`url` is missing or empty** → Server is not sending LiveKit URL. Fix Step 1 (ensure `.env` has `LIVEKIT_URL` and the app is restarted). If you use a script or systemd, ensure it runs from `/var/www/elix` so `.env` is in the working directory.

---

## Step 3: Host is actually publishing (3 min)

The viewer can only see video if the **host** has connected to LiveKit and published their camera.

1. On a **different device or browser**, log in as the **host** (streamer).
2. **Go live** (start broadcast).
3. Leave that tab/device on the live screen (don’t close or navigate away).
4. On the **viewer** device, open the same stream again (or refresh).

If the host never goes live, or closes the live page, the viewer will stay on "Connecting to stream..." until the host is live and publishing.

**Optional check:** In [LiveKit Cloud](https://cloud.livekit.io) → your project → **Rooms**. When the host is live, you should see a room (name = stream/room id). Open it and confirm the host participant has a **video track** published. If the room is empty or has no video track, the host app is not connecting or not publishing (Step 4).

---

## Step 4: Host app connects and publishes (2 min)

When the **host** taps "Go live":

1. Open DevTools → **Network**.
2. Find **`start`** or **`live/start`** (POST to `/api/live/start`).
3. Check response: must be **200** with body containing `"token"` and `"url"`.

If the host gets **503** → same as Step 1 (server env).  
If the host gets **200** but then you see a toast **"Live video could not start. Check LIVEKIT_URL and keys on server."** → the browser failed to connect to the LiveKit URL (wrong URL, network, or CORS). Check LiveKit dashboard URL and that `LIVEKIT_URL` in `.env` matches it (e.g. `wss://your-project.livekit.cloud`).

---

## Step 5: Same room name (1 min)

The viewer requests a token for **room = stream id** (from the URL, e.g. `/watch/abc123` → room `abc123`).  
The host must have started the stream with the **same** room id. In this app, when the host goes live, the room name is the host’s stream id (user id or stream key). When you open a stream from the For You list, the link is `/watch/{stream_key}`. So the viewer asks for `room=stream_key` and the host published to `room=stream_key`. They must match. If you’re testing by hand, use the same id in both places (e.g. host goes live so the stream appears in the list, then open that stream from the list).

---

## Summary

| Symptom | What to do |
|--------|------------|
| No `LIVEKIT_*` in `.env` or empty | Add them, restart app (Step 1). |
| Token response has no `url` | Server env not loaded; fix Step 1, restart. |
| 401 on token | Viewer must be logged in. |
| 503 on token or start | Server env; fix Step 1. |
| Host toast: "Live video could not start" | Check LIVEKIT_URL, keys, and LiveKit dashboard. |
| Viewer stays "Connecting..." | Ensure host is live and publishing (Step 3–4); check LiveKit Rooms. |

After each change, restart the app (`pm2 restart elix`), then test again.
