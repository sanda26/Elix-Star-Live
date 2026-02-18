import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidSupabaseConfig = (url?: string, key?: string) => {
  if (!url || !key) return false;
  if (url.includes('placeholder') || key.includes('placeholder')) return false;
  if (url.includes('your-') || key.includes('your-')) return false;
  if (url === 'https://test-12345.supabase.co') return false;
  return true;
};

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase URL or Anon Key. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

// Prefer localStorage so app works in browser; Capacitor apps can switch to Preferences if needed
const storage = {
  getItem: async (key: string) => (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null),
  setItem: async (key: string, value: string) => { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); },
  removeItem: async (key: string) => { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); },
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  hasValidConfig: isValidSupabaseConfig(supabaseUrl, supabaseAnonKey),
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
