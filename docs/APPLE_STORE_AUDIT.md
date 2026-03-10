# Apple App Store Readiness Audit

Summary of checks and fixes for App Store submission. **Build for store with:** `npm run build:ios` (uses `--mode store`).

---

## ✅ In good shape

| Item | Status |
|------|--------|
| **In-App Purchase (3.1.1)** | iOS uses Apple IAP via `@capgo/native-purchases` (StoreKit). Stripe is only used on web (`isStripeAllowed()` = `platform.isWeb`). |
| **Sign in with Apple (4.8)** | Implemented in `useAuthStore.signInWithApple` and shown on Login page. |
| **Console stripping** | `vite.config.ts`: `drop_console: mode === 'production' \|\| mode === 'store'`. |
| **Error boundary** | Stack trace only in `import.meta.env.DEV`; production shows generic message. |
| **Promote panel** | Hidden in store build (`PromotePanel.tsx`: `IS_STORE_BUILD` → return null). |
| **LiveStream Test Coins** | Button wrapped with `!IS_STORE_BUILD`. |
| **GiftPanel “Top Up”** | Wrapped with `!IS_STORE_BUILD` (store uses IAP flow elsewhere). |
| **StripePaymentElement** | In store build returns error: “Purchases are handled through the app store.” |
| **Privacy / Terms** | Routes `/privacy` and `/terms` exist; reference them in App Store Connect and in-app if required. |
| **Info.plist** | Camera, microphone, photo library usage descriptions present. |

---

## ✅ Fixed in this audit

| Item | Fix |
|------|-----|
| **SpectatorPage Test Coins** | “Test” in More menu and Test Coins modal now hidden when `IS_STORE_BUILD` (same as LiveStream). |

---

## ⚠️ You should do outside the repo

1. **App Store Connect**
   - Privacy policy URL (e.g. your `/privacy` page).
   - Support URL.
   - Age rating and any content warnings (live UGC, gifts, etc.).

2. **Capacitor / Xcode**
   - Ensure `MODE=store` is used when building for App Store (e.g. `npm run build:ios` already uses `build:store`).
   - In Xcode, confirm signing and “Release” for archive.

3. **IAP**
   - Create and attach In-App Purchase products in App Store Connect to match `IAP_PRODUCTS` in `src/lib/iap.ts`.
   - Test “Restore purchases” on a real device.

4. **Sign in with Apple**
   - Enable in Apple Developer → Identifiers → your App ID → Sign in with Apple.
   - Configure in your auth provider (e.g. Apple Sign-In).

---

## 🔍 Optional hardening

- **GiftPanel “Top Up”**  
  In store build it’s already hidden; users get coins via Purchase Coins (IAP). No change required.

- **Info.plist**  
  Add `NSFaceIDUsageDescription` only if you use Face ID; no other permission strings stood out as missing.

---

## Verdict

The app is in a **good position for App Store submission** provided you:

- Build with **store** mode (`npm run build:ios`).
- Complete App Store Connect (privacy URL, support URL, IAP products, Sign in with Apple).
- Test IAP and Restore on a real device.

No further code changes are required for the items audited above.
