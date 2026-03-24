import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface TestCoinMintRecord {
  id: string;
  adminUserId: string;
  userId: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface TestCoinScoreRecord {
  id: string;
  userId: string;
  amountSpent: number;
  scoreDelta: number;
  roomId: string;
  target: "host" | "opponent";
  createdAt: string;
}

interface TestCoinState {
  balances: Record<string, number>;
  mints: TestCoinMintRecord[];
  scoreDebits: TestCoinScoreRecord[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_COIN_FILE = path.join(__dirname, "..", "data", "testCoins.json");

let testCoinState: TestCoinState | null = null;

function emptyState(): TestCoinState {
  return {
    balances: {},
    mints: [],
    scoreDebits: [],
  };
}

function loadState(): TestCoinState {
  if (testCoinState) return testCoinState;

  try {
    if (!fs.existsSync(TEST_COIN_FILE)) {
      testCoinState = emptyState();
      return testCoinState;
    }

    const raw = fs.readFileSync(TEST_COIN_FILE, "utf8");
    if (!raw.trim()) {
      testCoinState = emptyState();
      return testCoinState;
    }

    const parsed = JSON.parse(raw) as Partial<TestCoinState>;
    testCoinState = {
      balances: parsed.balances ?? {},
      mints: Array.isArray(parsed.mints) ? parsed.mints : [],
      scoreDebits: Array.isArray(parsed.scoreDebits) ? parsed.scoreDebits : [],
    };
    return testCoinState;
  } catch {
    testCoinState = emptyState();
    return testCoinState;
  }
}

function saveState() {
  const state = loadState();
  const dir = path.dirname(TEST_COIN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TEST_COIN_FILE, JSON.stringify(state, null, 2), "utf8");
}

export function getTestCoinBalance(userId: string): number {
  if (!userId) return 0;
  const state = loadState();
  return Math.max(0, Number(state.balances[userId] || 0));
}

export function mintTestCoins(input: {
  adminUserId: string;
  userId: string;
  amount: number;
  reason?: string;
}) {
  const amount = Math.max(0, Math.floor(input.amount));
  if (!input.adminUserId || !input.userId || amount <= 0) {
    return { success: false as const, error: "invalid_input", newBalance: getTestCoinBalance(input.userId) };
  }

  const state = loadState();
  const nextBalance = getTestCoinBalance(input.userId) + amount;
  state.balances[input.userId] = nextBalance;
  state.mints.push({
    id: crypto.randomUUID(),
    adminUserId: input.adminUserId,
    userId: input.userId,
    amount,
    reason: input.reason?.trim() || "admin_mint",
    createdAt: new Date().toISOString(),
  });
  saveState();
  return { success: true as const, newBalance };
}

export function spendTestCoinsForScore(input: {
  userId: string;
  amount: number;
  roomId: string;
  target: "host" | "opponent";
}) {
  const amount = Math.max(0, Math.floor(input.amount));
  const current = getTestCoinBalance(input.userId);
  if (!input.userId || !input.roomId || amount <= 0) {
    return { success: false as const, error: "invalid_input", newBalance: current };
  }
  if (current < amount) {
    return { success: false as const, error: "insufficient_funds", newBalance: current };
  }

  const state = loadState();
  const nextBalance = current - amount;
  const record: TestCoinScoreRecord = {
    id: crypto.randomUUID(),
    userId: input.userId,
    amountSpent: amount,
    scoreDelta: amount,
    roomId: input.roomId,
    target: input.target,
    createdAt: new Date().toISOString(),
  };

  state.balances[input.userId] = nextBalance;
  state.scoreDebits.push(record);
  saveState();
  return { success: true as const, newBalance: nextBalance, scoreDelta: amount, record };
}
