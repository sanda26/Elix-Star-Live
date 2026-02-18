
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WS_URL = process.env.VITE_WS_URL || 'ws://localhost:3000';
const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase config');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Admin client for cleanup
const adminSupabase = SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const TEST_ID = Date.now().toString();
const TEST_EMAIL = `release_test_${TEST_ID}@example.com`;
const TEST_PASSWORD = 'StrongPassword!123456';

async function runTests() {
  console.log('🚀 Starting FULL RELEASE TEST - Backend & Realtime');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log('---------------------------------------------------');

  let userId: string | null = null;
  let token: string | null = null;
  let roomId: string | null = null;

  // 3) Backend/API “Correctness” Tests
  try {
    console.log('\n🔍 [Step 3] Backend/API “Correctness” Tests');
    
    // Auth: Register
    console.log(`   Attempting to register user: ${TEST_EMAIL}`);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (signUpError) {
      console.log(`   ⚠️ SignUp failed (might be expected if email confirm is on): ${signUpError.message}`);
      // Try sign in, maybe user exists from previous failed run?
    } else {
      console.log('   ✅ Register success');
      userId = signUpData.user?.id || null;
    }

    // Auth: Login
    console.log('   Attempting to login...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (signInError) {
      throw new Error(`Login failed: ${signInError.message}`);
    }
    
    console.log('   ✅ Login success');
    token = signInData.session.access_token;
    userId = signInData.user.id;
    console.log(`   User ID: ${userId}`);

    // Auth: Profile Check (Simulate "Get User")
    const { data: userUser, error: userError } = await supabase.auth.getUser(token);
    if (userError || userUser.user.id !== userId) {
      throw new Error('Get User failed or ID mismatch');
    }
    console.log('   ✅ Auth Session Validated');

    // Manually ensure user exists in public tables (users AND profiles)
    // because triggers might be missing or slow, and we have a split schema.
    const username = `user_${TEST_ID}`;
    
    // Insert into public.users (needed for live_streams FK)
    const { error: usersError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: TEST_EMAIL,
        username: username,
        password_hash: 'dummy', // Not used for auth
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
    if (usersError) {
      console.log(`   ⚠️ Insert public.users failed: ${usersError.message}`);
    } else {
      console.log('   ✅ Insert public.users success');
    }

    // Insert into public.profiles (needed for WebSocket username lookup)
    const { error: profilesError } = await supabase
      .from('profiles')
      .upsert({
        user_id: userId,
        username: username,
        email: TEST_EMAIL,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (profilesError) {
      console.log(`   ⚠️ Insert public.profiles failed: ${profilesError.message}`);
    } else {
      console.log('   ✅ Insert public.profiles success');
    }

    // MVP Flow: Create Livestream (DB Insert)
    // Note: In this app, 'live_streams' table likely exists.
    // We'll try to insert a row.
    console.log('   Attempting to create a livestream record...');
    const { data: streamData, error: streamError } = await supabase
      .from('live_streams')
      .insert({
        user_id: userId,
        title: `Release Test Stream ${TEST_ID}`,
        is_live: true
      })
      .select()
      .single();

    if (streamError) {
      console.log(`   ⚠️ Create Stream failed (RLS or Schema): ${streamError.message}`);
      // Fallback: Use a dummy room ID for WS tests
      roomId = `test-room-${TEST_ID}`;
      console.log(`   Using dummy room ID: ${roomId}`);
    } else {
      console.log('   ✅ Create Livestream success');
      roomId = streamData.id;
      console.log(`   Room ID: ${roomId}`);
    }

  } catch (e: any) {
    console.error(`❌ [Step 3] Failed: ${e.message}`);
    // If auth fails, we can't proceed with authenticated WS tests
    if (!token) process.exit(1);
  }

  // 4) WebSocket / Realtime “Production” Tests
  try {
    console.log('\n🔍 [Step 4] WebSocket / Realtime “Production” Tests');
    
    if (!token || !roomId) throw new Error('Missing token or roomId');

    // Connect Client A (Authenticated)
    console.log(`   Connecting Client A to ${WS_URL}...`);
    const wsA = new WebSocket(`${WS_URL}/live/${roomId}?token=${encodeURIComponent(token)}&room=${roomId}`);
    
    const clientAPromise = new Promise<void>((resolve, reject) => {
      wsA.on('open', () => {
        console.log('   ✅ Client A Connected');
        resolve();
      });
      wsA.on('error', (e) => reject(e));
    });

    await clientAPromise;

    // Connect Client B (Anonymous/Viewer or Secondary)
    // We'll use skipAuth=true for testing if server supports it, otherwise simulate another user.
    // Based on server code: "if (skipAuth) ... allow connection"
    console.log('   Connecting Client B (Test/Viewer)...');
    const wsB = new WebSocket(`${WS_URL}/live/${roomId}?skipAuth=true&room=${roomId}`);
    
    const clientBPromise = new Promise<void>((resolve, reject) => {
      wsB.on('open', () => {
        // Send join_room as per server logic for skipAuth
        wsB.send(JSON.stringify({
          event: 'join_room',
          data: {
            skipAuth: true,
            roomId: roomId,
            userId: 'test-viewer-1',
            username: 'Viewer 1'
          }
        }));
        resolve();
      });
      wsB.on('error', (e) => reject(e));
    });

    await clientBPromise;
    console.log('   ✅ Client B Connected');

    // Test: Chat Message (A -> B)
    console.log('   Testing Chat Message (A -> B)...');
    const chatMsg = { text: `Hello World ${TEST_ID}` };
    
    const chatPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Chat timeout')), 5000);
      
      wsB.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.event === 'chat_message' && msg.data.text === chatMsg.text) {
          console.log('   ✅ Client B received chat message');
          clearTimeout(timeout);
          resolve();
        }
      });

      wsA.send(JSON.stringify({
        event: 'chat_message',
        data: chatMsg
      }));
    });

    await chatPromise;

    // Test: Gift Sending (A -> B)
    console.log('   Testing Gift Sending (A -> B)...');
    const giftData = { giftId: 'rose', count: 1, transactionId: `tx-${TEST_ID}` };
    
    const giftPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Gift timeout')), 5000);
      
      wsB.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.event === 'gift_sent' && msg.data.transactionId === giftData.transactionId) {
          console.log('   ✅ Client B received gift event');
          clearTimeout(timeout);
          resolve();
        }
      });

      wsA.send(JSON.stringify({
        event: 'gift_sent',
        data: giftData
      }));
    });

    await giftPromise;

    // Close connections
    wsA.close();
    wsB.close();

  } catch (e: any) {
    console.error(`❌ [Step 4] Failed: ${e.message}`);
  }

  // 5) Database Integrity Tests
  // (Optional: Verify the gift transaction in DB if the server wrote it, 
  // but the current server code only broadcasts gifts and updates viewer count)
  console.log('\n🔍 [Step 5] Database Integrity Tests');
  console.log('   (Skipping detailed DB checks as server code mainly broadcasts gifts)');
  // We can check if viewer count was updated in DB
  if (roomId && roomId.length > 20) { // Only if real UUID
     const { data: stream } = await supabase.from('live_streams').select('viewer_count').eq('id', roomId).single();
     console.log(`   Final Viewer Count in DB: ${stream?.viewer_count ?? 'N/A'}`);
  }

  // 7) Payments (Stripe Endpoint Check)
  try {
    console.log('\n🔍 [Step 7] Payments / API Tests');
    console.log('   Testing /api/create-checkout-session...');
    
    // We need to fetch() the running server
    const response = await fetch(`${API_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // If required
      },
      body: JSON.stringify({
        priceId: 'price_test_123', // Dummy
        userId: userId,
        returnUrl: 'http://localhost:3000'
      })
    });

    if (response.status === 404) {
      throw new Error('Endpoint not found (404)');
    }
    
    const json = await response.json();
    // It might fail with "Stripe key not configured" or similar, which is fine for "Connectivity" test
    // We just want to ensure the ROUTE exists and handles the request.
    console.log(`   Response Status: ${response.status}`);
    console.log(`   Response Body: ${JSON.stringify(json).substring(0, 100)}...`);
    
    if (response.status === 500 && JSON.stringify(json).includes('Stripe')) {
        console.log('   ✅ Endpoint reachable (Stripe error expected without valid keys)');
    } else if (response.ok) {
        console.log('   ✅ Endpoint reachable and success');
    } else {
        console.log('   ⚠️ Endpoint reachable but returned error');
    }

  } catch (e: any) {
    console.error(`❌ [Step 7] Failed: ${e.message}`);
  }

  // Cleanup
  if (adminSupabase && userId) {
    console.log('\n🧹 Cleanup');
    const { error } = await adminSupabase.auth.admin.deleteUser(userId);
    if (!error) console.log('   ✅ Test user deleted');
    else console.log(`   ⚠️ Failed to delete user: ${error.message}`);
  }

  console.log('\n---------------------------------------------------');
  console.log('🏁 Release Test Script Finished');
}

runTests();
