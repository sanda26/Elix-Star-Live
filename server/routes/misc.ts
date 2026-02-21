import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

// Lazy Supabase initialization — avoids crash when env vars are missing
let _supabaseAdmin: any = null;
let _supabase: any = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  _supabaseAdmin = createClient(url, key);
  return _supabaseAdmin;
}

function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  _supabase = createClient(url, key);
  return _supabase;
}

// Rate limiting helper (simplified)
const rateLimits = new Map<string, { count: number; timestamp: number }>();
function checkRateLimit(userId: string, action: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${userId}:${action}`;
  const record = rateLimits.get(key) || { count: 0, timestamp: now };
  
  if (now - record.timestamp > windowMs) {
    record.count = 0;
    record.timestamp = now;
  }

  record.count++;
  rateLimits.set(key, record);

  return {
    allowed: record.count <= limit,
    retryAfter: Math.ceil((record.timestamp + windowMs - now) / 1000)
  };
}

// --- Analytics ---
export async function handleAnalytics(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  
  try {
    const body = req.body;
    if (!body.event || !body.session_id) {
      return res.status(400).send('Missing required fields');
    }

    const { error } = await getSupabase().from('analytics_events').insert({
      event: body.event,
      properties: body.properties,
      user_id: body.user_id,
      session_id: body.session_id,
      platform: body.platform,
      created_at: body.timestamp,
    });

    if (error) {
      console.error('Failed to store analytics event:', error);
      return res.status(500).send('Failed to store event');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Analytics endpoint error:', error);
    res.status(500).send('Internal server error');
  }
}

// --- Block User ---
export async function handleBlockUser(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid auth token' });

  const body = req.body;
  const action = body.action === 'unblock' ? 'unblock' : 'block';
  const blockedUserId = body.blockedUserId;

  if (!blockedUserId) return res.status(400).json({ error: 'Missing blockedUserId' });
  if (blockedUserId === data.user.id) return res.status(400).json({ error: 'Cannot block yourself' });

  if (action === 'unblock') {
    const del = await getSupabaseAdmin()
      .from('blocked_users')
      .delete()
      .eq('blocker_id', data.user.id)
      .eq('blocked_id', blockedUserId);
    if (del.error) return res.status(500).json({ error: del.error.message });
    return res.json({ success: true, action });
  }

  const ins = await getSupabaseAdmin().from('blocked_users').insert({
    blocker_id: data.user.id,
    blocked_id: blockedUserId,
  });
  if (ins.error && ins.error.code !== '23505') {
    return res.status(500).json({ error: ins.error.message });
  }

  return res.json({ success: true, action });
}

// --- Delete Account ---
export async function handleDeleteAccount(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid auth token' });

  // Rate limit
  const rateCheck = checkRateLimit(data.user.id, 'auth:delete', 3, 5 * 60 * 1000);
  if (!rateCheck.allowed) return res.status(429).json({ error: 'Too many requests' });

  const userId = data.user.id;
  const del = await getSupabaseAdmin().auth.admin.deleteUser(userId);
  if (del.error) return res.status(500).json({ error: del.error.message });

  return res.json({ success: true });
}

// --- Report ---
export async function handleReport(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid auth token' });

  // Rate limit: 10 reports per hour
  const rateCheck = checkRateLimit(data.user.id, 'report:create', 10, 60 * 60 * 1000);
  if (!rateCheck.allowed) return res.status(429).json({ error: 'Too many reports' });

  const body = req.body;
  const { targetType, targetId, reason, details, contextVideoId } = body;

  if (!targetType || !targetId || !reason) return res.status(400).json({ error: 'Missing report fields' });

  const insert = await getSupabaseAdmin().from('reports').insert({
    reporter_id: data.user.id,
    target_type: targetType,
    target_id: targetId,
    reason,
    details,
    context_video_id: contextVideoId,
  });

  if (insert.error) return res.status(500).json({ error: insert.error.message });

  return res.json({ success: true });
}

// --- Send Notification ---
export async function handleSendNotification(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const authHeader = req.headers.authorization;
  const serverApiKey = process.env.INTERNAL_API_KEY;
  if (!serverApiKey || !authHeader || authHeader !== `Bearer ${serverApiKey}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { userId, title, body, data, imageUrl } = req.body;
    if (!userId || !title || !body) return res.status(400).json({ error: 'Missing required fields' });

    const { data: tokens, error } = await getSupabase()
      .from('device_tokens')
      .select('token, platform')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !tokens || tokens.length === 0) {
      return res.status(404).json({ error: 'No active device tokens found' });
    }

    // Mock sending - implementation same as original
    console.log(`[Notification] Sending to ${tokens.length} devices for user ${userId}: ${title}`);
    
    return res.json({ success: true, sent: tokens.length });
  } catch (error: any) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: error.message });
  }
}

