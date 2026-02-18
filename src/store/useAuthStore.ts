import { create } from 'zustand';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase, supabaseConfig } from '../lib/supabase';

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

type AuthMode = 'supabase';

interface AuthStore {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  supabaseUser: SupabaseUser | null;
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
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  getCurrentUser: () => User | null;
  checkUser: () => void;
}

let authUnsubscribe: (() => void) | null = null;

function mapUserToUser(supabaseUser: SupabaseUser | null): User | null {
  if (!supabaseUser) return null;
  const meta = supabaseUser.user_metadata || {};
  const email = supabaseUser.email || '';
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
    id: supabaseUser.id,
    username: usernameFromMeta ?? fallbackUsername,
    name: fullNameFromMeta ?? usernameFromMeta ?? fallbackUsername,
    email,
    avatar: avatarFromMeta ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(usernameFromMeta ?? fallbackUsername)}&background=random`,
    level,
    isVerified: !!supabaseUser.email_confirmed_at,
    followers: 0,
    following: 0,
    joinedDate: supabaseUser.created_at
  };
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
  console.error('Unknown auth error:', error);
  return `Authentication failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`;
};

export const useAuthStore = create<AuthStore>()(
  (set, get) => ({
    user: null,
    session: null,
    isAuthenticated: false,
    supabaseUser: null,
    isLoading: true,
    authMode: 'supabase',

    signInWithPassword: async (email, password) => {
      if (!supabaseConfig.hasValidConfig) {
        return { error: 'Authentication is not configured. Missing Supabase credentials.' };
      }
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          return { error: error.message };
        }
        const user = data.user;
        const session = data.session;
        if (!user) {
          return { error: 'No user returned from Supabase.' };
        }
        set({ supabaseUser: user, session, user: mapUserToUser(user), isAuthenticated: true, isLoading: false, authMode: 'supabase' });
        return { error: null };
      } catch (error) {
        const msg = getAuthErrorMessage(error);
        return { error: msg };
      }
    },

    signUpWithPassword: async (email, password, username) => {
      if (!supabaseConfig.hasValidConfig) {
        return { error: 'Authentication is not configured. Missing Supabase credentials.', needsEmailConfirmation: false };
      }
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username || email.split('@')[0],
              avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(username || '')}&background=random`,
              full_name: username,
            },
          },
        });
        if (error) {
          return { error: error.message, needsEmailConfirmation: false };
        }
        if (data.user && data.session) {
          set({ supabaseUser: data.user, session: data.session, user: mapUserToUser(data.user), isAuthenticated: true, isLoading: false, authMode: 'supabase' });
          return { error: null, needsEmailConfirmation: false };
        }
        
        // If Supabase returned user but no session, email confirmation is likely required
        if (data.user && !data.session) {
           return { error: null, needsEmailConfirmation: true };
        }

        return { error: 'Signup failed (No user data returned). Please try again.', needsEmailConfirmation: false };
      } catch (error) {
        const msg = getAuthErrorMessage(error);
        return { error: msg, needsEmailConfirmation: false };
      }
    },

    resendSignupConfirmation: async (email) => {
      if (!supabaseConfig.hasValidConfig) {
        return { error: 'Authentication is not configured.' };
      }
      try {
        const { error } = await supabase.auth.resend({ type: 'signup', email });
        if (error) return { error: error.message };
        return { error: null };
      } catch (error) {
        return { error: getAuthErrorMessage(error) };
      }
    },

    signOut: async () => {
      if (supabaseConfig.hasValidConfig) {
        try {
          await supabase.auth.signOut();
        } catch (error) {
          console.warn('Supabase signOut failed (network error?), clearing local session anyway.', error);
        }
      }
      set({
        session: null,
        user: null,
        supabaseUser: null,
        isAuthenticated: false,
        isLoading: false,
        authMode: 'supabase'
      });
    },

    updateUser: (updates) =>
      set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      })),

    getCurrentUser: () => get().user,

    checkUser: () => {
      if (!supabaseConfig.hasValidConfig) {
        set({ supabaseUser: null, session: null, user: null, isAuthenticated: false, isLoading: false, authMode: 'supabase' });
        return;
      }
      if (!authUnsubscribe) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          const user = session?.user;
          if (user) {
            set({ supabaseUser: user, session, user: mapUserToUser(user), isAuthenticated: true, isLoading: false, authMode: 'supabase' });
            return;
          }
          set({ supabaseUser: null, session: null, user: null, isAuthenticated: false, isLoading: false, authMode: 'supabase' });
        });
        authUnsubscribe = subscription.unsubscribe;
      }
    }
  })
);
