# Debug: "Connecting to stream..." – ce să verifici

## 1. Console în browser (F12 → Console)

Deschide streamul care stă pe "Connecting to stream...", apoi F12 → **Console**.

Caută:

- `[LiveKit] Viewer connect failed:` → eroare la conectarea la LiveKit (URL, token sau rețea).
- `401` / `403` → nu ești logat sau token invalid.
- `503` → serverul spune că LiveKit nu e configurat (lipsește `.env` sau nu e încărcat).
- Erori WebSocket / `wss://` → conexiunea la LiveKit e blocată (SSL, firewall, URL greșit).

## 2. Network – răspunsul la token

F12 → **Network** → reîncarcă pagina streamului (sau deschide din nou streamul).

Găsește request-ul:

- **URL:** `.../api/live/token?room=...` (în app e `/api/live/token`, nu `/api/livekit/token`).

Verifică:

- **Status 200** → răspunsul trebuie să conțină `"token": "eyJ..."` și `"url": "wss://...livekit.cloud"`.
- **Status 401** → nu ești logat.
- **Status 503** → LiveKit nu e configurat pe server (vezi `.env` și pm2 restart).
- Dacă `"url"` lipsește sau e gol → pe server `LIVEKIT_URL` nu e setat sau nu e încărcat.

Test rapid în Console (după ce ești pe site-ul tău, același domeniu):

```js
fetch('/api/live/token?room=test', { credentials: 'include' }).then(r => r.json()).then(console.log)
```

- Dacă vezi `{ token: "...", url: "wss://..." }` → backend-ul dă token și URL ok.
- Dacă vezi `{ error: "..." }` sau `url: ""` → problema e pe server (env / config).

## 3. pm2 logs pe server

Pe server:

```bash
pm2 logs elix
```

sau

```bash
pm2 logs elix --lines 100
```

Caută:

- `Live streaming is not configured` / 503 → `LIVEKIT_*` lipsesc din `.env` sau nu sunt încărcate.
- `[config] Loaded .env` → confirmă că `.env` e citit.
- Erori la `createLiveToken` / LiveKit → problemă la chei sau la LiveKit.

## 4. .env pe server (fără secrete)

Rulează pe server:

```bash
cd /var/www/elix
grep LIVEKIT_URL .env | sed 's/=.*/=***/'
```

Trebuie să vezi ceva de genul: `LIVEKIT_URL=***` (nu linie goală).  
Dacă lipsește → adaugă în `/var/www/elix/.env`:

- `LIVEKIT_URL=wss://golive-production-2yulsaxt.livekit.cloud` (sau URL-ul tău LiveKit)
- `LIVEKIT_API_KEY=...`
- `LIVEKIT_API_SECRET=...`

Apoi: `pm2 restart elix` și `pm2 save`.

---

## Rezumat

| Unde | Ce verifici |
|------|-------------|
| **Browser Console** | Erori `[LiveKit]`, 401, 503, WebSocket |
| **Browser Network** | Request la `/api/live/token` → status 200, body cu `token` + `url` |
| **Server pm2 logs** | "Loaded .env", erori LiveKit / token |
| **Server .env** | `LIVEKIT_URL` (și KEY, SECRET) există, apoi `pm2 restart elix` |

În aplicația ta, endpoint-ul pentru token este **GET `/api/live/token?room=...`** (nu `/api/livekit/token`).
