# Run the app locally to test

You can run the full app on your machine to verify everything works before deploying to Hetzner.

---

## Quick start (two terminals)

### 1. Install dependencies (once)

```bash
npm install
```

### 2. Optional: minimal `.env` for local

Create a `.env` in the project root if you don’t have one. For local testing you can leave API URLs empty — the frontend will use the Vite dev server and its proxy to the backend.

Minimal example (add real values if you want to test LiveKit, Stripe, or Bunny):

```env
NODE_ENV=development
PORT=8080

# Leave empty in dev — Vite proxies /api to localhost:8080
# VITE_API_URL=
# VITE_WS_URL=

# Only needed if you test live streaming
# LIVEKIT_URL=wss://your-project.livekit.cloud
# LIVEKIT_API_KEY=
# LIVEKIT_API_SECRET=

# Only needed if you test uploads (Bunny)
# BUNNY_STORAGE_ZONE=
# BUNNY_STORAGE_API_KEY=
# VITE_BUNNY_CDN_HOSTNAME=

# JWT secret (use any long string for local)
JWT_SECRET=local-dev-secret-at-least-32-characters-long
```

### 3. Start backend and frontend

**Option A — Two terminals (recommended)**

- **Terminal 1 — backend (Express, port 8080):**
  ```bash
  npm run dev:server
  ```
- **Terminal 2 — frontend (Vite, port 5173):**
  ```bash
  npm run dev
  ```

**Option B — One command (runs both)**

```bash
npm run dev:all
```

### 4. Open the app

- In the browser go to: **http://localhost:5173**
- Vite proxies `/api` and WebSocket to the backend on port 8080.
- Health check: http://localhost:8080/health

---

## What works locally without extra config

- App UI and navigation  
- Login / register (in-memory or DB if you set `DATABASE_URL`)  
- Health check and most API routes  

## What needs real keys (optional)

- **Live streaming** — set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (e.g. LiveKit Cloud).  
- **Video/avatar uploads** — set Bunny env vars and `VITE_BUNNY_CDN_HOSTNAME`.  
- **Payments** — set Stripe keys and webhook secret.  

---

## Troubleshooting

| Problem | What to do |
|--------|------------|
| “Cannot find module” or server won’t start | Run `npm install` from project root. |
| Port 8080 in use | Stop the other app using 8080, or set `PORT=8081` in `.env` and in `vite.config.ts` proxy target. |
| Port 5173 in use | Vite will offer the next free port (e.g. 5174). |
| API 404 or CORS errors | Use the app at **http://localhost:5173** (so the proxy is used), not by opening the backend URL directly. |
| Live / uploads / payments don’t work | Add the corresponding keys to `.env` (see above). |
