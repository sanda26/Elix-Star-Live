# App connections audit

Quick reference for navigation and key connections so every button goes to the right place.

## Routes (App.tsx)

- **Feed / home:** `/` → `/feed` or `/login`; `/feed` = VideoFeed (For You)
- **Auth:** `/login`, `/register`, `/auth/callback`, `/forgot-password`, `/reset-password`
- **Main tabs:** `/feed`, `/following`, `/search`, `/discover`, `/live`, `/friends`, `/create`, `/inbox`, `/profile`
- **Profile:** `/profile`, `/profile/:userId` (userId = user id from DB, not username)
- **Live:** `/live` = LiveDiscover; `/live/broadcast` = go live; `/watch/:streamId` = SpectatorPage
- **Content:** `/video/:videoId`, `/hashtag/:tag`, `/music/:songId`
- **Shop:** `/shop`, `/shop/:itemId`
- **Settings:** `/settings`, `/settings/blocked`, `/settings/safety`, `/edit-profile`, `/creator/login-details`
- **Legal:** `/terms`, `/privacy`, `/guidelines`, `/support`, `/legal`, `/legal/*`
- **Other:** `/upload`, `/purchase-coins`, `/report`, `/call`, `/ai-studio`; admin: `/admin`, `/admin/users`, `/admin/reports`, `/admin/economy`

## Fixes applied

1. **LiveStream mini profile → Profile**  
   Was: `navigate('/profile/${miniProfile.username}')`.  
   Now: `navigate('/profile/${miniProfile.id ?? miniProfile.username}')` so Profile gets a valid `userId` (id is set after profile fetch).

2. **TopNav / BottomNav on spectator**  
   Both TopNav and BottomNav hide when `pathname.startsWith('/watch/')` so the spectator (watch) screen is full-screen.

## Profile links (must use user id)

- LiveStream mini profile: `miniProfile.id ?? miniProfile.username`
- SpectatorPage host: `hostUserId`
- SpectatorPage viewers list: `v.id`
- FriendsFeed / FollowingFeed: `u.id`
- Inbox share: `f.user_id`
- Shop item: `item.seller_id`
- Discover / Search: `creator.user_id`, `user.user_id`, `u.id`

## Watch vs live

- To **watch** a stream: `navigate(\`/watch/${streamId}\`)` or `streamKey` (e.g. creator user id).
- To **go live**: `navigate('/live/broadcast')`.
- Live list: `navigate('/live')` = LiveDiscover.
