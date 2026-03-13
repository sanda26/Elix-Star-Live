# Connect the app to your Hetzner server

This page summarizes how to **point the app at your Hetzner server** and **deploy to it**.

---

## 1. One-time: set your server URL in `.env`

On the **Hetzner server** (or in the repo you use for deploy), create or edit `.env` so the app talks to your server:

```bash
# Copy template
cp SET_KEYS_HERE.txt .env

# Edit .env — set these to your Hetzner server (domain or IP)
API_URL=https://anberlive.co.uk
VITE_API_URL=https://anberlive.co.uk
VITE_WS_URL=wss://anberlive.co.uk
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
VITE_BUNNY_CDN_HOSTNAME=https://anberlive-cdn.b-cdn.net
VITE_GIFT_ASSET_BASE_URL=https://anberlive-cdn.b-cdn.net/gifts
```

Replace `anberlive.co.uk` with your domain (or `https://YOUR_HETZNER_IP` if you have no domain yet).  
These values are **baked into the frontend** when you run `docker compose build`, so the browser will connect to your Hetzner server.

---

## 2. Deploy to Hetzner

### Option A: Run everything on the server

1. **First time on the server** (see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)):
   - Create a Hetzner Cloud server (Ubuntu 22.04, Docker installed).
   - Point your domain (or use the server IP).
   - Clone the repo: `git clone <your-repo> anber-live && cd anber-live`.
   - Create `.env` with the variables above (and LiveKit, Bunny, JWT, etc.).
   - Run: `docker compose build && docker compose up -d`.

2. **Later updates** (on the server):
   ```bash
   cd anber-live
   git pull
   docker compose build && docker compose up -d
   ```

### Option B: Deploy from your PC (PowerShell)

From your **Windows machine** (in the project folder):

```powershell
$env:HETZNER_HOST = "deploy@123.45.67.89"   # or deploy@anberlive.co.uk
.\scripts\deploy-to-hetzner.ps1
```

Optional: `$env:HETZNER_REPO_PATH = "~/anber-live"` if the repo lives in a different path on the server.

### Option B (Linux/macOS): Deploy from your machine (bash)

```bash
export HETZNER_HOST=deploy@123.45.67.89
./scripts/deploy-to-hetzner.sh
```

The script will SSH in, `git pull`, `docker compose build`, and `docker compose up -d` on the server.

---

## 3. Check that the app is connected

- **Health:** `https://your-domain/health` (or `http://YOUR_IP/health`).
- **App in browser:** Open `https://your-domain` — the frontend should load and use the API on the same server.

If the frontend still calls `localhost` or the wrong host, ensure `.env` on the **build machine** (the Hetzner server when you run `docker compose build`) has `VITE_API_URL`, `VITE_WS_URL`, and `VITE_LIVEKIT_URL` set, then rebuild: `docker compose build --no-cache && docker compose up -d`.

---

## 4. Full setup

For first-time Hetzner setup (Docker, nginx, SSL, Bunny, LiveKit, DB), follow **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**.
