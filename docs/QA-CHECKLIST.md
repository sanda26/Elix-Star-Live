# App QA & Code Audit Checklist

**App Build:** Latest Production Build  
**Platforms:** iOS, Android, Web  
**Objective:** Verify full functionality, connectivity, stability, and payments.

---

## ✅ Instructions

- **Tick each item** as tested
- **Record issues** clearly with steps to reproduce, device, and logs
- **Do NOT modify** UI, layout, or any feature logic
- **Focus only** on testing and reporting

---

## 1. App Setup

| Task | Status | Notes |
|------|--------|-------|
| Install latest production build | ⬜ Manual | `npm run build` (web), `npm run build:ios` / `npm run build:android` |
| Configure `VITE_API_URL` | ⬜ Manual | e.g. `https://www.elixstarlive.co.uk` |
| Configure `VITE_WS_URL` | ⬜ Manual | e.g. `wss://www.elixstarlive.co.uk` |
| Configure `CLIENT_URL` | ⬜ Manual | e.g. `https://www.elixstarlive.co.uk` |
| Configure `VITE_LIVEKIT_URL` | ⬜ Manual | LiveKit Cloud URL |
| Apple IAP sandbox (iOS) | ⬜ Manual | TestFlight or Xcode sandbox |
| Google Play Billing test (Android) | ⬜ Manual | License testers |
| Stripe test keys (Web) | ⬜ Manual | `pk_test_`, `sk_test_`, webhook |

---

## 2. Backend Connectivity

| API | Route | Verified |
|-----|-------|----------|
| Login | `POST /api/auth/login` | ✅ Exists |
| Signup | `POST /api/auth/register` | ✅ Exists |
| Profile | `GET /api/profile`, `GET /api/profiles/:userId` | ✅ Exists |
| Feed | `GET /api/feed/foryou` | ✅ Exists |
| Gifts | `GET /api/gifts/catalog`, `POST /api/gifts/send` | ✅ Exists |
| Wallet | `GET /api/wallet`, `GET /api/wallet/transactions` | ✅ Exists |
| Purchase verify | `POST /api/iap/verify`, `POST /api/verify-purchase` | ✅ Exists |

| WebSocket Event | Status |
|-----------------|--------|
| Live stream updates | ✅ `room_state`, `user_joined`, `user_left` |
| Battle updates | ✅ `battle_state_sync`, `battle_tick`, `battle_score`, etc. |
| Gift sending/receiving | ✅ `gift_sent` |
| Viewer count | ✅ `viewer_count`, `room_state` |
| Stream started/ended | ✅ `stream_started`, `stream_ended` (feed) |

**Goal:** No broken connections or errors.

---

## 3. Functional Flows

### User Account
- [ ] Signup
- [ ] Login
- [ ] Logout
- [ ] Update profile and settings

### Feed
- [ ] Feed loads and displays items correctly

### Live Streams & Battles
- [ ] Join / leave live streams (host & opponent)
- [ ] Send and receive gifts
- [ ] Coins deducted and added correctly
- [ ] Battle scoring works correctly
- [ ] Reconnect mid-battle does not break session

### Payments
- [ ] Coin purchase flows (Stripe, Apple IAP, Google Play) update wallet
- [ ] Buy coins via Stripe (Web)
- [ ] Buy coins via Apple IAP (iOS)
- [ ] Buy coins via Google Play Billing (Android)
- [ ] Wallet balance updates after purchase
- [ ] Gifts can be purchased and sent after buying coins

---

## 4. Stress & Crash Testing

- [ ] Rapid navigation between screens
- [ ] Rapid join/leave live streams
- [ ] Burst gift sending
- [ ] Open/close app repeatedly
- [ ] Switch between streams quickly
- [ ] Background/foreground transitions
- [ ] Network loss / reconnect scenarios
- [ ] Test on low-end and older devices

**Goal:** No crashes, freezes, or unhandled errors.

---

## 5. Edge Cases

- [ ] Empty feed
- [ ] Expired sessions
- [ ] Invalid API responses
- [ ] User disconnect mid-stream / mid-battle
- [ ] Multiple devices logged into same account

**Goal:** App recovers gracefully.

---

## 6. Logging & Debug

- [ ] No `console.log` / `debugger` in production ✅ (Code audit: verified in `src/`)
- [ ] `/api/test-coins` endpoint removed ✅ (Code audit: route not registered)
- [ ] Wallet backend correctly stores coin balances ✅ (`server/data/wallet.json`)
- [ ] Test coin system is isolated (`/coins/test/*`) and rejects cross-use with real routes

---

## 7. Memory & Performance

- [ ] Monitor memory usage
- [ ] No memory leaks
- [ ] Smooth animations and transitions
- [ ] WebSocket reconnect works under stress

---

## 8. Final Verification

- [ ] Test full flows on iOS devices
- [ ] Test full flows on Android devices
- [ ] Test full flows on Web
- [ ] Coins/purchases/gifts flow correctly
- [ ] Backend wallet updated correctly
- [ ] Document any crashes or stuck states

---

## Code Audit Summary

| Category | Result |
|----------|--------|
| Backend APIs | All required routes exist in `server/index.ts` |
| WebSocket events | `gift_sent`, `room_state`, `user_joined`, `user_left`, `viewer_count`, `stream_started` implemented |
| Test coins | Route removed; handler exists in `profiles.ts` but not mounted |
| Frontend logging | No `console.log` or `debugger` in `src/` |
| Env vars | `VITE_API_URL`, `VITE_WS_URL`, `CLIENT_URL`, `VITE_LIVEKIT_URL` used |

---

## Deliverable

QA report confirming:
- [ ] Full app connectivity ✅
- [ ] Functional flows work ✅
- [ ] Crash-free under stress ✅
- [ ] Coins/purchases handled correctly ✅
- [ ] Ready for App Store & Google Play ✅

## Coin Separation Negative Tests

- [ ] Normal user calls `POST /coins/test/mint` -> `403`
- [ ] `POST /api/gifts/send` with `coin_type=test` -> rejected (`coin_type_mismatch`)
- [ ] `POST /coins/test/score` with `coin_type=real` -> rejected (`coin_type_mismatch`)
