import { createClient } from '@supabase/supabase-js';

const runtimeEnv = (globalThis as any).__ENV as Record<string, string> | undefined;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || runtimeEnv?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || runtimeEnv?.VITE_SUPABASE_ANON_KEY;
const disableSupabase =
  import.meta.env.VITE_DISABLE_SUPABASE === 'true' ||
  runtimeEnv?.VITE_DISABLE_SUPABASE === 'true';

const isValidSupabaseConfig = (url?: string, key?: string) => {
  if (!url || !key) return false;
  if (url.includes('placeholder') || key.includes('placeholder')) return false;
  if (url.includes('your-') || key.includes('your-')) return false;
  if (url === 'https://test-12345.supabase.co') return false;
  return true;
};

if (disableSupabase) {
  console.warn('Supabase is disabled via VITE_DISABLE_SUPABASE=true');
} else if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Prefer localStorage so app works in browser; Capacitor apps can switch to Preferences if needed
const storage = {
  getItem: (key: string) => {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    } catch { return null; }
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch {}
  },
  removeItem: (key: string) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {}
  },
};

type DisabledResult = { data: null; error: { message: string } };

function createDisabledQuery(message: string) {
  const base: any = {
    then: (resolve: (v: any) => void) => resolve({ data: null, error: { message } } satisfies DisabledResult),
  };
  return new Proxy(base, {
    get: (_t, prop) => {
      if (prop === 'then') return base.then;
      return () => createDisabledQuery(message);
    },
  });
}

function createDisabledSupabase(message: string) {
  return {
    auth: {
      async getSession() {
        return { data: { session: null }, error: null };
      },
      async getUser() {
        return { data: { user: null }, error: null };
      },
      async signInWithPassword() {
        return { data: { user: null, session: null }, error: { message } };
      },
      async signUp() {
        return { data: { user: null, session: null }, error: { message } };
      },
      async resend() {
        return { data: null, error: { message } };
      },
      async signOut() {
        return { error: null };
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    from() {
      return createDisabledQuery(message);
    },
    storage: {
      from() {
        return createDisabledQuery(message);
      },
      async listBuckets() {
        return { data: null, error: { message } };
      },
    },
    rpc() {
      return createDisabledQuery(message);
    },
    channel() {
      return createDisabledQuery(message);
    },
    removeChannel() {},
    removeAllChannels() {},
  } as any;
}

const canUseSupabase = !disableSupabase && isValidSupabaseConfig(supabaseUrl, supabaseAnonKey);

export const supabase = canUseSupabase
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createDisabledSupabase('Supabase is not configured.');

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  hasValidConfig: canUseSupabase,
};

/**
 * Check Supabase connection: env vars + reachability.
 * Returns { ok: true } or { ok: false, message: string }.
 */
export async function checkSupabaseConnection(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, message: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env' };
  }
  if (!isValidSupabaseConfig(supabaseUrl, supabaseAnonKey)) {
    return { ok: false, message: 'Supabase URL or key look like placeholders. Update .env with real values.' };
  }
  try {
    const { error } = await supabase.auth.getSession();
    if (error) {
      return { ok: false, message: 'Supabase reachable but auth error: ' + (error.message || String(error)) };
    }
    return { ok: true };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
      return { ok: false, message: 'Network error: cannot reach Supabase. Check URL and internet.' };
    }
    return { ok: false, message: 'Connection failed: ' + msg };
  }
}
