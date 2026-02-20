const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_PASSWORD = process.argv[2];
if (!DB_PASSWORD) {
  console.error('\n  Usage: node scripts/setup-database.js YOUR_DATABASE_PASSWORD\n');
  console.error('  Find your DB password in Supabase Dashboard:');
  console.error('  Project Settings > Database > Connection info > Password\n');
  process.exit(1);
}

const PROJECT_REF = 'ccfgvjyvhaxkydiatobm';
const REGIONS = ['eu-west-1', 'eu-west-2', 'eu-central-1', 'us-east-1', 'ap-southeast-1'];

async function tryConnect(region) {
  const connStr = `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    const r = await client.query('SELECT current_database() as db');
    console.log(`  Connected via ${region} pooler: ${r.rows[0].db}`);
    return client;
  } catch (e) {
    try { client.end(); } catch (_) {}
    return null;
  }
}

async function tryDirectConnect() {
  const connStr = `postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres`;
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const r = await client.query('SELECT current_database() as db');
    console.log(`  Connected via direct connection: ${r.rows[0].db}`);
    return client;
  } catch (e) {
    try { client.end(); } catch (_) {}
    return null;
  }
}

async function getClient() {
  console.log('\n[1/5] Connecting to database...');

  let client = await tryDirectConnect();
  if (client) return client;

  for (const region of REGIONS) {
    client = await tryConnect(region);
    if (client) return client;
  }

  // Try session mode (port 5432)
  for (const region of REGIONS) {
    const connStr = `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
    const c = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    try {
      await c.connect();
      console.log(`  Connected via ${region} session pooler`);
      return c;
    } catch (_) {
      try { c.end(); } catch (__) {}
    }
  }

  console.error('\n  FAILED to connect to any endpoint.');
  console.error('  Check your database password is correct.');
  console.error('  Find it at: Supabase Dashboard > Project Settings > Database\n');
  process.exit(1);
}

async function runSQL(client, sql, label) {
  try {
    await client.query(sql);
    console.log(`  OK: ${label}`);
    return true;
  } catch (e) {
    if (e.message.includes('already exists') || e.message.includes('duplicate')) {
      console.log(`  SKIP: ${label} (already exists)`);
      return true;
    }
    console.error(`  FAIL: ${label} - ${e.message}`);
    return false;
  }
}

