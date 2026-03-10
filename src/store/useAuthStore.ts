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

/** Minimal type for auth session when backend auth is not configured. */
interface AuthSession {
  user: AuthUser | null;
}
interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  email_confirmed_at?: string;
  created_at?: string;
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
  if (!backendUser) return null;
  const meta = (backendUser.user_metadata || {}) as Record<string, unknown>;
  const email = backendUser.email || '';
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
    id: backendUser.id,
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

      if (!noopConfig.hasValidConfig) {
        return { error: 'System error: Authentication not configured.' };
      }

      try {

        const { data, error } = await noopClient.auth.signInWithPassword({ 
          email: email.trim(), 
          password 
        });

        if (error) {

          // 2. Map common auth errors to user-friendly messages
          if (error.message.includes('Invalid login credentials')) {
             return { error: 'Incorrect email or password.' };
          }
          if (error.message.includes('Email not confirmed')) {
             return { error: 'Please verify your email address before logging in.' };
          }
          if (error.message.includes('Failed to fetch')) {
             return { error: 'Connection failed. Please check your internet or try again later.' };
          }
          return { error: error.message };
        }

        if (!data.user || !data.session) {

          return { error: 'Login failed unexpectedly. Please try again.' };
        }


        
        // 3. Force state update immediately
        set({ 
          backendUser: data.user, 
          session: data.session, 
          user: mapUserToUser(data.user), 
          isAuthenticated: true, 
          isLoading: false, 
          authMode: 'client' 
        });
        
        return { error: null };
      } catch (err: any) {

        const msg = err?.message || 'Unknown error occurred';
        if (msg.includes('fetch')) {
           return { error: 'Network error. Please check your connection.' };
        }
        // Handle AbortError specifically
        if (err.name === 'AbortError' || msg.includes('aborted')) {

           // Return a specific error code or message that UI can ignore or handle gracefully
           return { error: 'aborted' }; 
        }
        return { error: msg };
      }
    },

    signUpWithPassword: async (email, password, username) => {
      if (!noopConfig.hasValidConfig) {
        return { error: 'Authentication not configured.', needsEmailConfirmation: false };
      }
      try {

        const { data, error } = await noopClient.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: username || email.split('@')[0],
              full_name: username,
              avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(username || '')}&background=random`,
            },
          },
        });

        if (error) {

          if (error.message.includes('fetch')) {
             return { error: 'Network error. Please check your connection.', needsEmailConfirmation: false };
          }
          return { error: error.message, needsEmailConfirmation: false };
        }

        if (data.user && data.session) {

          set({ 
            backendUser: data.user, 
            session: data.session, 
            user: mapUserToUser(data.user), 
            isAuthenticated: true, 
            isLoading: false, 
            authMode: 'client' 
          });
          return { error: null, needsEmailConfirmation: false };
        }
        
        // If backend returned user but no session, email confirmation is likely required
        if (data.user && !data.session) {

           return { error: null, needsEmailConfirmation: true };
        }

        return { error: 'Signup failed (No user data returned). Please try again.', needsEmailConfirmation: false };
      } catch (err: any) {

        const msg = err?.message || 'Unknown error occurred';
        
        if (msg.includes('fetch')) {
           return { error: 'Network error. Please check your connection.', needsEmailConfirmation: false };
        }
        if (err.name === 'AbortError' || msg.includes('aborted')) {

           return { error: 'aborted', needsEmailConfirmation: false }; 
        }

        return { error: msg, needsEmailConfirmation: false };
      }
    },

    resendSignupConfirmation: async (email) => {
      if (!noopConfig.hasValidConfig) {
        return { error: 'Authentication is not configured.' };
      }
      try {
        const { error } = await noopClient.auth.resend({ type: 'signup', email });
        if (error) return { error: error.message };
        return { error: null };
      } catch (error) {
        return { error: getAuthErrorMessage(error) };
      }
    },

    signInWithApple: async () => {
      if (!noopConfig.hasValidConfig) {
        return { error: 'Authentication is not configured.' };
      }
      try {
        const { error } = await noopClient.auth.signInWithOAuth({
          provider: 'apple',
          options: {
            redirectTo: window.location.origin + '/auth/callback',
          },
        });
        if (error) return { error: error.message };
        return { error: null };
      } catch (error) {
        return { error: getAuthErrorMessage(error) };
      }
    },

    signOut: async () => {
      if (noopConfig.hasValidConfig) {
        try {
          await noopClient.auth.signOut();
        } catch (error) {
          /* ignored */
        }
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
      if (!noopConfig.hasValidConfig) {
        set({ backendUser: null, session: null, user: null, isAuthenticated: false, isLoading: false, authMode: 'client' });
        return;
      }
      
      try {
        const { data: { session } } = await noopClient.auth.getSession();
        if (session?.user) {
          const mapped = mapUserToUser(session.user);
          if (mapped) {
            const enriched = await enrichUserWithProfile(mapped);
            set({ backendUser: session.user, session, user: enriched, isAuthenticated: true, isLoading: false, authMode: 'client' });
          } else {
            set({ backendUser: session.user, session, user: mapped, isAuthenticated: true, isLoading: false, authMode: 'client' });
          }
        } else {
           set({ backendUser: null, session: null, user: null, isAuthenticated: false, isLoading: false, authMode: 'client' });
        }
      } catch (error) {

        set({ isLoading: false });
      }

      if (!authUnsubscribe) {
        const { data: { subscription } } = noopClient.auth.onAuthStateChange(async (event, session) => {

          const user = session?.user;
          if (user) {
            const mapped = mapUserToUser(user);
            if (mapped) {
              const enriched = await enrichUserWithProfile(mapped);
              set({ backendUser: user, session, user: enriched, isAuthenticated: true, isLoading: false, authMode: 'client' });
            } else {
              set({ backendUser: user, session, user: mapped, isAuthenticated: true, isLoading: false, authMode: 'client' });
            }
            return;
          }
          
          set({ backendUser: null, session: null, user: null, isAuthenticated: false, isLoading: false, authMode: 'client' });
        });
        authUnsubscribe = subscription.unsubscribe;
      }
    }
  })
);
