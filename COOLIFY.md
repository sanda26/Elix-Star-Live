# Coolify deployment

**Use the Dockerfile build pack so the build succeeds.**

Coolify defaults to **Nixpacks**, which runs `npm ci` and can fail with “Missing: … from lock file”. This repo is set up to build with the root **Dockerfile** instead.

## In Coolify

1. Open your application → **Build** (or **Build Pack**).
2. Change the build pack from **Nixpacks** to **Dockerfile**.
3. Leave **Dockerfile location** as the default (e.g. `Dockerfile` or `./Dockerfile`).
4. Save and **Redeploy**.

The root `Dockerfile` uses `npm install` (not `npm ci`), so the build does not depend on a perfectly synced lock file.

## Port

The app listens on **8080**. In Coolify → your app → **Network**, set the port to **8080** if it is not already.

## Env

See **DEPLOY.md** for required environment variables (LiveKit, Bunny, JWT_SECRET, etc.).
