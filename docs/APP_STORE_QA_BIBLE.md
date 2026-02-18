# Elix Star Live — QA & App Store Submission Bible (MVP)

## 1) MVP Scope (ca să nu te întinzi)

### IN (MUST HAVE)
- Auth: login / register / logout
- Feed: scroll vertical, play video, like/save/share, open profile
- Safety: report content (video/user), block user, delete account
- Upload: record/select video (camera + mic) și upload flow (minim funcțional)
- Legal: Terms + Privacy accesibile din app

### OUT (explicit NU în MVP)
- Recomandări AI / ranking avansat
- Analytics avansat creator
- Livestream complet cu infrastructură end-to-end + anti-fraud complet
- Monetizare completă pe iOS (IAP) dacă încă nu e implementată

### Definition of Done (DoD) pe ecrane
- Login/Register: mesaj clar la credențiale greșite / email folosit; fără crash; redirect corect post-login.
- Feed: nu se blochează; scroll fluid; video play/pause predictibil; fallback la erori media.
- Profile modal: follow/unfollow; report; block; fără state “mort”.
- Report modal: trimite report către backend; confirmă success; eșec = mesaj clar + retry.
- Block: după block, conținutul userului dispare din feed (cel puțin în sesiunea curentă).
- Settings: Privacy/Terms links funcționale; Delete Account funcțional (cu confirm).
- Offline: UI de eroare/retry la fetch (minim).

## 2) Medii: Dev / Staging / Prod

### Minim obligatoriu
- Dev: chei/test endpoints, loguri verbose ok.
- Prod: chei reale, fără debug menus.

### Flag-uri recomandate
- `VITE_STORE_BUILD=true` pentru build-ul de App Store (dezactivează flow-uri non-IAP pentru bunuri digitale).

## 3) “Merge app-ul fără să pice?”

### Smoke test (10 minute)
- App pornește fără crash (cold start).
- Login + logout + login din nou.
- Feed se încarcă + scroll 20–30 swipe-uri.
- Upload: încearcă acces camera + mic (accept + deny).
- Settings: Terms/Privacy se deschid; Delete Account confirm.

### Negative tests (cele mai importante)
- Parolă greșită → mesaj clar.
- Email deja folosit → mesaj clar.
- Fără internet → UI corect + retry.
- Token invalid/expirat → re-login (sau mesaj clar).
- Report fără login → blocat cu mesaj “sign in”.
- Block self → interzis.

### Performanță / baterie
- Feed: fără loops/polling excesiv; fără audio “scăpat” în background.
- Background/foreground: revine fără crash, fără audio “fantomă”.

## 4) Permissions & Privacy (rejection killers)

### iOS (Info.plist)
- Camera: `NSCameraUsageDescription`
- Microphone: `NSMicrophoneUsageDescription`
- Photos: `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`

### Android (Manifest)
- `android.permission.CAMERA`
- `android.permission.RECORD_AUDIO`

## 5) UGC Safety (Guideline 1.2)

### Minim necesar înainte de submit
- Report content: funcțional, trimite în backend.
- Block user: funcțional și ascunde conținutul în feed.
- Terms/Privacy + contact suport accesibile.

### Backend (Supabase)
- `public.reports` pentru raportări (reporter, target, reason, details).
- `public.user_blocks` pentru block (blocker, blocked).

## 6) Monetizare & plăți (foarte sensibil)

### Regula Apple (short)
- Coins / gifts / subs = bunuri digitale → pe iOS trebuie StoreKit / IAP.
- Stripe/Apple Pay prin Stripe pentru coins pe iOS → în general respins.

### Strategie MVP recomandată
- Pentru build-ul App Store: dezactivează orice “Buy Coins” non-IAP (`VITE_STORE_BUILD=true`).
- Dacă vrei monetizare pe iOS: implementează IAP + receipt validation server-side înainte de submit.

## 7) App Store Connect “Review Notes” (template)

### Test account
- Email:
- Parolă:
- Pași:
  1. Login
  2. Swipe feed
  3. Deschide profil → Report/Block
  4. Settings → Terms/Privacy → Delete Account

### Notes pentru reviewer
- UGC: există Report/Block (din profil și din video).
- Delete account: disponibil în Settings.
- Dacă există paywall/coins: explică cum se testează fără plăți (sau că e dezactivat în store build).

## 8) Test matrix (copy/paste în QA doc)

| Test Case | Expected | Result |
|---|---|---|
| Launch app (cold start) | Fără crash, ajunge în UI |  |
| Login valid | Intri în app, sesiune persistă |  |
| Login parolă greșită | Mesaj clar, fără blocaj |  |
| Register email folosit | Mesaj clar, fără crash |  |
| Logout | Revine la login, sesiune ștearsă |  |
| Feed scroll 30 swipe | Fără freeze, fără audio “fantomă” |  |
| Video autoplay | Rulează; dacă autoplay cu sunet e blocat, trece pe muted |  |
| Share video | Nu dă crash; fallback la copy link |  |
| Open profile modal | Se deschide; se închide; fără leak UI |  |
| Follow/unfollow | UI se actualizează coerent |  |
| Report video (logged in) | Success state + închidere modal |  |
| Report user (logged in) | Success state + închidere modal |  |
| Report (guest) | Blocare cu mesaj “sign in” |  |
| Block user | User dispare din feed (în sesiune) |  |
| Unblock user | Nu mai e blocat local |  |
| Settings → Terms | Se deschide pagina Terms |  |
| Settings → Privacy | Se deschide pagina Privacy |  |
| Settings → Delete account | Confirm → cont șters, logout |  |
| Upload: allow camera+mic | Se pornește preview, fără crash |  |
| Upload: deny camera/mic | UI informativ + fallback |  |

## 9) App Store Connect checklist (minim)
- App Privacy: completezi corect ce colectezi (email/login, UGC, payments dacă există).
- Support URL + Privacy Policy URL: public, accesibil.
- Screenshot-uri: minim 6.7" + 6.1" (și iPad dacă e universal).
- Review Notes: cont de test + pași; menționează Report/Block + Delete Account.
