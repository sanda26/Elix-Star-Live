# MVP — ce există vs ce lipsește (sus/jos)

Scop: să fie clar ce e deja în aplicație și ce trebuie “adăugat” ca să fie MVP complet, fără să stricăm ce există.

## Navigație “sus și jos” (App Shell)

### Jos: Bottom Tabs (fix)
- Home (Feed) → `/feed`
- Discover (Search) → `/search`
- Create (+) → `/create`
- Inbox → `/inbox`
- Profile → `/profile`

### Sus: Top Bars
- Home/Feed are top bar (tabs + search) în feed.
- Live are top overlay (LIVE badge, profil, apecieri, controale).
- Restul ecranelor: fiecare își păstrează header-ul existent (nu forțăm un singur header global).

## MVP (Ecrane) — status rapid

### Există (deja în repo)
- Auth: Login, Register, session check (UI)
- Home Feed: VideoFeed (vertical), acțiuni (like/comment/share/gift/report în UI), promo live/battle în ForYou
- Live: LiveStream (viewer/host), battle mode, hearts + gifts + chat, scor + timer
- Discover/Search: SearchPage + routes
- Create/Upload: Create + Upload routes
- Inbox: Inbox + ChatThread routes
- Profile: Profile + EditProfile + Settings
- Wallet/Coin balance (MVP parțial UI + mock/DB hooks)
- Docs: UX flow + arhitectură + Live Battle MVP

### Lipsește (de adăugat ca MVP complet, fără a rupe ce există)
- Onboarding screens (Splash/Welcome/Permissions screens dedicate)
- Comments drawer complet (lazy load, reply, mentions, pin)
- Discover (trending) ecran separat + chips + filtre
- Upload pipeline complet (signed URL + progress + retry + drafts locale)
- Wallet/Stripe flow end-to-end + ledger atomic + gift history
- Notifications push end-to-end (APNs/FCM/Web Push) + grouping
- Realtime (WS) real pentru chat/hearts/gifts + rate limits server-side
- Live Battle complet (invite/accept/round state/leaderboards/top gifters) pe backend
- Moderation minim (report queue, block, profanity filter)

## Documente relevante
- UX Flow + arhitectură: `docs/UX_FLOW_AND_ARCHITECTURE.md`
- Live Battle MVP: `docs/LIVE_BATTLE_MVP.md`
