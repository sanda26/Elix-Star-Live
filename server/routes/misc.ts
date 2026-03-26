import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTokenFromRequest, verifyAuthToken } from './auth';
import { recordPromotePurchase } from '../lib/promoteStore';
import {
  creditVerifiedPurchase,
  findPurchaseByProviderTransaction,
  getWalletBalance,
  setUserBalanceCache,
} from '../lib/walletStore';
import { getPool } from '../lib/postgres';
import {
  neonCreditIap,
  neonGetCoinBalance,
  neonInsertMembershipPurchase,
  neonInsertPromotePurchase,
  neonIsIapProcessed,
} from '../lib/walletNeon';
import { logger } from '../lib/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// ═══════════════════════════════════════════════════════════════
// In-memory block list with JSON persistence
// ═══════════════════════════════════════════════════════════════
const BLOCKS_FILE = path.join(__dirname, '..', 'data', 'blocks.json');
const blocksByUser = new Map<string, Set<string>>();

function loadBlocks() {
  try {
    if (!fs.existsSync(BLOCKS_FILE)) return;
    const raw = fs.readFileSync(BLOCKS_FILE, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    for (const [userId, blocked] of Object.entries(parsed)) {
      if (Array.isArray(blocked)) blocksByUser.set(userId, new Set(blocked));
    }
  } catch { /* start empty */ }
}

function saveBlocks() {
  try {
    const dir = path.dirname(BLOCKS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj: Record<string, string[]> = {};
    for (const [userId, set] of blocksByUser) obj[userId] = [...set];
    fs.writeFileSync(BLOCKS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch { /* non-fatal */ }
}

loadBlocks();

// ═══════════════════════════════════════════════════════════════
// In-memory reports store with JSON persistence
// ═══════════════════════════════════════════════════════════════
interface ReportRecord {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
  createdAt: string;
}

const REPORTS_FILE = path.join(__dirname, '..', 'data', 'reports.json');
let reports: ReportRecord[] = [];

function loadReports() {
  try {
    if (!fs.existsSync(REPORTS_FILE)) return;
    const raw = fs.readFileSync(REPORTS_FILE, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) reports = parsed;
  } catch { /* start empty */ }
}

function saveReports() {
  try {
    const dir = path.dirname(REPORTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
  } catch { /* non-fatal */ }
}

loadReports();

function requireAuth(req: Request, res: Response): { userId: string; email: string } | null {
  const token = getTokenFromRequest(req);
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  const payload = verifyAuthToken(token);
  if (!payload) { res.status(401).json({ error: 'Invalid or expired session.' }); return null; }
  return { userId: payload.sub, email: payload.email ?? '' };
}

// --- Analytics ---
export async function handleAnalytics(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  return res.status(200).json({ ok: true });
}

// --- Block User ---
export async function handleBlockUser(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { blockedUserId, action } = req.body ?? {};
  const targetId = typeof blockedUserId === 'string' ? blockedUserId.trim() : '';
  if (!targetId) return res.status(400).json({ error: 'blockedUserId is required' });
  if (targetId === auth.userId) return res.status(400).json({ error: 'Cannot block yourself' });

  if (!blocksByUser.has(auth.userId)) blocksByUser.set(auth.userId, new Set());
  const set = blocksByUser.get(auth.userId)!;

  if (action === 'unblock') {
    set.delete(targetId);
    logger.info({ userId: auth.userId, targetId }, 'User unblocked');
  } else {
    set.add(targetId);
    logger.info({ userId: auth.userId, targetId }, 'User blocked');
  }
  saveBlocks();
  return res.status(200).json({ ok: true, action: action === 'unblock' ? 'unblocked' : 'blocked' });
}

// --- Delete Account (legacy alias — real handler is in auth.ts) ---
export async function handleDeleteAccount(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = requireAuth(req, res);
  if (!auth) return;
  return res.status(200).json({ ok: true, message: 'Use /api/auth/delete instead.' });
}

// --- Report ---
export async function handleReport(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = requireAuth(req, res);
  if (!auth) return;

  const rateCheck = checkRateLimit(auth.userId, 'report', 10, 60 * 60 * 1000);
  if (!rateCheck.allowed) return res.status(429).json({ error: 'Too many reports' });

  const { target_type, target_id, reason, details } = req.body ?? {};
  const targetType = typeof target_type === 'string' ? target_type.trim() : 'unknown';
  const targetId = typeof target_id === 'string' ? target_id.trim() : '';
  if (!targetId) return res.status(400).json({ error: 'target_id is required' });

  const record: ReportRecord = {
    id: crypto.randomUUID(),
    reporterId: auth.userId,
    targetType,
    targetId,
    reason: typeof reason === 'string' ? reason.trim() : '',
    details: typeof details === 'string' ? details.trim().slice(0, 2000) : '',
    createdAt: new Date().toISOString(),
  };
  reports.push(record);
  saveReports();
  logger.info({ reportId: record.id, reporterId: auth.userId, targetType, targetId }, 'Report submitted');

  return res.status(200).json({ ok: true, reportId: record.id });
}

// --- Send Notification ---
export async function handleSendNotification(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const auth = requireAuth(req, res);
  if (!auth) return;
  return res.status(200).json({ ok: true, message: 'Notification queued.' });
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

const IAP_PRODUCTS: Record<string, { coins: number }> = {
  'com.elixstarlive.coins_100': { coins: 100 },
  'com.elixstarlive.coins_500': { coins: 500 },
  'com.elixstarlive.coins_1000': { coins: 1000 },
  'com.elixstarlive.coins_5000': { coins: 5000 },
};

async function getGoogleAccessToken(): Promise<string | null> {
  const clientEmail = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PLAY_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[IAP] Google Play service account not configured - skipping verification (dev only)');
      return null;
    }
    throw new Error('google-play-service-account-not-configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url');

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer.sign(privateKey.replace(/\\n/g, '\n'), 'base64url');
  const assertion = `${header}.${payload}.${signature}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`google-oauth-${resp.status}:${body}`);
  }

  const json = await resp.json() as { access_token?: string };
  return json.access_token ?? null;
}

async function acknowledgeGooglePurchase(
  accessToken: string,
  packageName: string,
  productId: string,
  purchaseToken: string,
) {
  const resp = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName,
    )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(
      purchaseToken,
    )}:acknowledge`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ developerPayload: 'coins_purchase' }),
    },
  );

  if (!resp.ok && resp.status !== 409) {
    const body = await resp.text();
    throw new Error(`google-ack-${resp.status}:${body}`);
  }
}

async function verifyGooglePurchase(
  productId: string,
  purchaseToken: string,
): Promise<{ valid: boolean; detail?: string; orderId?: string; productId?: string }> {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.elixstarlive.app';

  try {
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      return {
        valid: process.env.NODE_ENV !== 'production',
        detail: 'google-service-account-not-configured-dev',
        productId,
      };
    }

    const resp = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
        packageName,
      )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(
        purchaseToken,
      )}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!resp.ok) {
      const body = await resp.text();
      return { valid: false, detail: `google-api-${resp.status}:${body}` };
    }

    const json = await resp.json() as {
      purchaseState?: number;
      acknowledgementState?: number;
      orderId?: string;
      productId?: string;
    };

    const valid = json.purchaseState === 0 && (!json.productId || json.productId === productId);
    if (!valid) {
      return { valid: false, detail: JSON.stringify(json) };
    }

    if (json.acknowledgementState === 0) {
      await acknowledgeGooglePurchase(accessToken, packageName, productId, purchaseToken);
    }

    return {
      valid: true,
      detail: JSON.stringify(json),
      orderId: json.orderId,
      productId: json.productId || productId,
    };
  } catch (error: any) {
    console.error('[IAP] Google verification error:', error);
    return { valid: false, detail: error?.message || 'google-verification-failed' };
  }
}