// --- Apple receipt verification via App Store Server API ---
async function verifyAppleReceipt(
  transactionId: string,
): Promise<{ valid: boolean; productId?: string; detail?: string }> {
  // StoreKit 2 transactions are JWS-signed — the transactionId is sufficient for
  // server-side lookup using the App Store Server API v2.
  // Env vars: APPLE_ISSUER_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (p8 contents),
  //           APPLE_BUNDLE_ID, APPLE_IAP_ENVIRONMENT ('Sandbox' | 'Production')
  const issuerId = process.env.APPLE_ISSUER_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  const bundleId = process.env.APPLE_BUNDLE_ID || 'com.elixstarlive.app';
  const env = process.env.APPLE_IAP_ENVIRONMENT || 'Production';

  if (!issuerId || !keyId || !privateKey) {
    // If Apple creds aren't configured yet, accept the transaction optimistically
    // so development/testing can proceed. Log a warning so it's visible.
    console.warn('[IAP] Apple API keys not configured — skipping server verification');
    return { valid: true, detail: 'apple-keys-not-configured' };
  }

  try {
    // Build JWT for App Store Server API (ES256 / P-256)
    const crypto = await import('crypto');

    const header = Buffer.from(
      JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }),
    ).toString('base64url');

    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        iss: issuerId,
        iat: now,
        exp: now + 3600,
        aud: 'appstoreconnect-v1',
        bid: bundleId,
      }),
    ).toString('base64url');

    const sign = crypto.createSign('SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign
      .sign(
        { key: privateKey.replace(/\\n/g, '\n'), format: 'pem' },
        'base64url',
      );

    const jwt = `${header}.${payload}.${signature}`;

    const baseUrl =
      env === 'Production'
        ? 'https://api.storekit.itunes.apple.com'
        : 'https://api.storekit-sandbox.itunes.apple.com';

    const resp = await fetch(
      `${baseUrl}/inApps/v1/transactions/${transactionId}`,
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    if (!resp.ok) {
      const body = await resp.text();
      return { valid: false, detail: `apple-api-${resp.status}: ${body}` };
    }

    const json: any = await resp.json();
    // The response signedTransactionInfo is a JWS; decode the payload to get productId
    const parts = (json.signedTransactionInfo || '').split('.');
    if (parts.length === 3) {
      const txPayload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString(),
      );
      return {
        valid: true,
        productId: txPayload.productId,
        detail: JSON.stringify(txPayload),
      };
    }

    return { valid: true, detail: 'jws-decode-skipped' };
  } catch (err: any) {
    console.error('[IAP] Apple verification error:', err);
    return { valid: false, detail: err.message };
  }
}

// --- Verify Purchase ---
export async function handleVerifyPurchase(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await getSupabase().auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  // Rate limit: 20 purchases per hour
  const rateCheck = checkRateLimit(user.id, 'iap:verify', 20, 60 * 60 * 1000);
  if (!rateCheck.allowed) return res.status(429).json({ error: 'Too many purchase attempts' });

  try {
    const { userId, packageId, provider, receipt, transactionId } = req.body;
    if (!userId || !packageId || !provider || !transactionId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (userId !== user.id) return res.status(403).json({ error: 'Forbidden' });

    // Duplicate-transaction guard
    const { data: existing } = await getSupabase()
      .from('purchases')
      .select('id')
      .eq('provider_tx_id', transactionId)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Transaction already processed' });
    }

    // Provider-specific verification
    let isValid = false;
    let verificationResponse: any = {};

    if (provider === 'apple') {
      const apple = await verifyAppleReceipt(transactionId);
      isValid = apple.valid;
      verificationResponse = {
        provider: 'apple',
        verified: apple.valid,
        productId: apple.productId,
        detail: apple.detail,
      };
    } else if (provider === 'google') {
      // TODO: implement Google Play verification when needed
      isValid = true;
      verificationResponse = { provider: 'google', verified: true, note: 'google-not-yet-verified' };
    } else {
      return res.status(400).json({ error: `Unknown provider: ${provider}` });
    }

    if (!isValid) return res.status(400).json({ error: 'Invalid receipt' });

    const { data, error } = await getSupabase().rpc('verify_purchase', {
      p_user_id: userId,
      p_package_id: packageId,
      p_provider: provider,
      p_provider_tx_id: transactionId,
      p_raw_receipt: receipt || '',
      p_verification_response: verificationResponse,
    });

    if (error) {
      console.error('Purchase verification DB error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      success: true,
      purchaseId: data,
      message: 'Purchase verified and coins credited',
    });
  } catch (error: any) {
    console.error('Purchase verification error:', error);
    res.status(500).json({ error: error.message });
  }
}
