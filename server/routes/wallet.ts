import { Request, Response } from "express";
import { getTokenFromRequest, verifyAuthToken } from "./auth";
import { getWalletSummary, listWalletTransactions } from "../lib/walletStore";

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

export function handleGetWallet(req: Request, res: Response) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  return res.status(200).json(getWalletSummary(auth.userId));
}

export function handleGetWalletTransactions(req: Request, res: Response) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
  return res.status(200).json({
    userId: auth.userId,
    transactions: listWalletTransactions(auth.userId, limit),
  });
}
