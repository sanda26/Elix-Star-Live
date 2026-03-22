import React, { useEffect, Suspense, lazy } from "react";
import {
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { BottomNav } from "./components/BottomNav";
import { TopNav } from "./components/TopNav";
import { useAuthStore } from "./store/useAuthStore";
import { cn } from "./lib/utils";
import { useDeepLinks } from "./lib/deepLinks";
import { analytics } from "./lib/analytics";
import { notificationService } from "./lib/notifications";
import { initializeIAP } from "./lib/iap";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OfflineBanner } from "./components/OfflineBanner";
import { IncomingCallModal } from "./components/IncomingCallModal";
import { subscribeToIncomingCalls } from "./lib/callService";
import { websocket } from "./lib/websocket";

// Lazy-loaded page components for code splitting
const VideoFeed = lazy(() => import("./pages/VideoFeed"));
const StemFeed = lazy(() => import("./pages/StemFeed"));
const LiveStream = lazy(() => import("./pages/LiveStream"));
const LiveDiscover = lazy(() => import("./pages/LiveDiscover"));
const Profile = lazy(() => import("./pages/Profile"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
import Upload from "./pages/Upload";
const Create = lazy(() => import("./pages/Create"));
const SavedVideos = lazy(() => import("./pages/SavedVideos"));
const MusicFeed = lazy(() => import("./pages/MusicFeed"));
const FollowingFeed = lazy(() => import("./pages/FollowingFeed"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const VideoView = lazy(() => import("./pages/VideoView"));
const Inbox = lazy(() => import("./pages/Inbox"));
const ChatThread = lazy(() => import("./pages/ChatThread"));
const FriendsFeed = lazy(() => import("./pages/FriendsFeed"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const Settings = lazy(() => import("./pages/Settings"));
const CreatorLoginDetails = lazy(() => import("./pages/CreatorLoginDetails"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Copyright = lazy(() => import("./pages/Copyright"));
const Legal = lazy(() => import("./pages/Legal"));
const LegalAudio = lazy(() => import("./pages/LegalAudio"));
const LegalUGC = lazy(() => import("./pages/LegalUGC"));
const LegalAffiliate = lazy(() => import("./pages/LegalAffiliate"));
const LegalDMCA = lazy(() => import("./pages/LegalDMCA"));
const LegalSafety = lazy(() => import("./pages/LegalSafety"));
const RequireAuth = lazy(() => import("./components/RequireAuth"));
const RequireAdmin = lazy(() => import("./components/RequireAdmin"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Discover = lazy(() => import("./pages/Discover"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AdminEconomy = lazy(() => import("./pages/admin/Economy"));
const Hashtag = lazy(() => import("./pages/Hashtag"));
const BlockedAccounts = lazy(() => import("./pages/settings/BlockedAccounts"));
const SafetyCenter = lazy(() => import("./pages/settings/SafetyCenter"));
const PurchaseCoins = lazy(() => import("./pages/PurchaseCoins"));
const Shop = lazy(() => import("./pages/Shop"));
const Report = lazy(() => import("./pages/Report"));
const Support = lazy(() => import("./pages/Support"));
const Guidelines = lazy(() => import("./pages/Guidelines"));
const VideoCall = lazy(() => import("./pages/VideoCall"));
const AIStudio = lazy(() => import("./pages/AIStudio"));
const SpectatorPage = lazy(() => import("./pages/SpectatorPage"));

function LiveStreamKeyed() {
  const loc = useLocation();
  return <LiveStream key={loc.pathname + loc.search} />;
}

function LiveStreamGuard() {
  const loc = useLocation();
  const { user } = useAuthStore();
  const params = (loc.pathname.match(/^\/live\/(.+)/) || [])[1];
  const isBattleJoin = loc.search.includes("battle=1");
  // If the current user is the owner of this live (their own user id or /live/broadcast),
  // keep them on the LiveStream page. Everyone else is redirected to Spectator (watch),
  // except explicit battle joiners.
  if (
    params &&
    params !== "broadcast" &&
    params !== "start" &&
    params !== "watch" &&
    params !== user?.id &&
    !isBattleJoin
  ) {
    return <Navigate to={`/watch/${params}`} replace />;
  }
  return <LiveStreamKeyed />;
}

// Loading fallback for lazy-loaded routes
function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white p-4">
      <div className="w-16 h-16 border-4 border-secondary border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-white/70">Loading...</p>
    </div>
  );
}

function App() {
  const { checkUser, user, isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  // Initialize deep links
  useDeepLinks();

  useEffect(() => {
    checkUser();

    // Failsafe: if loading takes too long (e.g. auth hanging), force stop loading
    const timer = setTimeout(() => {
      if (useAuthStore.getState().isLoading) {
        useAuthStore.setState({ isLoading: false });
      }
    }, 3000);

    try {
      analytics.initialize();
    } catch (_) {
      /* avoid crashing app */
    }
    try {
      notificationService.initialize();
    } catch (_) {
      /* avoid crashing app */
    }
    try {
      initializeIAP();
    } catch (_) {
      /* avoid crashing app */
    }

    return () => clearTimeout(timer);
  }, [checkUser]);

  useEffect(() => {
    if (user?.id) {
      analytics.setUserId(user.id);
      const unsubCalls = subscribeToIncomingCalls(user.id);
      return () => {
        unsubCalls();
      };
    } else {
      analytics.setUserId(null);
    }
  }, [user]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        websocket.reconnectOnForeground();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Realtime DM/cohost via Node/WebSocket backend.

  const isFullScreen =
    location.pathname === "/" ||
    location.pathname === "/feed" ||
    location.pathname === "/stem" ||
    location.pathname === "/following" ||
    location.pathname === "/friends" ||
    location.pathname.startsWith("/video/");

  /* Hide bottom nav only while hosting / joining live (includes battle via ?battle=1 on /live/...) */
  const isLiveOrBattleShell =
    location.pathname === "/live" ||
    location.pathname.startsWith("/live/");
  const showBottomNav = isAuthenticated && !isLiveOrBattleShell;

  /* Inbox + DM: TopNav is hidden (only /feed shows it) — no pt-topbar or you get empty space under the status bar */
  const isInboxRoute =
    location.pathname === "/inbox" || /^\/inbox\/.+/.test(location.pathname);

  // Public routes that don't require authentication
  const isPublicRoute =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/auth/callback" ||
    location.pathname === "/terms" ||
    location.pathname === "/privacy" ||
    location.pathname === "/copyright" ||
    location.pathname === "/legal" ||
    location.pathname.startsWith("/legal/") ||
    location.pathname === "/guidelines" ||
    location.pathname === "/support" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/reset-password";

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Redirect to login if not authenticated and trying to access protected route
  if (!isAuthenticated && !isPublicRoute) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // If authenticated and on login/register, redirect to feed
  if (
    isAuthenticated &&
    (location.pathname === "/login" || location.pathname === "/register")
  ) {
    return <Navigate to="/feed" replace />;
  }

  return (
    <div className="fixed inset-0 w-full h-[100dvh] flex flex-col bg-background text-text font-sans overflow-hidden">
      <OfflineBanner />
      <IncomingCallModal />
      <TopNav />
      {/* Full-height column background (continues behind BottomNav art); main stays scrollable with pb-nav */}
      <div className="flex-1 min-h-0 w-full flex flex-col relative">
        <div
          className={cn(
            "pointer-events-none absolute inset-0 mx-auto w-full max-w-[480px] z-0",
            location.pathname === "/feed"
              ? "bg-[#0A0B0E]"
              : "bg-background",
          )}
          aria-hidden
        />
        <main
          className={cn(
            "relative z-[1] flex-1 w-full min-h-0 mx-auto max-w-[480px] overflow-auto bg-transparent",
            location.pathname === "/feed" && "bg-[#0A0B0E] pt-0",
            showBottomNav &&
              location.pathname !== "/feed" &&
              !isFullScreen &&
              !isInboxRoute &&
              "pt-topbar",
            showBottomNav &&
              location.pathname !== "/feed" &&
              !isFullScreen &&
              isInboxRoute &&
              "pt-0",
            showBottomNav &&
              location.pathname !== "/feed" &&
              isFullScreen &&
              "pt-0",
            !showBottomNav && location.pathname !== "/feed" && "pt-[3mm]",
            showBottomNav && "pb-nav",
            /* Same tone as chat column so pb-nav band is not a visible “gap” above BottomNav */
            showBottomNav && isInboxRoute && "bg-[#13151A]",
          )}
        >
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route
                path="/"
                element={
                  <Navigate to={isAuthenticated ? "/feed" : "/login"} replace />
                }
              />

              {/* PUBLIC ROUTES (no auth needed) */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/copyright" element={<Copyright />} />
              <Route path="/legal" element={<Legal />} />
              <Route path="/legal/audio" element={<LegalAudio />} />
              <Route path="/legal/ugc" element={<LegalUGC />} />
              <Route path="/legal/affiliate" element={<LegalAffiliate />} />
              <Route path="/legal/dmca" element={<LegalDMCA />} />
              <Route path="/legal/safety" element={<LegalSafety />} />
              <Route path="/guidelines" element={<Guidelines />} />
              <Route path="/support" element={<Support />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* PROTECTED ROUTES (require auth) */}
              <Route element={<RequireAuth />}>
                <Route path="/feed" element={<VideoFeed />} />
                <Route path="/stem" element={<StemFeed />} />
                <Route path="/following" element={<FollowingFeed />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/hashtag/:tag" element={<Hashtag />} />
                <Route path="/report" element={<Report />} />
                <Route path="/video/:videoId" element={<VideoView />} />
                <Route path="/live" element={<LiveDiscover />} />
                <Route path="/live/:streamId" element={<LiveStreamGuard />} />
                <Route
                  path="/live/start"
                  element={<Navigate to="/live" replace />}
                />
                <Route path="/live/broadcast" element={<LiveStreamKeyed />} />
                {/* Legacy direct URL: route any /live/watch/:streamId deep links to the viewer-only watch route */}
                <Route
                  path="/live/watch/:streamId"
                  element={<Navigate to="/watch/:streamId" replace />}
                />
                <Route path="/watch/:streamId" element={<SpectatorPage />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/friends" element={<FriendsFeed />} />
                {/* Standalone saved page; Profile has inline Saved tab. Consider linking from Profile or check 404s before removing. */}
                <Route path="/saved" element={<SavedVideos />} />
                <Route path="/music/:songId" element={<MusicFeed />} />
                <Route path="/create" element={<Create />} />
                <Route
                  path="/creator/login-details"
                  element={<CreatorLoginDetails />}
                />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/inbox/:threadId" element={<ChatThread />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/edit-profile" element={<EditProfile />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settings/blocked" element={<BlockedAccounts />} />
                <Route path="/settings/safety" element={<SafetyCenter />} />
                <Route path="/purchase-coins" element={<PurchaseCoins />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/shop/:itemId" element={<Shop />} />
                <Route path="/call" element={<VideoCall />} />
                <Route path="/ai-studio" element={<AIStudio />} />
                <Route element={<RequireAdmin />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                  <Route path="/admin/reports" element={<AdminReports />} />
                  <Route path="/admin/economy" element={<AdminEconomy />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/feed" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
        </main>
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  );
}

export default App;
