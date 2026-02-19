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
  checkUser: () => Promise<void>;
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

async function enrichUserWithProfile(user: User): Promise<User> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url, bio, website')
      .eq('user_id', user.id)
      .single();

    const { count: followersCount } = await supabase
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', user.id);

    const { count: followingCount } = await supabase
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
      // 1. Basic validation
      if (!email || !password) {
        return { error: 'Please enter both email and password.' };
      }

      if (!supabaseConfig.hasValidConfig) {
        return { error: 'System error: Authentication not configured.' };
      }

      try {
        console.log('Attempting login for:', email);
        const { data, error } = await supabase.auth.signInWithPassword({ 
          email: email.trim(), 
          password 
        });

        if (error) {
          console.error('Supabase Login Error:', error);
          // 2. Map common Supabase errors to user-friendly messages
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
          console.error('Login succeeded but no session returned', data);
          return { error: 'Login failed unexpectedly. Please try again.' };
        }

        console.log('Login successful, setting user:', data.user.id);
        
        // 3. Force state update immediately
        set({ 
          supabaseUser: data.user, 
          session: data.session, 
          user: mapUserToUser(data.user), 
          isAuthenticated: true, 
          isLoading: false, 
          authMode: 'supabase' 
        });
        
        return { error: null };
      } catch (err: any) {
        console.error('Unexpected Login Exception:', err);
        const msg = err?.message || 'Unknown error occurred';
        if (msg.includes('fetch')) {
           return { error: 'Network error. Please check your connection.' };
        }
        // Handle AbortError specifically
        if (err.name === 'AbortError' || msg.includes('aborted')) {
           console.warn('Login request aborted');
           // Return a specific error code or message that UI can ignore or handle gracefully
           return { error: 'aborted' }; 
        }
        return { error: msg };
      }
    },

    signUpWithPassword: async (email, password, username) => {
      if (!supabaseConfig.hasValidConfig) {
        return { error: 'Authentication is not configured. Missing Supabase credentials.', needsEmailConfirmation: false };
      }
      try {
        console.log('Attempting signup for:', email);
        const { data, error } = await supabase.auth.signUp({
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
          console.error('Supabase Signup Error:', error);
          if (error.message.includes('fetch')) {
             return { error: 'Network error. Please check your connection.', needsEmailConfirmation: false };
          }
          return { error: error.message, needsEmailConfirmation: false };
        }

        if (data.user && data.session) {
          console.log('Signup successful (session active):', data.user.id);
          set({ 
            supabaseUser: data.user, 
            session: data.session, 
            user: mapUserToUser(data.user), 
            isAuthenticated: true, 
            isLoading: false, 
            authMode: 'supabase' 
          });
          return { error: null, needsEmailConfirmation: false };
        }
        
        // If Supabase returned user but no session, email confirmation is likely required
        if (data.user && !data.session) {
           console.log('Signup successful (waiting for confirmation):', data.user.id);
           return { error: null, needsEmailConfirmation: true };
        }

        return { error: 'Signup failed (No user data returned). Please try again.', needsEmailConfirmation: false };
      } catch (err: any) {
        console.error('Unexpected Signup Exception:', err);
        const msg = err?.message || 'Unknown error occurred';
        
        if (msg.includes('fetch')) {
           return { error: 'Network error. Please check your connection.', needsEmailConfirmation: false };
        }
        if (err.name === 'AbortError' || msg.includes('aborted')) {
           console.warn('Signup request aborted');
           return { error: 'aborted', needsEmailConfirmation: false }; 
        }

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

    checkUser: async () => {
      if (!supabaseConfig.hasValidConfig) {
        set({ supabaseUser: null, session: null, user: null, isAuthenticated: false, isLoading: false, authMode: 'supabase' });
        return;
      }
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const mapped = mapUserToUser(session.user);
          if (mapped) {
            const enriched = await enrichUserWithProfile(mapped);
            set({ supabaseUser: session.user, session, user: enriched, isAuthenticated: true, isLoading: false, authMode: 'supabase' });
          } else {
            set({ supabaseUser: session.user, session, user: mapped, isAuthenticated: true, isLoading: false, authMode: 'supabase' });
          }
        } else {
           set({ supabaseUser: null, session: null, user: null, isAuthenticated: false, isLoading: false, authMode: 'supabase' });
        }
      } catch (error) {
        console.error('getSession error:', error);
        set({ isLoading: false });
      }

      if (!authUnsubscribe) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('Auth state change:', event, session?.user?.id);
          const user = session?.user;
          if (user) {
            const mapped = mapUserToUser(user);
            if (mapped) {
              const enriched = await enrichUserWithProfile(mapped);
              set({ supabaseUser: user, session, user: enriched, isAuthenticated: true, isLoading: false, authMode: 'supabase' });
            } else {
              set({ supabaseUser: user, session, user: mapped, isAuthenticated: true, isLoading: false, authMode: 'supabase' });
            }
            return;
          }
          
          set({ supabaseUser: null, session: null, user: null, isAuthenticated: false, isLoading: false, authMode: 'supabase' });
        });
        authUnsubscribe = subscription.unsubscribe;
      }
    }
  })
);
