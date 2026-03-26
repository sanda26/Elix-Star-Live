import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export type PurchaseProvider = "apple" | "google" | "stripe" | "manual";

export interface WalletPurchaseRecord {
  id: string;
  userId: string;
  provider: PurchaseProvider;
  providerTransactionId: string;
  productId: string;
  coins: number;
  status: "completed";
  receiptHash: string;
  verification: Record<string, unknown>;
  createdAt: string;
}

export interface WalletGiftDebitRecord {
  id: string;
  userId: string;
  giftId: string;
  roomId: string;
  coins: number;
  clientTransactionId: string;
  createdAt: string;
}

interface WalletState {
  balances: Record<string, number>;
  purchases: WalletPurchaseRecord[];
  giftDebits: WalletGiftDebitRecord[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WALLET_FILE = path.join(__dirname, "..", "data", "wallet.json");

let walletState: WalletState | null = null;

function emptyState(): WalletState {
  return {
    balances: {},
    purchases: [],
    giftDebits: [],
  };
}

function loadState(): WalletState {
  if (walletState) return walletState;

  try {
    if (!fs.existsSync(WALLET_FILE)) {
      walletState = emptyState();
      return walletState;
    }

    const raw = fs.readFileSync(WALLET_FILE, "utf8");
    if (!raw.trim()) {
      walletState = emptyState();
      return walletState;
    }

    const parsed = JSON.parse(raw) as Partial<WalletState>;
    walletState = {
      balances: parsed.balances ?? {},
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
      giftDebits: Array.isArray(parsed.giftDebits) ? parsed.giftDebits : [],
    };
    return walletState;
  } catch (error) {
    console.error("[wallet] Failed to load wallet store:", error);
    walletState = emptyState();
    return walletState;
  }
}

function saveState() {
  const state = loadState();
  try {
    const dir = path.dirname(WALLET_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(WALLET_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (error) {
    console.error("[wallet] Failed to persist wallet store:", error);
  }
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function getWalletBalance(userId: string): number {
  if (!userId) return 0;
  const state = loadState();
  return Math.max(0, Number(state.balances[userId] || 0));
}

export function getWalletSummary(userId: string) {
  return {
    userId,
    coins: getWalletBalance(userId),
  };
}

/** Sync local JSON cache to match Neon after server-side balance changes */
export function setUserBalanceCache(userId: string, coins: number) {
  if (!userId) return;
  const state = loadState();
  state.balances[userId] = Math.max(0, Math.floor(coins));
  saveState();
}

export function listWalletTransactions(userId: string, limit = 50) {
  const state = loadState();

  const purchases = state.purchases
    .filter((row) => row.userId === userId)
    .map((row) => ({
      id: row.id,
      type: "purchase" as const,
      coinsDelta: row.coins,
      createdAt: row.createdAt,
      provider: row.provider,
      productId: row.productId,
      providerTransactionId: row.providerTransactionId,
      status: row.status,
    }));

  const debits = state.giftDebits
    .filter((row) => row.userId === userId)
    .map((row) => ({
      id: row.id,
      type: "gift_debit" as const,
      coinsDelta: -row.coins,
      createdAt: row.createdAt,
      giftId: row.giftId,
      roomId: row.roomId,
      clientTransactionId: row.clientTransactionId,
      status: "completed" as const,
    }));

  return [...purchases, ...debits]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

export function findPurchaseByProviderTransaction(
  provider: PurchaseProvider,
  providerTransactionId: string,
): WalletPurchaseRecord | null {
  if (!providerTransactionId) return null;
  const state = loadState();
  return (
    state.purchases.find(
      (row) =>
        row.provider === provider &&
        row.providerTransactionId === providerTransactionId,
    ) ?? null
  );
}

export function creditVerifiedPurchase(input: {
  userId: string;
  provider: PurchaseProvider;
  providerTransactionId: string;
  productId: string;
  coins: number;
  rawReceipt: string;
  verification: Record<string, unknown>;
}) {
  const state = loadState();
  const existing = findPurchaseByProviderTransaction(
    input.provider,
    input.providerTransactionId,
  );

  if (existing) {
    return {
      alreadyProcessed: true,
      purchase: existing,
      newBalance: getWalletBalance(existing.userId),
    };
  }

  const createdAt = new Date().toISOString();
  const purchase: WalletPurchaseRecord = {
    id: crypto.randomUUID(),
    userId: input.userId,
    provider: input.provider,
    providerTransactionId: input.providerTransactionId,
    productId: input.productId,
    coins: Math.max(0, Math.floor(input.coins)),
    status: "completed",
    receiptHash: sha256(input.rawReceipt || input.providerTransactionId),
    verification: input.verification,
    createdAt,
  };

  const nextBalance = getWalletBalance(input.userId) + purchase.coins;
  state.balances[input.userId] = nextBalance;
  state.purchases.push(purchase);
  saveState();

  return {
    alreadyProcessed: false,
    purchase,
    newBalance: nextBalance,
  };
}

export function addManualCoins(input: {
  userId: string;
  amount: number;
  reason?: string;
}) {
  const amount = Math.max(0, Math.floor(input.amount));
  if (!input.userId || amount <= 0) {
    return { newBalance: getWalletBalance(input.userId) };
  }

  const state = loadState();
  const nextBalance = getWalletBalance(input.userId) + amount;
  state.balances[input.userId] = nextBalance;
  state.purchases.push({
    id: crypto.randomUUID(),
    userId: input.userId,
    provider: "manual",
    providerTransactionId: `manual:${input.reason || "topup"}:${Date.now()}`,
    productId: input.reason || "manual_topup",
    coins: amount,
    status: "completed",
    receiptHash: sha256(`${input.userId}:${amount}:${input.reason || ""}:${Date.now()}`),
    verification: { reason: input.reason || "manual_topup" },
    createdAt: new Date().toISOString(),
  });
  saveState();
  return { newBalance: nextBalance };
}

export function debitGiftCoins(input: {
  userId: string;
  giftId: string;
  roomId: string;
  coins: number;
  clientTransactionId: string;
}) {
  const state = loadState();
  const coins = Math.max(0, Math.floor(input.coins));
  const existing = state.giftDebits.find(
    (row) =>
      row.userId === input.userId &&
      row.clientTransactionId === input.clientTransactionId,
  );

  if (existing) {
    return {
      success: true,
      alreadyProcessed: true,
      newBalance: getWalletBalance(input.userId),
      debit: existing,
    };
  }

  const currentBalance = getWalletBalance(input.userId);
  if (coins <= 0) {
    return { success: false, error: "invalid_amount", newBalance: currentBalance };
  }
  if (currentBalance < coins) {
    return {
      success: false,
      error: "insufficient_funds",
      newBalance: currentBalance,
    };
  }

  const debit: WalletGiftDebitRecord = {
    id: crypto.randomUUID(),
    userId: input.userId,
    giftId: input.giftId,
    roomId: input.roomId,
    coins,
    clientTransactionId: input.clientTransactionId,
    createdAt: new Date().toISOString(),
  };

  const nextBalance = currentBalance - coins;
  state.balances[input.userId] = nextBalance;
  state.giftDebits.push(debit);
  saveState();

  return {
    success: true,
    alreadyProcessed: false,
    newBalance: nextBalance,
    debit,
  };
}
