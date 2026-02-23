# Deploy to Railway

## One-time setup

- **Railway CLI** (optional): `npm i -g @railway/cli`
- **Link project:** `railway link` (or create a new project at [railway.app](https://railway.app))
- **Build:** `nixpacks.toml` runs `npm ci` and `npm run build`, then starts `npx tsx server/index.ts`

## Deploy from your PC

1. Open a terminal in the project folder.
2. Log in (if needed):
   ```bash
   railway login
   ```
3. Deploy:
   ```bash
   railway up
   ```
   If upload times out (large repo), try again or use **GitHub deploy** below.

## Deploy from GitHub (recommended)

1. Go to [railway.app](https://railway.app) → your project.
2. **Settings** → connect the **GitHub repo** for this project.
3. Push to the branch Railway watches (e.g. `main` or `app-delivery`); Railway will build and deploy automatically.

## After deploy

- **URL:** In Railway dashboard → your service → **Settings** → **Networking** → **Generate domain** (e.g. `elix-star-live-web-production.up.railway.app`).

### Supabase — set these so everything stays connected

All auth, database, storage, and realtime use Supabase. In Railway → **Variables**, add:

| Variable | Used by | Description |
|----------|---------|-------------|
| `VITE_SUPABASE_URL` | Frontend + server | Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anon/public key (safe in client) |
| `SUPABASE_URL` | Server | Same as `VITE_SUPABASE_URL` (server fallback) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Service role key from Supabase Dashboard → API (auth, WebSocket, payouts, feed, moderation) |

Without these, login, live streams, chat, gifts, payouts, and feed won’t work. Copy from Supabase Dashboard → Project Settings → API.

### Other env vars (Railway → Variables)

- **`VITE_WS_URL`** = your Railway app URL (e.g. `https://your-app.up.railway.app`) so the frontend uses the same host for WebSockets (live, chat, battles).
- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Optional:** `OPENAI_API_KEY` (moderation), Apple IAP vars if you use them.

See `.env.example` in the repo for a full list.

## Build / start (reference)

- **Build:** `npm ci` then `npm run build` (creates `dist/`).
- **Start:** `npx tsx server/index.ts` (serves `dist/`, API, WebSocket, and `/health`).
