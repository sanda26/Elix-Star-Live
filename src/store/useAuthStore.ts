import { create } from 'zustand';
import { noopClient, noopConfig } from '../lib/noopClient';

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  avatar: string;
  level: number;
  isVerified?: boolean;
  followers: number;
  following: number;
  joinedDate: string;
}

interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  email_confirmed_at?: string;
  created_at?: string;
}

/** Minimal type for auth session when backend auth is not configured. */
interface AuthSession {
  user: AuthUser | null;
  access_token?: string;
}

type AuthMode = 'client';

interface AuthStore {
  user: User | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  backendUser: AuthUser | null;
  isLoading: boolean;
  authMode: AuthMode;
  
  // Actions
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
    username?: string
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  resendSignupConfirmation: (email: string) => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  getCurrentUser: () => User | null;
  checkUser: () => Promise<void>;
}

let authUnsubscribe: (() => void) | null = null;

function mapUserToUser(backendUser: AuthUser | null): User | null {
  if (!backendUser || backendUser.id == null) return null;
  const meta = (backendUser.user_metadata || {}) as Record<string, unknown>;
  const email = typeof backendUser.email === 'string' ? backendUser.email : '';
  const usernameFromMeta = typeof meta.username === 'string' ? meta.username : undefined;
  const fullNameFromMeta = typeof meta.full_name === 'string' ? meta.full_name : undefined;
  const avatarFromMeta = typeof meta.avatar_url === 'string' ? meta.avatar_url : undefined;
  const fallbackUsername = email ? email.split('@')[0] : 'user';
  const rawLevel = meta.level;
  const levelFromMeta =
    typeof rawLevel === 'number'
      ? rawLevel
      : typeof rawLevel === 'string'
        ? Number(rawLevel)
        : NaN;
  const level = Number.isFinite(levelFromMeta) && levelFromMeta > 0 ? Math.floor(levelFromMeta) : 1;

  return {
    id: String(backendUser.id),
    username: (usernameFromMeta ?? fallbackUsername) as string,
    name: (fullNameFromMeta ?? usernameFromMeta ?? fallbackUsername) as string,
    email,
    avatar: avatarFromMeta ?? `https://ui-avatars.com/api/?name=${encodeURIComponent((usernameFromMeta ?? fallbackUsername) as string)}&background=random`,
    level,
    isVerified: !!backendUser.email_confirmed_at,
    followers: 0,
    following: 0,
    joinedDate: backendUser.created_at ?? ''
  };
}

async function enrichUserWithProfile(user: User): Promise<User> {
  try {
    const { data: profile } = await noopClient
      .from('profiles')
      .select('username, display_name, avatar_url, bio, website')
      .eq('user_id', user.id)
      .single();

    const { count: followersCount } = await noopClient
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', user.id);

    const { count: followingCount } = await noopClient
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', user.id);

    return {
      ...user,
      username: profile?.username || user.username,
      name: profile?.display_name || user.name,
      avatar: profile?.avatar_url || user.avatar,
      followers: followersCount ?? 0,
      following: followingCount ?? 0,
    };
  } catch {
    return user;
  }
}

const getAuthErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    const m = error.message.toLowerCase();
    if (
      m.includes('load failed') ||
      m.includes('failed to fetch') ||
      m.includes('network request failed') ||
      m.includes('the internet connection appears to be offline')
    ) {
      return 'Network error. Please check your connection and try again.';
    }
    return error.message;
  }
  if (typeof error === 'string') return error;

  return `Authentication failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`;
};

