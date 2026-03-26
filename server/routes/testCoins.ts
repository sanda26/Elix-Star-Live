import { Request, Response } from "express";
import { getTokenFromRequest, verifyAuthToken } from "./auth";

const testCoinBalances = new Map<string, number>();

function resolveUserId(req: Request): string | null {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyAuthToken(token) : null;
  if (payload?.sub) return payload.sub;
  const bodyUserId =
    typeof (req.body as { userId?: unknown })?.userId === "string"
      ? String((req.body as { userId: string }).userId).trim()
      : "";
  return bodyUserId || null;
}

export function handleGetTestCoinBalance(req: Request, res: Response): void {
  const userId =
    (typeof req.query.userId === "string" && req.query.userId.trim()) ||
    resolveUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const balance = Math.max(0, Number(testCoinBalances.get(userId) ?? 0));
  res.status(200).json({ user_id: userId, test_coins: balance });
}

export function handleMintTestCoins(req: Request, res: Response): void {
  const userId = resolveUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const amount = Math.max(0, Math.floor(Number((req.body as { amount?: unknown })?.amount ?? 0)));
  if (amount <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }
  const next = Math.max(0, Number(testCoinBalances.get(userId) ?? 0) + amount);
  testCoinBalances.set(userId, next);
  res.status(200).json({ success: true, user_id: userId, test_coins: next });
}

export function handleSpendTestCoinsForScore(req: Request, res: Response): void {
  const userId = resolveUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const amount = Math.max(0, Math.floor(Number((req.body as { amount?: unknown })?.amount ?? 0)));
  if (amount <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }
  const current = Math.max(0, Number(testCoinBalances.get(userId) ?? 0));
  if (current < amount) {
    res.status(400).json({ error: "insufficient_test_coins", test_coins: current });
    return;
  }
  const next = current - amount;
  testCoinBalances.set(userId, next);
  res.status(200).json({ success: true, user_id: userId, test_coins: next });
}
