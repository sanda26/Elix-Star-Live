import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_GIFTS_FILE = path.join(__dirname, "..", "..", "src", "lib", "gifts.ts");

let cachedGiftCoins: Map<string, number> | null = null;

function parseGiftCoins(): Map<string, number> {
  if (cachedGiftCoins) return cachedGiftCoins;

  const result = new Map<string, number>();

  try {
    const raw = fs.readFileSync(FRONTEND_GIFTS_FILE, "utf8");
    const pattern = /id:\s*'([^']+)'\s*,[\s\S]*?coins:\s*(\d+)/g;

    for (const match of raw.matchAll(pattern)) {
      const giftId = String(match[1] || "").trim();
      const coins = Number(match[2] || 0);
      if (giftId && Number.isFinite(coins) && coins > 0) {
        result.set(giftId, coins);
      }
    }
  } catch (error) {
    console.error("[gift-catalog] Failed to parse frontend gift catalog:", error);
  }

  cachedGiftCoins = result;
  return result;
}

export function getGiftCoinCost(giftId: string): number | null {
  if (!giftId) return null;
  const amount = parseGiftCoins().get(giftId);
  return Number.isFinite(amount) ? Number(amount) : null;
}