export const useAuthStore = create<AuthStore>()(
  (set, get) => ({
    user: null,
    session: null,
    isAuthenticated: false,
    backendUser: null,
    isLoading: true,
    authMode: 'client',

    signInWithPassword: async (email, password) => {
      // 1. Basic validation
      if (!email || !password) {
        return { error: 'Please enter both email and password.' };
      }

      const apiBase = import.meta.env.VITE_API_URL || '';

      try {
        const res = await fetch(`${apiBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: email.trim(), password }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const message: string = data?.error || data?.message || 'Login failed. Please try again.';
          if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('credentials')) {
            return { error: 'Incorrect email or password.' };
          }
          if (message.toLowerCase().includes('confirm')) {
            return { error: 'Please verify your email address before logging in.' };
          }
          return { error: message };
        }

        const backendUser: AuthUser | null = data.user ?? null;
        const accessToken: string | undefined = data.session?.accessToken ?? data.session?.access_token;

        if (!backendUser || !accessToken) {
          return { error: 'Login failed unexpectedly. Please try again.' };
        }

        const mapped = mapUserToUser(backendUser);

        set({
          backendUser,
          session: { user: backendUser, access_token: accessToken },
          user: mapped,
          isAuthenticated: true,
          isLoading: false,
          authMode: 'client',
        });

        return { error: null };
      } catch (err: any) {
        const msg = (err?.message || 'Unknown error occurred') as string;
        if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) {
          return { error: 'Network error. Please check your connection.' };
        }
        if (err.name === 'AbortError' || msg.toLowerCase().includes('aborted')) {
          return { error: 'aborted' };
        }
        return { error: msg };
      }
    },

    signUpWithPassword: async (email, password, username) => {
      const apiBase = import.meta.env.VITE_API_URL || '';
      try {
        const res = await fetch(`${apiBase}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: email.trim(),
            password,
            username: username || email.split('@')[0],
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const message: string = data?.error || data?.message || 'Signup failed. Please try again.';
          if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network')) {
            return { error: 'Network error. Please check your connection.', needsEmailConfirmation: false };
          }
          // If backend indicates email confirmation is required, surface that
          if (data?.needsEmailConfirmation) {
            return { error: null, needsEmailConfirmation: true };
          }
          return { error: message, needsEmailConfirmation: false };
        }

        const backendUser: AuthUser | null = data.user ?? null;
        const accessToken: string | undefined = data.session?.accessToken ?? data.session?.access_token;

        if (backendUser && accessToken) {
          const mapped = mapUserToUser(backendUser);
          set({
            backendUser,
            session: { user: backendUser, access_token: accessToken },
            user: mapped,
            isAuthenticated: true,
            isLoading: false,
            authMode: 'client',
          });
          return { error: null, needsEmailConfirmation: false };
        }

        if (backendUser && !accessToken) {
          // Likely "check your email to confirm"
          return { error: null, needsEmailConfirmation: true };
        }

        return { error: 'Signup failed (No user data returned). Please try again.', needsEmailConfirmation: false };
      } catch (err: any) {
        const msg = (err?.message || 'Unknown error occurred') as string;
        if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) {
          return { error: 'Network error. Please check your connection.', needsEmailConfirmation: false };
        }
        if (err.name === 'AbortError' || msg.toLowerCase().includes('aborted')) {
          return { error: 'aborted', needsEmailConfirmation: false };
        }
        return { error: msg, needsEmailConfirmation: false };
      }
    },

    resendSignupConfirmation: async (email) => {
      const apiBase = import.meta.env.VITE_API_URL || '';
      try {
        const res = await fetch(`${apiBase}/api/auth/resend-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { error: data?.error || data?.message || 'Failed to resend confirmation email.' };
        }
        return { error: null };
      } catch (error) {
        return { error: getAuthErrorMessage(error) };
      }
    },

    signInWithApple: async () => {
      const apiBase = import.meta.env.VITE_API_URL || '';
      try {
        const res = await fetch(`${apiBase}/api/auth/apple/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ redirectTo: window.location.origin + '/auth/callback' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { error: data?.error || data?.message || 'Apple sign-in failed.' };
        }
        if (data?.url) {
          window.location.href = data.url;
          return { error: null };
        }
        return { error: null };
      } catch (error) {
        return { error: getAuthErrorMessage(error) };
      }
    },

    signOut: async () => {
      const apiBase = import.meta.env.VITE_API_URL || '';
      try {
        await fetch(`${apiBase}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
      } catch {
        // ignore network errors on logout
      }
      set({
        session: null,
        user: null,
        backendUser: null,
        isAuthenticated: false,
        isLoading: false,
        authMode: 'client'
      });
    },

    updateUser: (updates) =>
      set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      })),

    getCurrentUser: () => get().user,

    checkUser: async () => {
      const apiBase = (import.meta.env.VITE_API_URL ?? '').toString().trim();
      const url = apiBase ? `${apiBase.replace(/\/$/, '')}/api/auth/me` : '/api/auth/me';
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!res.ok) {
          set({ backendUser: null, session: null, user: null, isAuthenticated: false, isLoading: false, authMode: 'client' });
          return;
        }

        let data: Record<string, unknown> = {};
        try {
          const text = await res.text();
          if (text) data = JSON.parse(text) as Record<string, unknown>;
        } catch {
          set({ backendUser: null, session: null, user: null, isAuthenticated: false, isLoading: false, authMode: 'client' });
          return;
        }

        const backendUser = data.user as AuthUser | null | undefined;
        const sessionObj = data.session as { accessToken?: string; access_token?: string } | null | undefined;
        const accessToken = sessionObj?.accessToken ?? sessionObj?.access_token;

        if (!backendUser || typeof backendUser.id !== 'string') {
          set({ backendUser: null, session: null, user: null, isAuthenticated: false, isLoading: false, authMode: 'client' });
          return;
        }

        const mapped = mapUserToUser(backendUser);
        let userToSet = mapped;
        if (mapped) {
          try {
            userToSet = await enrichUserWithProfile(mapped) ?? mapped;
          } catch {
            userToSet = mapped;
          }
        }

        set({
          backendUser,
          session: accessToken ? { user: backendUser, access_token: String(accessToken) } : null,
          user: userToSet,
          isAuthenticated: true,
          isLoading: false,
          authMode: 'client',
        });
      } catch {
        set({ backendUser: null, session: null, user: null, isAuthenticated: false, isLoading: false, authMode: 'client' });
      }
    }
  })
);
