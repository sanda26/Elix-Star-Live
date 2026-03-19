/**
 * Profile API for Express backend.
 * GET /api/profiles/:userId, PATCH /api/profiles/:userId, POST /api/profiles (seed),
 * GET followers/following, POST follow/unfollow.
 * In-memory store; replace with DB when ready.
 */

import { Request, Response } from "express";
import { getTokenFromRequest, verifyAuthToken } from "./auth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface Profile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  website: string;
  followers: number;
  following: number;
  videoCount: number;
  coins: number;
  level: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

const profiles = new Map<string, Profile>();

type StoredUserRow = { id: string; email?: string; username?: string; avatar_url?: string };

function readUsersFromDisk(): StoredUserRow[] {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const usersFile = path.join(__dirname, "..", "data", "users.json");
    if (!fs.existsSync(usersFile)) return [];
    const raw = fs.readFileSync(usersFile, "utf8");
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw) as { users?: StoredUserRow[] };
    return Array.isArray(parsed.users) ? parsed.users.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function getOrCreateProfile(userId: string, seed?: Partial<Profile>): Profile {
  const existing = profiles.get(userId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const profile: Profile = {
    userId,
    username: seed?.username ?? `user_${userId.slice(0, 8)}`,
    displayName: seed?.displayName ?? seed?.username ?? `User ${userId.slice(0, 8)}`,
    avatarUrl:
      seed?.avatarUrl ??
      `https://ui-avatars.com/api/?name=${encodeURIComponent(seed?.username ?? userId.slice(0, 8))}&background=random`,
    bio: seed?.bio ?? "",
    website: seed?.website ?? "",
    followers: seed?.followers ?? 0,
    following: seed?.following ?? 0,
    videoCount: seed?.videoCount ?? 0,
    coins: seed?.coins ?? 0,
    level: seed?.level ?? 1,
    isVerified: seed?.isVerified ?? false,
    createdAt: seed?.createdAt ?? now,
    updatedAt: now,
  };
  profiles.set(userId, profile);
  return profile;
}

/** GET /api/profiles/:userId */
export function handleGetProfile(req: Request, res: Response): void {
  const userId = req.params.userId;
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  const profile = getOrCreateProfile(userId);
  res.json({ profile });
}

/** GET /api/profiles — list all known users/profiles */
export function handleListProfiles(_req: Request, res: Response): void {
  // Merge in-memory profiles + persisted auth users
  const merged = new Map<string, Profile>();
  for (const p of profiles.values()) merged.set(p.userId, p);

  const users = readUsersFromDisk();
  for (const u of users) {
    if (!u?.id) continue;
    const username =
      (typeof u.username === "string" && u.username.trim()) ||
      (typeof u.email === "string" && u.email.includes("@") ? u.email.split("@")[0] : "") ||
      `user_${u.id.slice(0, 8)}`;
    const avatarUrl =
      (typeof u.avatar_url === "string" && u.avatar_url.trim()) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`;
    const p = getOrCreateProfile(u.id, { username, displayName: username, avatarUrl });
    merged.set(p.userId, p);
  }

  const list = Array.from(merged.values()).map((p) => ({
    user_id: p.userId,
    username: p.username,
    display_name: p.displayName,
    avatar_url: p.avatarUrl,
    level: p.level,
    is_creator: p.isVerified,
    followers_count: p.followers,
    following_count: p.following,
  }));
  res.json({ profiles: list });
}

/** GET /api/profiles/:userId/followers */
export function handleGetFollowers(req: Request, res: Response): void {
  const userId = req.params.userId;
  const profile = getOrCreateProfile(userId);
  res.json({ count: profile.followers, followers: [] });
}

/** GET /api/profiles/:userId/following */
export function handleGetFollowing(req: Request, res: Response): void {
  const userId = req.params.userId;
  const profile = getOrCreateProfile(userId);
  res.json({ count: profile.following, following: [] });
}

/** PATCH /api/profiles/:userId — auth required, own profile only */
export function handlePatchProfile(req: Request, res: Response): void {
  const userId = req.params.userId;
  const token = getTokenFromRequest(req);
  const jwtUser = token ? verifyAuthToken(token) : null;

  if (!jwtUser || jwtUser.sub !== userId) {
    res.status(403).json({ error: "Forbidden: cannot update another user's profile" });
    return;
  }

  const profile = getOrCreateProfile(userId);
  const allowed = ["username", "displayName", "avatarUrl", "bio", "website", "level", "coins"] as const;
  for (const key of allowed) {
    const val = (req.body as Record<string, unknown>)[key];
    if (val !== undefined) {
      (profile as Record<string, unknown>)[key] = val;
    }
  }
  profile.updatedAt = new Date().toISOString();
  profiles.set(userId, profile);
  res.json({ profile });
}

/** POST /api/profiles/:userId/follow — auth required */
export function handleFollow(req: Request, res: Response): void {
  const userId = req.params.userId;
  const token = getTokenFromRequest(req);
  const jwtUser = token ? verifyAuthToken(token) : null;

  if (!jwtUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (jwtUser.sub === userId) {
    res.status(400).json({ error: "Cannot follow yourself" });
    return;
  }

  const target = getOrCreateProfile(userId);
  const follower = getOrCreateProfile(jwtUser.sub);
  target.followers = Math.max(0, target.followers + 1);
  follower.following = Math.max(0, follower.following + 1);
  profiles.set(userId, target);
  profiles.set(jwtUser.sub, follower);
  res.json({ success: true, followers: target.followers });
}

/** POST /api/profiles/:userId/unfollow — auth required */
export function handleUnfollow(req: Request, res: Response): void {
  const userId = req.params.userId;
  const token = getTokenFromRequest(req);
  const jwtUser = token ? verifyAuthToken(token) : null;

  if (!jwtUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const target = getOrCreateProfile(userId);
  const follower = getOrCreateProfile(jwtUser.sub);
  target.followers = Math.max(0, target.followers - 1);
  follower.following = Math.max(0, follower.following - 1);
  profiles.set(userId, target);
  profiles.set(jwtUser.sub, follower);
  res.json({ success: true, followers: target.followers });
}

/** GET /api/profiles/by-username/:username */
export function handleGetProfileByUsername(req: Request, res: Response): void {
  const username = req.params.username;
  if (!username) {
    res.status(400).json({ error: "username is required" });
    return;
  }
  for (const profile of profiles.values()) {
    if (profile.username === username || profile.displayName === username) {
      res.json({
        user_id: profile.userId,
        username: profile.username,
        display_name: profile.displayName,
        avatar_url: profile.avatarUrl,
        bio: profile.bio,
        level: profile.level,
        followers_count: profile.followers,
        following_count: profile.following,
      });
      return;
    }
  }
  res.status(404).json({ error: "Profile not found" });
}

/** POST /api/test-coins — add test coins to current user */
export function handleAddTestCoins(req: Request, res: Response): void {
  const token = getTokenFromRequest(req);
  const jwtUser = token ? verifyAuthToken(token) : null;
  if (!jwtUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { amount } = req.body ?? {};
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0 || numAmount > 100000000) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }
  const profile = getOrCreateProfile(jwtUser.sub);
  profile.coins += numAmount;
  profiles.set(jwtUser.sub, profile);
  res.json({ success: true, coins: profile.coins });
}

/** POST /api/profiles — seed/upsert (e.g. after auth); no auth required */
export function handleSeedProfile(req: Request, res: Response): void {
  const body = req.body as { userId?: string; username?: string; displayName?: string; email?: string; avatarUrl?: string };
  const { userId, username, displayName, email, avatarUrl } = body ?? {};

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const fallbackUsername = username ?? (email ? email.split("@")[0] : undefined);
  const profile = getOrCreateProfile(userId, {
    username: fallbackUsername,
    displayName: displayName || fallbackUsername,
    avatarUrl,
  });
  res.status(201).json({ profile });
}
