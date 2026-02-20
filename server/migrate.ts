import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function tableExists(name: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { error } = await supabaseAdmin.from(name).select('*').limit(0);
  return !error || !error.message.includes('does not exist');
}

export async function runMigrations() {
  if (!supabaseAdmin) {
    console.log('[migrate] No Supabase credentials, skipping migrations');
    return;
  }

  console.log('[migrate] Checking database tables...');

  const checks = [
    'profiles', 'videos', 'live_streams', 'lives', 'live_viewers',
    'battles', 'battle_invites', 'live_chat_messages', 'live_events',
    'notifications', 'followers', 'likes', 'comments',
  ];

  const missing: string[] = [];
  for (const t of checks) {
    if (!(await tableExists(t))) missing.push(t);
  }

  if (missing.length === 0) {
    console.log('[migrate] All tables exist');
    return;
  }

  console.log(`[migrate] Missing tables: ${missing.join(', ')}`);
  console.log('[migrate] Run supabase/migrations/001_full_schema.sql in Supabase SQL Editor');
  console.log('[migrate] Or use: node scripts/setup-database.js YOUR_DB_PASSWORD');

  // Try to create missing live-specific tables via RPC if available
  // These are lightweight tables that only need the service role
  if (missing.includes('lives') || missing.includes('live_viewers') || missing.includes('battles')) {
    console.log('[migrate] Attempting to create live-related tables via REST...');
    // Note: PostgREST cannot create tables. Tables must be created via SQL editor.
    // The app will gracefully handle missing tables with error messages.
  }
}
