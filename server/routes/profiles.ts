/**
 * Profile API for Express backend.
 * GET /api/profiles/:userId, PATCH /api/profiles/:userId, POST /api/profiles (seed),
 * GET followers/following, POST follow/unfollow.
 * In-memory store; replace with DB when ready.
 */

import { Request, Response } from "express";
import { getTokenFromRequest, verifyAuthToken } from "./auth";

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

function getOrCreateProfile(userId: string, seed?: Partial<Profile>): Profile {
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

/** POST /api/profiles — seed/upsert (e.g. after auth); no auth required */
export function handleSeedProfile(req: Request, res: Response): void {
  const body = req.body as { userId?: string; username?: string; email?: string; avatarUrl?: string };
  const { userId, username, email, avatarUrl } = body ?? {};

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const fallbackUsername = username ?? (email ? email.split("@")[0] : undefined);
  const profile = getOrCreateProfile(userId, {
    username: fallbackUsername,
    displayName: fallbackUsername,
    avatarUrl,
  });
  res.status(201).json({ profile });
}
