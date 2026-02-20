# Deploy to Railway

## One-time setup (already done)

- **Railway CLI** is installed globally.
- **Project linked:** `surprising-achievement` → service `elix-star-live-web`.
- **Build:** `nixpacks.toml` runs `npm ci` and `npm run build`, then starts `node server/index.js`.

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
- **Env vars:** In Railway → **Variables**, add any `VITE_*` and other keys your app needs (e.g. Supabase URL/anon key).

## Build / start (reference)

- **Build:** `npm ci` then `npm run build` (creates `dist/`).
- **Start:** `node server/index.js` (serves `dist/` and `/health`).
