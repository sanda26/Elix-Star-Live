import { Request, Response } from "express";
import { getTokenFromRequest, verifyAuthToken } from "./auth";
import { logger } from "../lib/logger";
import {
  getTestCoinBalance,
  mintTestCoins,
  spendTestCoinsForScore,
} from "../lib/testCoinStore";

function getAdminIds(): Set<string> {
  const fromAdmin = (process.env.ADMIN_USER_IDS || "").split(",");
  const fromVite = (process.env.VITE_ADMIN_USER_IDS || "").split(",");
  return new Set([...fromAdmin, ...fromVite].map((x) => x.trim()).filter(Boolean));
}

function requireAuth(req: Request, res: Response): { userId: string; email: string } | null {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return { userId: payload.sub, email: payload.email ?? "" };
}

function requireAdmin(req: Request, res: Response): { userId: string; email: string } | null {
  const auth = requireAuth(req, res);
  if (!auth) return null;

  const adminIds = getAdminIds();
  const isAdmin =
    adminIds.has(auth.userId) ||
    (auth.email ? adminIds.has(auth.email) : false) ||
    auth.email.endsWith("@elixstar.com");

  if (!isAdmin) {
    logger.warn({ userId: auth.userId, email: auth.email, route: req.originalUrl }, "Blocked non-admin test coin mint attempt");
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return auth;
}

export function handleGetTestCoinBalance(req: Request, res: Response) {
  const auth = requireAuth(req, res);
  if (!auth) return;
  return res.status(200).json({
    userId: auth.userId,
    coin_type: "test",
    test_coin_balance: getTestCoinBalance(auth.userId),
  });
}

export function handleMintTestCoins(req: Request, res: Response) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const body = req.body as { userId?: string; amount?: number; reason?: string; coin_type?: string };
  if (body.coin_type === "real") {
    logger.warn({ adminUserId: admin.userId, route: req.originalUrl }, "Blocked cross-coin operation: real coin action on /coins/test/mint");
    return res.status(400).json({ error: "coin_type_mismatch" });
  }

  const userId = (typeof body.userId === "string" && body.userId.trim()) || "";
  const amount = Number(body.amount);
  const result = mintTestCoins({
    adminUserId: admin.userId,
    userId,
    amount,
    reason: body.reason,
  });
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  return res.status(200).json({
    ok: true,
    coin_type: "test",
    userId,
    test_coin_balance: result.newBalance,
  });
}

export function handleSpendTestCoinsForScore(req: Request, res: Response) {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const body = req.body as {
    amount?: number;
    roomId?: string;
    target?: "host" | "opponent";
    coin_type?: string;
  };

  if (body.coin_type === "real") {
    logger.warn({ userId: auth.userId, route: req.originalUrl }, "Blocked cross-coin operation: real coin action on /coins/test/score");
    return res.status(400).json({ error: "coin_type_mismatch" });
  }

  const amount = Number(body.amount);
  const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
  const target = body.target === "host" ? "host" : "opponent";
  const result = spendTestCoinsForScore({
    userId: auth.userId,
    amount,
    roomId,
    target,
  });
  if (!result.success) {
    return res.status(result.error === "insufficient_funds" ? 400 : 422).json({
      error: result.error,
      coin_type: "test",
      test_coin_balance: result.newBalance,
    });
  }
  return res.status(200).json({
    ok: true,
    coin_type: "test",
    roomId,
    target,
    scoreDelta: result.scoreDelta,
    test_coin_balance: result.newBalance,
  });
}
