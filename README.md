# 🌟 Elix Star - TikTok-Style Live Streaming & Video Platform

A full-featured social video platform with live streaming, battles, virtual gifts, and more.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## ✨ Features

### 🎥 Core Features
- **Short-Form Videos** - TikTok-style vertical video feed
- **Live Streaming** - Real-time broadcasting with chat
- **Live Battles** - Head-to-head gift battles between streamers
- **Virtual Gifts** - Send animated gifts during streams
- **Comments & Likes** - Social engagement on videos
- **Direct Messages** - Private messaging between users
- **Push Notifications** - Real-time alerts for likes, comments, follows

### 💰 Monetization
- **Virtual Currency** - Coins & diamonds system
- **In-App Purchases** - Buy coin packages via Stripe/Apple/Google
- **Battle Boosters** - Power-ups for live battles (2x, steal, freeze)
- **Wallet System** - Immutable transaction ledger

### 🔍 Discovery
- **For You Feed** - AI-powered personalized recommendations
- **Following Feed** - Videos from creators you follow
- **Trending** - Hot videos and hashtags
- **Search** - Find users, videos, and hashtags
- **Hashtags** - Categorize and discover content

### 👤 User Experience
- **User Profiles** - Customizable with bio, avatar, social links
- **Follower System** - Follow/unfollow creators
- **Leveling System** - XP-based progression with badges
- **Privacy Controls** - Block users, report content
- **Settings Hub** - Account, preferences, safety center

### 🛡️ Safety & Moderation
- **Content Reports** - Report videos, comments, users
- **User Blocking** - Block unwanted users
- **Admin Dashboard** - Moderate content and manage users
- **Role-Based Access** - User, creator, moderator, admin roles
- **Ban System** - Temporary and permanent bans

### 📊 Analytics
- **Event Tracking** - Comprehensive analytics for all actions
- **Trending Algorithm** - Smart scoring based on engagement
- **Performance Monitoring** - Track app performance

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm 9+
- Supabase account
- Stripe account (for payments)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/elix-star.git
   cd elix-star
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key
   STRIPE_SECRET_KEY=your_stripe_secret
   VITE_WEBSOCKET_URL=ws://localhost:8080
   ```

4. **Set up database:**
   
   Follow instructions in `RUN_THESE_IN_ORDER.md`:
   - Run `ALL_NEW_FEATURES.sql` in Supabase SQL Editor
   - Run `SECURITY_POLICIES.sql`
   - Run `STORAGE_SETUP.sql`
   - Run `CRON_JOBS.sql`

5. **Start development server:**
   ```bash
   npm run dev
   ```
   
   App runs at: http://localhost:5173

6. **Start WebSocket server** (in new terminal):
   ```bash
   npm run ws:server
   ```

---

## 📁 Project Structure

```
elix-star/
├── src/
│   ├── components/       # React components
│   │   ├── BottomNav.tsx
│   │   ├── CommentsDrawer.tsx
│   │   ├── LiveChat.tsx
│   │   ├── LiveBattleUI.tsx
│   │   └── ...
│   ├── pages/            # Page components
│   │   ├── Home.tsx
│   │   ├── Live.tsx
│   │   ├── Profile.tsx
│   │   ├── Settings.tsx
│   │   └── ...
│   ├── lib/              # Services & utilities
│   │   ├── supabase.ts
│   │   ├── websocket.ts
│   │   ├── analytics.ts
│   │   ├── videoUpload.ts
│   │   └── ...
│   └── types/            # TypeScript definitions
├── api/                  # API endpoints
│   ├── stripe-webhook.ts
│   ├── verify-purchase.ts
│   ├── send-notification.ts
│   └── ...
├── server/               # Backend services
│   └── websocket-server.ts
├── supabase/             # Database migrations
│   ├── migrations/
│   ├── ALL_NEW_FEATURES.sql
│   ├── SECURITY_POLICIES.sql
│   └── ...
├── android/              # Android app
├── ios/                  # iOS app
└── public/               # Static assets
```

---

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run ws:server        # Start WebSocket server
npm run build            # Build for production
npm run preview          # Preview production build

# Type Checking
npm run check            # TypeScript type checking
npm run lint             # ESLint

# Testing
npm run test             # Run tests
npm run test:ui          # Test UI

# Mobile
npm run build:mobile     # Build for mobile
npx cap sync             # Sync with Capacitor
npx cap open ios         # Open iOS project
npx cap open android     # Open Android project
```

### Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL), WebSocket (ws)
- **Mobile:** Capacitor
- **Payments:** Stripe
- **Analytics:** PostHog (optional)
- **Push Notifications:** Firebase Cloud Messaging
- **Build Tool:** Vite
- **Deployment:** Vercel (frontend), Railway (WebSocket)

---

## 📚 Documentation

- **Setup Guide:** `SETUP_GUIDE.md` - Complete setup instructions
- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md` - What's built
- **Quick Reference:** `QUICK_REFERENCE.md` - Code snippets
- **Deployment Guide:** `DEPLOYMENT_GUIDE.md` - Production deployment
- **Database Setup:** `RUN_THESE_IN_ORDER.md` - Database migrations

---

## 🔐 Security

- **Row Level Security (RLS)** enabled on all tables
- **API rate limiting** to prevent abuse
- **JWT authentication** via Supabase Auth
- **Encrypted storage** for sensitive data
- **HTTPS only** in production
- **CORS protection** on API endpoints

---

## 🌍 Deployment

See `DEPLOYMENT_GUIDE.md` for complete deployment instructions.

**Quick Deploy:**
- Frontend: `vercel --prod`
- WebSocket: Deploy to Railway/Render
- Mobile: Submit to App Store/Play Store

---

## 📊 Key Features Detail

### Live Battles
Two streamers compete for gifts. Features include:
- Real-time score tracking
- Battle timer (1-10 minutes)
- Power-up boosters (2x multiplier, steal points, freeze)
- Winner announcement
- Automatic rewards distribution

### Virtual Gifts
Users can send animated gifts:
- Small gifts: Roses, hearts, stars (10-50 coins)
- Large gifts: Full-screen animations (100-5000 coins)
- Gift animations overlay on stream
- Creator earns diamonds (convertible to real money)

### Coin System
- Users buy coins with real money
- Coins used for gifts and boosters
- Creators earn diamonds from gifts
- Transparent wallet with transaction history

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📝 License

This project is licensed under the MIT License.

---

## 🆘 Support

- **Documentation:** Check docs in `/docs` folder
- **Issues:** Open an issue on GitHub
- **Email:** support@elixstar.com (example)

---

## 🎯 Roadmap

- [ ] AI content moderation
- [ ] Live stream recording/replay
- [ ] Multi-streaming to other platforms
- [ ] NFT collectibles
- [ ] Advanced analytics dashboard
- [ ] Creator monetization tools

---

**Built with ❤️ by the Elix Star Team**