async function main() {
  const client = await getClient();

  console.log('\n[2/5] Creating extensions...');
  await runSQL(client, `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`, 'uuid-ossp extension');

  console.log('\n[3/5] Creating tables, policies, indexes...');

  const schemaPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_full_schema.sql');
  const fullSQL = fs.readFileSync(schemaPath, 'utf8');

  // Split by semicolons but be smart about it
  const statements = fullSQL
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let ok = 0, fail = 0, skip = 0;
  for (const stmt of statements) {
    const firstLine = stmt.split('\n').find(l => l.trim() && !l.trim().startsWith('--')) || stmt.substring(0, 60);
    const label = firstLine.trim().substring(0, 80);
    try {
      await client.query(stmt);
      ok++;
      // Only log CREATE/ALTER/INSERT/DROP statements
      if (/^(CREATE|ALTER|INSERT|DROP)/i.test(label)) {
        console.log(`  OK: ${label}...`);
      }
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('duplicate') || e.message.includes('already member')) {
        skip++;
      } else {
        fail++;
        console.error(`  FAIL: ${label}... -> ${e.message}`);
      }
    }
  }

  console.log(`\n  Summary: ${ok} succeeded, ${skip} skipped (already exist), ${fail} failed`);

  // Also create missing tables that the app references but might not be in the schema
  console.log('\n[4/5] Creating additional tables the app needs...');

  const extraTables = [
    {
      name: 'follows',
      sql: `CREATE TABLE IF NOT EXISTS follows (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        created_at timestamptz DEFAULT now(),
        UNIQUE(follower_id, following_id)
      )`
    },
    {
      name: 'blocks',
      sql: `CREATE TABLE IF NOT EXISTS blocks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        created_at timestamptz DEFAULT now(),
        UNIQUE(blocker_id, blocked_id)
      )`
    },
    {
      name: 'live_streams',
      sql: `CREATE TABLE IF NOT EXISTS live_streams (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        title text DEFAULT '',
        description text DEFAULT '',
        thumbnail_url text,
        is_live boolean DEFAULT false,
        viewer_count int DEFAULT 0,
        stream_key text,
        category text DEFAULT 'general',
        tags text[] DEFAULT '{}',
        started_at timestamptz,
        ended_at timestamptz,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`
    },
    {
      name: 'gifts_catalog',
      sql: `CREATE TABLE IF NOT EXISTS gifts_catalog (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name text NOT NULL,
        description text DEFAULT '',
        icon_url text,
        animation_url text,
        coin_cost int NOT NULL DEFAULT 1,
        category text DEFAULT 'standard',
        is_active boolean DEFAULT true,
        sort_order int DEFAULT 0,
        created_at timestamptz DEFAULT now()
      )`
    },
    {
      name: 'booster_catalog',
      sql: `CREATE TABLE IF NOT EXISTS booster_catalog (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name text NOT NULL,
        description text DEFAULT '',
        icon_url text,
        coin_cost int NOT NULL DEFAULT 1,
        duration_hours int DEFAULT 24,
        boost_type text DEFAULT 'visibility',
        multiplier float DEFAULT 1.5,
        is_active boolean DEFAULT true,
        created_at timestamptz DEFAULT now()
      )`
    },
    {
      name: 'user_bans',
      sql: `CREATE TABLE IF NOT EXISTS user_bans (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
        reason text DEFAULT '',
        expires_at timestamptz,
        created_at timestamptz DEFAULT now()
      )`
    },
    {
      name: 'conversations',
      sql: `CREATE TABLE IF NOT EXISTS conversations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        participant_ids uuid[] NOT NULL,
        last_message text,
        last_message_at timestamptz DEFAULT now(),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`
    },
    {
      name: 'device_tokens',
      sql: `CREATE TABLE IF NOT EXISTS device_tokens (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        token text NOT NULL,
        platform text DEFAULT 'web',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE(user_id, token)
      )`
    },
    {
      name: 'camera_filters',
      sql: `CREATE TABLE IF NOT EXISTS camera_filters (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name text NOT NULL,
        preview_url text,
        filter_data jsonb DEFAULT '{}',
        category text DEFAULT 'beauty',
        is_premium boolean DEFAULT false,
        sort_order int DEFAULT 0,
        created_at timestamptz DEFAULT now()
      )`
    },
    {
      name: 'speed_options',
      sql: `CREATE TABLE IF NOT EXISTS speed_options (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        label text NOT NULL,
        value float NOT NULL DEFAULT 1.0,
        sort_order int DEFAULT 0
      )`
    },
    {
      name: 'sticker_options',
      sql: `CREATE TABLE IF NOT EXISTS sticker_options (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name text NOT NULL,
        url text NOT NULL,
        category text DEFAULT 'fun',
        is_premium boolean DEFAULT false,
        sort_order int DEFAULT 0,
        created_at timestamptz DEFAULT now()
      )`
    },
    {
      name: 'purchases',
      sql: `CREATE TABLE IF NOT EXISTS purchases (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        product_id text NOT NULL,
        product_type text DEFAULT 'coins',
        amount int DEFAULT 0,
        price_minor int DEFAULT 0,
        currency text DEFAULT 'GBP',
        status text DEFAULT 'pending',
        receipt_data text,
        created_at timestamptz DEFAULT now()
      )`
    }
  ];

  for (const t of extraTables) {
    await runSQL(client, t.sql, `Table: ${t.name}`);
  }

  // Enable RLS on extra tables
  const rlsTables = ['follows', 'blocks', 'live_streams', 'gifts_catalog', 'booster_catalog',
                     'user_bans', 'conversations', 'device_tokens', 'camera_filters',
                     'speed_options', 'sticker_options', 'purchases'];
  for (const t of rlsTables) {
    await runSQL(client, `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`, `RLS: ${t}`);
  }

  // Public read policies for catalog/reference tables
  const publicReadTables = ['live_streams', 'gifts_catalog', 'booster_catalog', 'camera_filters', 'speed_options', 'sticker_options'];
  for (const t of publicReadTables) {
    await runSQL(client, `DROP POLICY IF EXISTS "${t}_select_public" ON ${t}; CREATE POLICY "${t}_select_public" ON ${t} FOR SELECT USING (true)`, `Policy: ${t} public read`);
  }

  // Auth-only write policies
  const authWriteTables = ['follows', 'blocks', 'live_streams', 'device_tokens', 'purchases'];
  for (const t of authWriteTables) {
    await runSQL(client, `DROP POLICY IF EXISTS "${t}_insert_auth" ON ${t}; CREATE POLICY "${t}_insert_auth" ON ${t} FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)`, `Policy: ${t} auth insert`);
    await runSQL(client, `DROP POLICY IF EXISTS "${t}_select_auth" ON ${t}; CREATE POLICY "${t}_select_auth" ON ${t} FOR SELECT USING (true)`, `Policy: ${t} auth select`);
  }

  // Own-data policies
  await runSQL(client, `DROP POLICY IF EXISTS "follows_delete_own" ON follows; CREATE POLICY "follows_delete_own" ON follows FOR DELETE USING (auth.uid() = follower_id)`, 'Policy: follows delete own');
  await runSQL(client, `DROP POLICY IF EXISTS "blocks_delete_own" ON blocks; CREATE POLICY "blocks_delete_own" ON blocks FOR DELETE USING (auth.uid() = blocker_id)`, 'Policy: blocks delete own');

  // Live streams update own
  await runSQL(client, `DROP POLICY IF EXISTS "live_streams_update_own" ON live_streams; CREATE POLICY "live_streams_update_own" ON live_streams FOR UPDATE USING (auth.uid() = user_id)`, 'Policy: live_streams update own');
  await runSQL(client, `DROP POLICY IF EXISTS "live_streams_delete_own" ON live_streams; CREATE POLICY "live_streams_delete_own" ON live_streams FOR DELETE USING (auth.uid() = user_id)`, 'Policy: live_streams delete own');

  // Conversations policies
  await runSQL(client, `DROP POLICY IF EXISTS "conversations_select" ON conversations; CREATE POLICY "conversations_select" ON conversations FOR SELECT USING (auth.uid() = ANY(participant_ids))`, 'Policy: conversations select');
  await runSQL(client, `DROP POLICY IF EXISTS "conversations_insert" ON conversations; CREATE POLICY "conversations_insert" ON conversations FOR INSERT WITH CHECK (auth.uid() = ANY(participant_ids))`, 'Policy: conversations insert');
  await runSQL(client, `DROP POLICY IF EXISTS "conversations_update" ON conversations; CREATE POLICY "conversations_update" ON conversations FOR UPDATE USING (auth.uid() = ANY(participant_ids))`, 'Policy: conversations update');

  // Create indexes
  console.log('\n  Creating indexes...');
  await runSQL(client, `CREATE INDEX IF NOT EXISTS idx_live_streams_user ON live_streams(user_id)`, 'Index: live_streams user');
  await runSQL(client, `CREATE INDEX IF NOT EXISTS idx_live_streams_live ON live_streams(is_live) WHERE is_live = true`, 'Index: live_streams active');
  await runSQL(client, `CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)`, 'Index: follows follower');
  await runSQL(client, `CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)`, 'Index: follows following');
  await runSQL(client, `CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id)`, 'Index: purchases user');

  // Seed default data
  console.log('\n  Seeding default data...');

  // Default speed options
  await runSQL(client, `
    INSERT INTO speed_options (label, value, sort_order) VALUES
      ('0.3x', 0.3, 1), ('0.5x', 0.5, 2), ('1x', 1.0, 3), ('2x', 2.0, 4), ('3x', 3.0, 5)
    ON CONFLICT DO NOTHING
  `, 'Seed: speed options');

  // Default gifts catalog
  await runSQL(client, `
    INSERT INTO gifts_catalog (name, coin_cost, category, sort_order) VALUES
      ('Rose', 1, 'standard', 1),
      ('Heart', 5, 'standard', 2),
      ('Star', 10, 'standard', 3),
      ('Crown', 50, 'premium', 4),
      ('Diamond', 100, 'premium', 5),
      ('Rocket', 500, 'premium', 6),
      ('Castle', 1000, 'legendary', 7),
      ('Planet', 5000, 'legendary', 8)
    ON CONFLICT DO NOTHING
  `, 'Seed: gifts catalog');

  // Default booster catalog
  await runSQL(client, `
    INSERT INTO booster_catalog (name, coin_cost, duration_hours, boost_type, multiplier) VALUES
      ('Visibility Boost', 100, 24, 'visibility', 2.0),
      ('Super Boost', 500, 48, 'visibility', 5.0),
      ('Profile Highlight', 200, 24, 'profile', 3.0)
    ON CONFLICT DO NOTHING
  `, 'Seed: booster catalog');

  console.log('\n[5/5] Verifying tables...');
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  console.log(`\n  Found ${rows.length} tables in public schema:`);
  rows.forEach(r => console.log(`    - ${r.table_name}`));

  // Check required tables
  const required = ['profiles', 'videos', 'likes', 'comments', 'comment_likes', 'followers',
    'shares', 'hashtags', 'video_hashtags', 'notifications', 'reports', 'blocked_users',
    'chat_threads', 'messages', 'saved_videos', 'live_streams', 'follows', 'blocks',
    'gifts_catalog', 'booster_catalog', 'purchases', 'conversations', 'device_tokens',
    'user_bans', 'camera_filters', 'speed_options', 'sticker_options'];
  const existing = rows.map(r => r.table_name);
  const missing = required.filter(t => !existing.includes(t));
  if (missing.length > 0) {
    console.error(`\n  WARNING: Still missing tables: ${missing.join(', ')}`);
  } else {
    console.log('\n  ALL required tables exist!');
  }

  // Verify RPC functions
  const { rows: funcs } = await client.query(`
    SELECT routine_name FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
    ORDER BY routine_name
  `);
  console.log(`\n  Found ${funcs.length} functions:`);
  funcs.forEach(f => console.log(`    - ${f.routine_name}`));

  // Verify storage buckets
  try {
    const { rows: buckets } = await client.query(`SELECT id, name, public FROM storage.buckets ORDER BY name`);
    console.log(`\n  Storage buckets:`);
    buckets.forEach(b => console.log(`    - ${b.name} (public: ${b.public})`));
  } catch (e) {
    console.log(`\n  Could not check storage buckets: ${e.message}`);
  }

  console.log('\n========================================');
  console.log('  DATABASE SETUP COMPLETE!');
  console.log('========================================\n');

  await client.end();
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
