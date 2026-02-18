
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  console.log('URL:', supabaseUrl);
  console.log('Key:', supabaseKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRanking() {
  console.log('Testing get_weekly_creator_ranking...');
  const { data, error } = await supabase.rpc('get_weekly_creator_ranking', { p_limit: 5 });

  if (error) {
    console.error('Error calling RPC:', error);
  } else {
    console.log('Success! Data:', data);
  }
}

testRanking();