// --- Verify Purchase ---
export async function handleVerifyPurchase(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const user = verifyAuthToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const rateCheck = checkRateLimit(user.sub, 'iap:verify', 20, 60 * 60 * 1000);
  if (!rateCheck.allowed) return res.status(429).json({ error: 'Too many purchase attempts' });

  try {
    const { userId, packageId, provider, receipt, transactionId } = req.body;
    if (!userId || !packageId || !provider || !transactionId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (userId !== user.sub) return res.status(403).json({ error: 'Forbidden' });

    const packageMeta = IAP_PRODUCTS[String(packageId)];
    if (!packageMeta) {
      return res.status(400).json({ error: 'Unknown coin package' });
    }

    const safeProvider = provider === 'google' ? 'google' : provider === 'apple' ? 'apple' : null;
    if (!safeProvider) {
      return res.status(400).json({ error: `Unknown provider: ${provider}` });
    }

    if (getPool() && (await neonIsIapProcessed(safeProvider, String(transactionId)))) {
      const nb = (await neonGetCoinBalance(String(userId))) ?? 0;
      setUserBalanceCache(String(userId), nb);
      return res.status(200).json({
        success: true,
        alreadyProcessed: true,
        purchaseId: 'neon',
        newBalance: nb,
        coinsAdded: 0,
        message: 'Purchase already processed',
      });
    }

    const existing = findPurchaseByProviderTransaction(safeProvider, String(transactionId));
    if (existing) {
      return res.status(200).json({
        success: true,
        alreadyProcessed: true,
        purchaseId: existing.id,
        newBalance: getWalletBalance(userId),
        coinsAdded: 0,
        message: 'Purchase already processed',
      });
    }

    let isValid = false;
    let verificationResponse: any = {};

    if (safeProvider === 'apple') {
      const apple = await verifyAppleReceipt(String(transactionId));
      isValid =
        apple.valid &&
        (apple.productId
          ? apple.productId === packageId
          : process.env.NODE_ENV !== 'production');
      verificationResponse = {
        provider: 'apple',
        verified: apple.valid,
        productId: apple.productId,
        detail: apple.detail,
      };
    } else if (safeProvider === 'google') {
      if (!receipt) {
        return res.status(400).json({ error: 'Missing Google purchase token' });
      }
      const google = await verifyGooglePurchase(String(packageId), String(receipt));
      isValid = google.valid && (!google.productId || google.productId === packageId);
      verificationResponse = {
        provider: 'google',
        verified: google.valid,
        productId: google.productId || packageId,
        orderId: google.orderId,
        detail: google.detail,
      };
    }

    if (!isValid) return res.status(400).json({ error: 'Invalid receipt' });

    if (getPool()) {
      const n = await neonCreditIap({
        userId: String(userId),
        provider: safeProvider,
        providerTransactionId: String(transactionId),
        productId: String(packageId),
        coins: packageMeta.coins,
        verification: verificationResponse,
      });
      if (n.ok === true) {
        setUserBalanceCache(String(userId), n.newBalance);
        return res.json({
          success: true,
          alreadyProcessed: false,
          purchaseId: n.ledgerId,
          coinsAdded: packageMeta.coins,
          newBalance: n.newBalance,
          message: 'Purchase verified and coins credited',
        });
      }
      if ('alreadyProcessed' in n && n.alreadyProcessed) {
        setUserBalanceCache(String(userId), n.newBalance);
        return res.json({
          success: true,
          alreadyProcessed: true,
          purchaseId: 'neon',
          coinsAdded: 0,
          newBalance: n.newBalance,
          message: 'Purchase verified and coins credited',
        });
      }
      return res.status(500).json({ error: 'error' in n ? n.error : 'Credit failed' });
    }

    const credit = creditVerifiedPurchase({
      userId: String(userId),
      provider: safeProvider,
      providerTransactionId: String(transactionId),
      productId: String(packageId),
      coins: packageMeta.coins,
      rawReceipt: String(receipt || transactionId),
      verification: verificationResponse,
    });

    return res.json({
      success: true,
      alreadyProcessed: credit.alreadyProcessed,
      purchaseId: credit.purchase.id,
      coinsAdded: credit.alreadyProcessed ? 0 : packageMeta.coins,
      newBalance: credit.newBalance,
      message: 'Purchase verified and coins credited',
    });
  } catch (error: any) {
    console.error('Purchase verification error:', error);
    res.status(500).json({ error: error.message || 'Purchase verification failed' });
  }
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
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const user = verifyAuthToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid auth token' });

  const rateCheck = checkRateLimit(user.sub, 'promote:iap', 10, 60 * 60 * 1000);
  if (!rateCheck.allowed) return res.status(429).json({ error: 'Too many promote attempts' });

  const body = req.body;
  const { transactionId, receipt, productId, contentType, contentId } = body;

  if (!transactionId || !productId) return res.status(400).json({ error: 'Missing transactionId or productId' });

  const meta = PROMOTE_IAP_PRODUCTS[productId];
  if (!meta) return res.status(400).json({ error: 'Invalid promote product' });

  const { goal, amountGbp } = meta;
  const provider = body.provider === 'google' ? 'google' : 'apple';
  let valid = false;
  if (provider === 'apple') {
    const apple = await verifyAppleReceipt(transactionId);
    valid =
      apple.valid &&
      (apple.productId ? apple.productId === productId : process.env.NODE_ENV !== 'production');
  } else {
    const google = await verifyGooglePurchase(String(productId), String(receipt || ''));
    valid = google.valid && (!google.productId || google.productId === productId);
  }

  if (!valid) return res.status(400).json({ error: 'Invalid or unverified transaction' });

  const recorded = recordPromotePurchase({
    userId: user.sub,
    contentType: String(contentType || 'video'),
    contentId: String(contentId || ''),
    goal,
    amountGbp,
    provider,
    providerTransactionId: String(transactionId),
    productId: String(productId),
  });

  await neonInsertPromotePurchase({
    userId: user.sub,
    provider,
    providerTransactionId: String(transactionId),
    productId: String(productId),
    contentType: String(contentType || 'video'),
    contentId: String(contentId || ''),
    goal,
    amountGbp,
  });

  return res.json({
    success: true,
    alreadyProcessed: recorded.alreadyProcessed,
    purchaseId: recorded.purchase.id,
    message: 'Promote purchase recorded',
  });
}

/** POST /api/membership/iap-complete — record membership purchased via Apple/Google IAP */
export async function handleMembershipIAPComplete(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = requireAuth(req, res);
  if (!auth) return;

  const rateCheck = checkRateLimit(auth.userId, 'membership_iap', 5, 60_000);
  if (!rateCheck.allowed) return res.status(429).json({ error: 'Too many requests' });

  const { transactionId, receipt, provider, creatorId } = req.body ?? {};
  if (!transactionId || !provider) {
    return res.status(400).json({ error: 'transactionId and provider required' });
  }

  const validProvider = provider === 'apple' || provider === 'google';
  if (!validProvider) return res.status(400).json({ error: 'Invalid provider' });

  logger.info({
    userId: auth.userId,
    provider,
    transactionId,
    creatorId: creatorId || '',
  }, 'Membership IAP complete');

  await neonInsertMembershipPurchase({
    userId: auth.userId,
    creatorId: typeof creatorId === 'string' && creatorId.trim() ? creatorId.trim() : null,
    provider: provider === 'google' ? 'google' : 'apple',
    providerTransactionId: String(transactionId),
  });

  return res.json({ success: true, message: 'Membership recorded' });
}
