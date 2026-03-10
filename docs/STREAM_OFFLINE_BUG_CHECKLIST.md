# Stream offline for spectator — where to look

Check these files for the **"stream offline for spectator"** bug:

## 1. `server/routes/feed.ts`
- This is likely where the live feed list is built.
- Check where streams are filtered by `is_live`.
- Check how `stream_key` / `stream_id` / `id` are mapped.

## 2. The single-stream endpoint file
- In this repo there is no `server/routes/live.ts`; the single-stream API may live in `server/index.ts` or elsewhere. Search for **GET /api/live/stream/:streamKey** (or equivalent).
- Check the handler for that route.
- Especially any extra validation like `hasLiveKitHost()`, participant presence checks, or room-state checks.

## 3. `server/index.ts`
- Check WebSocket logic, viewer count updates, disconnect cleanup, and stream end/offline logic.

---

## Likely issue

`feed.ts` marks the stream as live, but the single-stream spectator endpoint does an **extra LiveKit presence check** and returns `is_live: false`, so the stream appears in the feed but the spectator sees "offline".

---

## Most likely exact bug location

In the **single-stream spectator endpoint** (likely in `server/index.ts`), look for any line that **derives `is_live` from an extra LiveKit presence/participant check**, such as:

- `if (!hasLiveKitHost(...)) return is_live: false`
- `stream.is_live = hasLiveKitHost(...)`
- `const isLive = dbStream.is_live && roomHasHost`
- If room/participants are empty → mark stream offline

**This is the most common cause of:** feed shows stream as live, but spectator sees offline.

---

## Second likely issue: ID / key mismatch

Feed may expose `stream_key` while the spectator endpoint looks up by `id` or `stream_id`. Check for mismatched use of:

- `stream_key`
- `stream_id`
- `id`

---

## How to fix (design rules)

**1️⃣ Single source of truth**

- Live status comes **only** from `is_live` on the server.
- LiveKit is used **only for streaming**, not for deciding whether someone is live.

**2️⃣ Soft validation**

- LiveKit checks **must not** do `return is_live: false` unless the stream was **explicitly ended** (e.g. host disconnected / ended stream).
- Do not override server `is_live` with a LiveKit presence check that can race or be stale.

---

## Clarification

Cred că fișierul principal este **server/routes/feed.ts**, iar bug-ul se completează în **endpoint-ul de single stream** și în **server/index.ts**.

Exactul handler pentru spectator nu se poate confirma fără repo-ul complet, dar **server/routes/feed.ts** și **server/index.ts** sunt primele fișiere pe care trebuie să le verifice.
