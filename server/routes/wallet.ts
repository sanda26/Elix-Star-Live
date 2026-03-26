import { Request, Response } from "express";
import { getTokenFromRequest, verifyAuthToken } from "./auth";
import { getWalletSummary, listWalletTransactions, setUserBalanceCache } from "../lib/walletStore";
import { getPool } from "../lib/postgres";
import { neonGetCoinBalance, neonListLedger } from "../lib/walletNeon";

function requireAuth(req: Request, res: Response): { userId: string } | null {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "Not authenticated." });
    return null;
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session." });
    return null;
  }

  return { userId: payload.sub };
}

export async function handleGetWallet(req: Request, res: Response) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  if (getPool()) {
    const nb = await neonGetCoinBalance(auth.userId);
    if (nb !== null) {
      setUserBalanceCache(auth.userId, nb);
      return res.status(200).json({ userId: auth.userId, coins: nb });
    }
  }

  return res.status(200).json(getWalletSummary(auth.userId));
}

export async function handleGetWalletTransactions(req: Request, res: Response) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
  if (getPool()) {
    const rows = await neonListLedger(auth.userId, limit);
    if (rows.length > 0) {
      return res.status(200).json({ userId: auth.userId, transactions: rows });
    }
  }
  return res.status(200).json({
    userId: auth.userId,
    transactions: listWalletTransactions(auth.userId, limit),
  });
}
