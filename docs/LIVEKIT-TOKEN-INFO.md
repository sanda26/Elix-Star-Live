# Info pentru debug LiveKit 401

## 1. Endpoint-ul (nu e /api/livekit/token)

- **Viewer:** `GET /api/live/token?room=ROOM_NAME` (cu cookie auth)
- **Răspuns 200:** `{ "room": "...", "token": "eyJ...", "url": "wss://golive-production-2yulsaxt.livekit.cloud" }`

În aplicație se folosește **`/api/live/token`**, nu `/api/livekit/token`. În Network trebuie căutat **`live/token`**.

---

## 2. Cod generare token (backend)

**Fișier:** `server/services/livekit.ts`

```ts
import { AccessToken } from 'livekit-server-sdk';

const API_KEY = (process.env.LIVEKIT_API_KEY || '').trim();
const API_SECRET = (process.env.LIVEKIT_API_SECRET || '').trim();

export async function createLiveToken(options: CreateTokenOptions): Promise<string> {
  const { userId, roomName, canPublish = false, name = userId, ttl = '6h' } = options;

  const at = new AccessToken(API_KEY, API_SECRET, {
    identity: userId,
    name,
    ttl,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe: true,
  });

  return await at.toJwt();
}
```

**Endpoint viewer** (`server/routes/livestream.ts`):

```ts
// GET /api/live/token?room=...
const roomName = req.query.room;  // din frontend
const token = await createLiveToken({
  userId: auth.userId,
  roomName,
  canPublish: false,
  name: auth.userId,
});
return res.status(200).json({ room: roomName, token, url: getLiveKitUrl() });
```

Grantul are `roomJoin: true`, `room: roomName`, `canSubscribe: true` – format standard LiveKit.

---

## 3. Variabile .env (fără secret)

```
LIVEKIT_URL=wss://golive-production-2yulsaxt.livekit.cloud
LIVEKIT_API_KEY=APIrRbdr69P56Bq
LIVEKIT_API_SECRET=*** (din LiveKit Cloud, același proiect ca URL-ul)
```

Valorile sunt trim-uite la citire (`.trim()`) ca să nu strice spațiile semnătura.

---

## 4. Cum rulează backend-ul

- **pm2:** `pm2 restart elix`, `pm2 save`
- **Cwd:** `/var/www/elix` (fișierul `.env` e în acest director)
- **Încărcare env:** `server/config.ts` încarcă `.env` la start (apoi `.env.production` dacă există)

---

## 5. Room name (posibil mismatch)

- **Host:** la `POST /api/live/start` trimite `{ room: effectiveStreamId }` → room = stream id (ex. user id).
- **Viewer:** deschide `/watch/:streamId` → face `GET /api/live/token?room=streamId`.
- Trebuie ca **streamId** din URL să fie **același** cu **room** cu care s-a făcut start. În app, streamurile din listă au `stream_key` = room; la tap se merge la `/watch/{stream_key}`, deci room-ul e același. Verifică doar că nu se folosește un alt id undeva (ex. slug vs UUID).

---

## Rezumat pentru cine verifică

- Endpoint: **GET `/api/live/token?room=...`** (nu livekit/token).
- Tokenul e generat cu `livekit-server-sdk`, `AccessToken`, grant `roomJoin` + `room` + `canSubscribe` (și `canPublish` pentru host).
- 401 = LiveKit respinge tokenul → de obicei API KEY/SECRET nu corespund proiectului din URL, sau secretul a fost regenerat și nu e actualizat în .env.
