import { Request, Response } from 'express';
import { getDb, getDbAdmin } from '../lib/backend';

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
  return res.status(501).json({ error: 'Analytics not available.' });
}

// --- Block User ---
export async function handleBlockUser(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(501).json({ error: 'Block user not available.' });
}

// --- Delete Account ---
export async function handleDeleteAccount(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(501).json({ error: 'Delete account not available.' });
}

// --- Report ---
export async function handleReport(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(501).json({ error: 'Report not available.' });
}

// --- Send Notification ---
export async function handleSendNotification(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  return res.status(501).json({ error: 'Send notification not available.' });
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
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[IAP] Apple API keys not configured — skipping verification (dev only)');
      return { valid: true, detail: 'apple-keys-not-configured-dev' };
    }
    console.error('[IAP] Apple API keys not configured — rejecting purchase');
    return { valid: false, detail: 'apple-keys-not-configured' };
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
  return res.status(501).json({ error: 'Verify purchase not available.' });
  /*
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await getDb().auth.getUser(token);
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
    const { data: existing } = await getDb()
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

    const { data, error } = await getDb().rpc('verify_purchase', {
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
  */
}

// Promote IAP product IDs and server-side amounts (must match App Store Connect)
const PROMOTE_IAP_PRODUCTS: Record<string, { goal: string; amountGbp: number }> = {
  'com.elixstarlive.promote_views':     { goal: 'views', amountGbp: 5 },
  'com.elixstarlive.promote_likes':     { goal: 'likes', amountGbp: 10 },
  'com.elixstarlive.promote_profile':   { goal: 'profile', amountGbp: 20 },
  'com.elixstarlive.promote_followers': { goal: 'followers', amountGbp: 30 },
};

// --- Promote IAP complete (Apple/Google) ---
export async function handlePromoteIAPComplete(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(501).json({ error: 'Promote IAP not available.' });
  /*
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await getDbAdmin().auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid auth token' });

  const rateCheck = checkRateLimit(user.id, 'promote:iap', 10, 60 * 60 * 1000);
  if (!rateCheck.allowed) return res.status(429).json({ error: 'Too many promote attempts' });

  const body = req.body;
  const { transactionId, receipt, productId, contentType, contentId } = body;

  if (!transactionId || !productId) return res.status(400).json({ error: 'Missing transactionId or productId' });

  const meta = PROMOTE_IAP_PRODUCTS[productId];
  if (!meta) return res.status(400).json({ error: 'Invalid promote product' });

  const { goal, amountGbp } = meta;

  const { data: existing } = await getDbAdmin()
    .from('promote_purchases')
    .select('id')
    .eq('provider_transaction_id', transactionId)
    .maybeSingle();

  if (existing) return res.status(409).json({ error: 'Transaction already processed' });

  const provider = body.provider === 'google' ? 'google' : 'apple';
  let valid = false;
  if (provider === 'apple') {
    const apple = await verifyAppleReceipt(transactionId);
    valid = apple.valid && apple.productId === productId;
  } else {
    valid = true;
  }

  if (!valid) return res.status(400).json({ error: 'Invalid or unverified transaction' });

  const { error: insertErr } = await getDbAdmin().from('promote_purchases').insert({
    user_id: user.id,
    content_type: String(contentType || 'video'),
    content_id: String(contentId || ''),
    goal,
    amount_gbp: amountGbp,
    stripe_session_id: null,
    provider: provider,
    provider_transaction_id: transactionId,
    status: 'completed',
  });

  if (insertErr) return res.status(500).json({ error: insertErr.message });

  return res.json({ success: true, message: 'Promote purchase recorded' });
  */
}
