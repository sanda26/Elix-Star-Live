import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface PromotePurchaseRecord {
  id: string;
  userId: string;
  provider: "apple" | "google";
  providerTransactionId: string;
  productId: string;
  contentType: string;
  contentId: string;
  goal: string;
  amountGbp: number;
  status: "completed";
  createdAt: string;
}

interface PromoteState {
  purchases: PromotePurchaseRecord[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_FILE = path.join(__dirname, "..", "data", "promote-purchases.json");

let state: PromoteState | null = null;

function loadState(): PromoteState {
  if (state) return state;
  try {
    if (!fs.existsSync(STORE_FILE)) {
      state = { purchases: [] };
      return state;
    }
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<PromoteState>;
    state = {
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
    };
  } catch (error) {
    console.error("[promote] Failed to load purchase store:", error);
    state = { purchases: [] };
  }
  return state;
}

function saveState() {
  const current = loadState();
  try {
    const dir = path.dirname(STORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(current, null, 2), "utf8");
  } catch (error) {
    console.error("[promote] Failed to save purchase store:", error);
  }
}

export function findPromotePurchaseByTransaction(providerTransactionId: string) {
  return (
    loadState().purchases.find(
      (row) => row.providerTransactionId === providerTransactionId,
    ) ?? null
  );
}

export function recordPromotePurchase(input: Omit<PromotePurchaseRecord, "id" | "createdAt" | "status">) {
  const existing = findPromotePurchaseByTransaction(input.providerTransactionId);
  if (existing) {
    return { alreadyProcessed: true, purchase: existing };
  }

  const purchase: PromotePurchaseRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "completed",
    ...input,
  };

  const current = loadState();
  current.purchases.push(purchase);
  saveState();

  return { alreadyProcessed: false, purchase };
}
