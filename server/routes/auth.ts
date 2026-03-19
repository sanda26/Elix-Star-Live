/**
 * Auth API: login, register, logout, me, resend-confirmation, apple/start.
 * Uses in-memory user store + JWT. Replace with DB (Hetzner Postgres) when ready.
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const COOKIE_NAME = 'auth_token';
const TOKEN_EXPIRY_SEC = 60 * 60 * 24 * 7; // 7 days
const SALT_LEN = 16;
const KEY_LEN = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

function getSecret(): string {
  const s = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'elix-auth-dev-secret-change-in-production';
  return s;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LEN);
  const key = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_OPTS);
  return salt.toString('base64') + ':' + key.toString('base64');
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltB64, keyB64] = stored.split(':');
  if (!saltB64 || !keyB64) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const key = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_OPTS);
  return key.toString('base64') === keyB64;
}

function signToken(payload: { sub: string; email: string }): string {
  const secret = getSecret();
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = {
    sub: payload.sub,
    email: payload.email,
    iat: now,
    exp: now + TOKEN_EXPIRY_SEC,
  };
  const b64 = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const part1 = b64(header);
  const part2 = b64(body);
  const sig = crypto.createHmac('sha256', secret).update(`${part1}.${part2}`).digest('base64url');
  return `${part1}.${part2}.${sig}`;
}

function verifyToken(token: string): { sub: string; email: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [, payloadB64, sig] = parts;
    const secret = getSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(`${parts[0]}.${payloadB64}`).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: payload.sub, email: payload.email ?? '' };
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function verifyAuthToken(token: string): { sub: string; email: string } | null {
  return verifyToken(token);
}

function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_EXPIRY_SEC}${isProd ? '; Secure' : ''}`,
  ].join(', '));
}

function clearAuthCookie(res: Response) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// In-memory user store with simple JSON persistence on disk
interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
}
const usersByEmail = new Map<string, StoredUser>();
const usersById = new Map<string, StoredUser>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

function loadUsersFromDisk() {
  try {
    if (!fs.existsSync(USERS_FILE)) return;
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw) as { users?: StoredUser[] };
    if (!parsed.users || !Array.isArray(parsed.users)) return;
    usersByEmail.clear();
    usersById.clear();
    for (const u of parsed.users) {
      if (!u || !u.email || !u.id) continue;
      if (!u.display_name) u.display_name = u.username || u.email.split('@')[0];
      usersByEmail.set(u.email.toLowerCase(), u);
      usersById.set(u.id, u);
    }
  } catch (err) {
    console.error('Failed to load users from disk:', err);
  }
}

function saveUsersToDisk() {
  try {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const users: StoredUser[] = Array.from(usersById.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist users to disk:', err);
  }
}

// Load existing users once on startup
loadUsersFromDisk();

function toAuthUser(u: StoredUser): { id: string; email?: string; user_metadata?: Record<string, unknown>; email_confirmed_at?: string; created_at?: string } {
  return {
    id: u.id,
    email: u.email,
    user_metadata: {
      username: u.username,
      full_name: u.display_name || u.username,
      avatar_url: u.avatar_url,
    },
    email_confirmed_at: new Date().toISOString(),
    created_at: u.created_at,
  };
}

export async function handleLogin(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password } = req.body ?? {};
  const e = typeof email === 'string' ? email.trim() : '';
  if (!e || !password) {
    return res.status(400).json({ error: 'Please enter both email and password.' });
  }

  let user = usersByEmail.get(e.toLowerCase());

  // Allow signing in with just the email prefix (e.g. "bericaandrei1" matches "bericaandrei1@gmail.com")
  if (!user && !e.includes('@')) {
    const prefix = e.toLowerCase();
    for (const [storedEmail, storedUser] of usersByEmail) {
      if (storedEmail.split('@')[0] === prefix) {
        user = storedUser;
        break;
      }
    }
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid login credentials.' });
  }
  const token = signToken({ sub: user.id, email: user.email });
  setAuthCookie(res, token);
  return res.status(200).json({
    user: toAuthUser(user),
    session: { access_token: token, accessToken: token },
  });
}

/**
 * Guest login: creates or reuses a lightweight guest account with random email.
 * No password required; intended only for local testing / demos.
 */
export async function handleGuestLogin(_req: Request, res: Response) {
  // Reuse a single in-memory guest to avoid unbounded growth.
  let guest = usersByEmail.get('guest@example.com');
  if (!guest) {
    const id = crypto.randomUUID();
    const uname = 'Guest';
    const avatar_url = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      uname,
    )}&background=random`;
    const created_at = new Date().toISOString();
    guest = {
      id,
      email: 'guest@example.com',
      passwordHash: hashPassword(crypto.randomUUID()),
      username: uname,
      display_name: uname,
      avatar_url,
      created_at,
    };
    usersByEmail.set('guest@example.com', guest);
    usersById.set(id, guest);
    saveUsersToDisk();
  }

  const token = signToken({ sub: guest.id, email: guest.email });
  setAuthCookie(res, token);
  return res.status(200).json({
    user: toAuthUser(guest),
    session: { access_token: token, accessToken: token },
  });
}

export async function handleRegister(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password, username, displayName, name: bodyName } = req.body ?? {};
  const e = typeof email === 'string' ? email.trim() : '';
  if (!e || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const key = e.toLowerCase();
  if (usersByEmail.has(key)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  const id = crypto.randomUUID();
  const uname = typeof username === 'string' && username.trim() ? username.trim() : e.split('@')[0];
  const rawDisplayName = displayName || bodyName;
  const dname = typeof rawDisplayName === 'string' && rawDisplayName.trim() ? rawDisplayName.trim() : uname;
  const avatar_url = `https://ui-avatars.com/api/?name=${encodeURIComponent(dname)}&background=random`;
  const created_at = new Date().toISOString();
  const stored: StoredUser = {
    id,
    email: e,
    passwordHash: hashPassword(password),
    username: uname,
    display_name: dname,
    avatar_url,
    created_at,
  };
  usersByEmail.set(key, stored);
  usersById.set(id, stored);
  saveUsersToDisk();
  const token = signToken({ sub: id, email: e });
  setAuthCookie(res, token);
  return res.status(201).json({
    user: toAuthUser(stored),
    session: { access_token: token, accessToken: token },
  });
}

export async function handleLogout(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  clearAuthCookie(res);
  return res.status(200).json({ ok: true });
}

export async function handleMe(req: Request, res: Response) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });
  const payload = verifyAuthToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired session.' });
  const user = usersById.get(payload.sub);
  if (!user) return res.status(401).json({ error: 'User not found.' });
  return res.status(200).json({
    user: toAuthUser(user),
    session: { access_token: token, accessToken: token },
  });
}

export async function handleDeleteAccount(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });
  const payload = verifyAuthToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired session.' });

  const user = usersById.get(payload.sub);
  if (user) {
    usersById.delete(user.id);
    usersByEmail.delete(user.email.toLowerCase());
    saveUsersToDisk();
  }

  clearAuthCookie(res);
  return res.status(200).json({ ok: true });
}

export async function handleResendConfirmation(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email } = req.body ?? {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' });
  }
  // No-op: no email sender configured. Return success so UI does not block.
  return res.status(200).json({ message: 'If an account exists, a confirmation email was sent.' });
}

export async function handleAppleStart(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(501).json({ error: 'Apple Sign-In is not configured. Use email/password for now.' });
}
