# LiveKit 401 – token rejected

When you see:
- `WebSocket connection to 'wss://...livekit.cloud/rtc/v1?access_token=...' failed`
- `401` on LiveKit URLs
- `could not fetch region settings`

LiveKit is **rejecting the access token**. The server is issuing a token, but LiveKit Cloud says it's invalid.

## Cause

Almost always: **API Key or API Secret don't match** the LiveKit project for that URL.

Your URL is `wss://golive-production-2yulsaxt.livekit.cloud` → the key and secret must be from **that exact project** in [LiveKit Cloud](https://cloud.livekit.io).

## Fix

1. **Open LiveKit Cloud** → select the project that has URL `golive-production-2yulsaxt.livekit.cloud` (or the one you use).

2. **Go to Settings → API Keys** (or similar). Copy the **API Key** and **API Secret** again. Do not use keys from another project.

3. **Check for typos and spaces** in `.env` on the server:
   - No space before or after `=`
   - No quotes unless the value really has spaces
   - Entire key and secret on one line each

   Example (replace with your real values):
   ```
   LIVEKIT_URL=wss://golive-production-2yulsaxt.livekit.cloud
   LIVEKIT_API_KEY=APIxxxxxxxxxx
   LIVEKIT_API_SECRET=your_secret_here_no_spaces
   ```

4. **If you ever regenerated the secret** in LiveKit, the old secret is invalid. Update `.env` with the **new** secret and restart:
   ```bash
   pm2 restart elix
   pm2 save
   ```

5. **Restart the app** after any `.env` change so it loads the new values.

## Verify

After updating and restarting, open a stream again. If the token is valid, the WebSocket should connect and you won't see 401 from LiveKit. If you still see 401, the key/secret still don't match that project (or the secret was regenerated and not updated on the server).
