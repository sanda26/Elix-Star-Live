# Live Battle Game MVP (Elix Star) — Spec complet

Acest document descrie “Live Battle Game” cap‑coadă: UI, flow, reguli de puncte, boostere, mini profile, share, realtime events și schelet API.

## A) Ecrane + UI (ce vede userul)

### 1) Live Battle Screen (Viewer)
- Video live (Host A vs Host B) + scoreboard + timer
- Tap pe ecran (pe video) → apar inimioare roșii (overlay)
- Chat jos (input + emoji + send)
- Butoane: Gift, Share, Report
- Top 3 vizibil sus + repetat jos (compact)
- Booster “⚡ Elix Star Speed Up” apare periodic (x2/x3/x5/x10) – îl “prinzi” cu tap

### 2) Live Battle Screen (Host)
- Tot ce are viewer + controale host:
  - Start Match
  - Close Match
  - Eject opponent (nu mai joci cu el / închizi battle)
  - (optional) Kick viewer / block din chat

### 3) Mini Profile Popup (Creator)
- Tap pe avatar/nume (Host A/B sau Top3) → popover/sheet mic:
  - avatar, username, level
  - follow, gift, share profile
- Close: X / swipe down
- Revine instant la battle (fără refresh)

### 4) Share Live
- Buton Share → native share sheet:
  - WhatsApp / Facebook / Copy link
- Link: `https://app.com/live/{liveId}`

## B) Reguli de puncte (MVP)

### 1) Tap pe Battle Screen = +5 puncte la SCORE
- Tap oriunde pe video (nu pe butoane) → +5 puncte pentru echipa aleasă (A/B)
- UI: inimioare roșii + (optional) “+5” float

### 2) Chat message = +1 apreciere (like counter separat)
- La trimiterea mesajului (Send) → +1 “apreciere” la live
- Nu la “deschid tastatura”, doar la send (anti-abuz)

## C) Booster — “⚡ Elix Star Speed Up” (x2/x3/x5/x10)

### 1) Cum apare
- În battle apare periodic un booster cu tag: x2 / x3 / x5 și rar x10
- Booster e vizibil ~1.8s și se mișcă (zigzag)
- Distribuție recomandată:
  - 60% x2
  - 25% x3
  - 12% x5
  - 3% x10

### 2) Cum îl prinzi
- Tap pe booster → dacă l-ai prins:
  - activezi multiplier pe tine pentru 8s
  - UI: “SPEED UP x5!” + badge mic “x5 8s”

### 3) Cum se aplică
- Base tap = 5
- Cu booster:
  - x2 → 10
  - x3 → 15
  - x5 → 25
  - x10 → 50
- Server-ul calculează punctele finale (anti-cheat), clientul doar animă (optimistic)

### Cooldown / limits (MVP)
- max 1 catch / 10s per user
- max 6 catches / battle per user

## D) Battle controls (Host)

### Start Match
- pornește countdown 3..2..1
- începe round (ex: 180s)
- broadcast către toți

### Close Match
- oprește battle imediat
- calculează winner
- arată Results (winner + top gifters/top3)

### Eject opponent
- închide battle cu motiv “ended_by_host”
- optional: cooldown înainte de reinvite

### Kick viewer (optional)
- host/mod poate scoate un viewer din live (moderation)

## E) Top 3 (MVP)
- Top 3 afișat permanent:
  - sus (premium)
  - jos (compact)
- Ranking = coins/gifts (sau puncte) în battle-ul curent
- Tap pe oricare → Mini Profile Popup (cu level)

## Realtime (WebSocket) — evenimente

### 1) Battle taps (+5)
`battle:tap_score`
```json
{ "liveId":"live_1", "battleId":"btl_1", "team":"A", "basePoints":5 }
```

### 2) Score update (server → toți, throttled 250–500ms)
`battle:score_update`
```json
{ "battleId":"btl_1", "scoreA":1250, "scoreB":980 }
```

### 3) Top3 update
`leaderboard:update`
```json
{
  "battleId":"btl_1",
  "top3":[
    {"userId":"A","username":"HostA","coins":12400,"level":21},
    {"userId":"B","username":"HostB","coins":8900,"level":18},
    {"userId":"G1","username":"Gifter1","coins":7100,"level":12}
  ]
}
```

### 4) Chat message (+1 apreciere)
Client → `chat:message`
```json
{ "liveId":"live_1", "text":"gg" }
```
Server → `likes:update`
```json
{ "liveId":"live_1", "likesTotal": 55420 }
```

### 5) Booster spawn/catch/activate
Server → `booster:spawn`
```json
{ "battleId":"btl_1", "boosterId":"bst_77", "multiplier":5, "ttlMs":1800 }
```

Client → `booster:catch`
```json
{ "battleId":"btl_1", "boosterId":"bst_77" }
```

Server (private) → `booster:activated`
```json
{ "boosterId":"bst_77", "multiplier":5, "durationMs":8000 }
```

### 6) Start/End/Eject
- Host → `battle:start_request` / `battle:end_request` / `battle:eject_opponent`
- Server → `battle:start` / `battle:end` / `battle:ended_by_host`

## API endpoints (REST) — schelet MVP

### Live
- `POST /live/create`
- `POST /live/join`
- `POST /live/leave`

### Battle
- `POST /live/:liveId/battle/start` body: `{ battleId }`
- `POST /live/:liveId/battle/end` body: `{ battleId }`
- `POST /live/:liveId/battle/tap` body: `{ battleId, team, basePoints: 5 }`
- `POST /live/:liveId/battle/eject` body: `{ battleId, opponentLiveId }`
- `GET /live/:liveId/battle/:battleId/state`

### Booster
- `POST /live/:liveId/battle/booster/catch` body: `{ battleId, boosterId }`

### Chat + Likes
- `POST /live/:liveId/chat` body: `{ text }`
- `POST /live/:liveId/like` body: `{ count: 1 }` (optional separat)

### Share
- `GET /share/live/:liveId` → deep link + metadata (optional)

### Moderation (optional)
- `POST /live/:liveId/kick` body: `{ userId }`
- `POST /report`

## Anti-spam / limits (obligatoriu)
- taps scoring: max 5/sec per user (client + server)
- booster catch: 1/10 sec per user
- chat rate-limit: ex 1 msg/sec + burst mic
- server authoritative points (client nu decide scorul)

## Done criteria (polish)
- inimioare roșii apar instant la tap
- tap score se simte instant (optimistic), server corectează dacă e limit
- booster sync la toți, catch corect, fără “după ce a dispărut”
- mini profile popup se deschide/închide rapid, fără refresh
- share deschide WhatsApp/Facebook/copy link
- start/close/eject fără bug-uri, results corecte

