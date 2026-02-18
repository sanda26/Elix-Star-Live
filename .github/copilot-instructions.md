# cSpell:ignore Elix Vite

# AI Coding Agent Instructions for Elix Star

## Architecture Overview
This is a real-time social video platform with live streaming, battles, and virtual gifts. Built with React 18 + TypeScript + Vite frontend, Supabase (PostgreSQL) backend, Agora RTC for streaming, and Stripe for payments. See [ARCHITECTURE.md](../ARCHITECTURE.md) for full details.

## Critical Rules
- **NEVER remove working code or mock data** - Mock fallbacks in [src/lib/mockApi.ts](src/lib/mockApi.ts) are intentional for offline/dev states
- **NO invisible/fake UI elements** - All interactive elements must be real, clickable code
- **NO brand references** - Avoid TikTok/competitor mentions
- **MVP stability first** - Propose changes before implementing; prioritize stability over optimization
- **Apple App Store compliance** - Always include user moderation (report/block) and account control (delete account) features

## State Management
Use Zustand exclusively for global state. Examples:
- Auth: [../src/store/useAuthStore.ts](../src/store/useAuthStore.ts)
- Wallet: [src/store/useWalletStore.ts](src/store/useWalletStore.ts)

## API Patterns
- Primary backend: Supabase with Row Level Security (RLS)
- Graceful fallback: Always fall back to mock data on API failures
- Real-time: WebSocket server in [server/index.ts](server/index.ts) for live features

## Development Workflow
- **Frontend dev**: `npm run dev` (Vite dev server)
- **Backend dev**: `npm run ws:server` (WebSocket server on port 8080)
- **Build**: `npm run build` (Vite production build)
- **Test**: `npm run test` (Vitest)
- **Mobile**: `npm run cap:sync` then `npm run cap:open ios/android`

## Key Conventions
- **Components**: Functional with hooks, styled with Tailwind CSS + Lucide icons
- **Navigation**: React Router with lazy-loaded pages for code splitting
- **Error handling**: Error boundaries and try/catch with user-friendly fallbacks
- **Analytics**: Integrated PostHog for event tracking
- **Push notifications**: Firebase Cloud Messaging via Capacitor

## Integration Points
- **Supabase**: Database, auth, storage, realtime subscriptions
- **Agora**: Live streaming and RTM messaging
- **Stripe**: Coin purchases and webhooks
- **WebSocket**: Custom server for real-time battles and chat
- **Capacitor**: Cross-platform mobile deployment

## Deployment
- Frontend: Vercel/Netlify
- Backend: Railway/DigitalOcean App Platform
- Mobile: App Store/Play Store via Capacitor
- See [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) for complete steps

## Security & Compliance
- JWT auth via Supabase
- RLS policies on all database tables
- HTTPS required in production
- User data export/deletion for GDPR compliance

## Common Pitfalls
- API_BASE_URL must be a real deployed URL (not placeholders)
- WebSocket connections require WSS in production
- Mock data is NOT for production - ensure live API fallbacks work
- Test on actual devices for mobile features