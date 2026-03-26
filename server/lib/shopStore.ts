import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface ShopItemRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  image_url: string | null;
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface ShopPurchaseRow {
  id: string;
  item_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  stripe_session_id: string;
  status: string;
  created_at: string;
}

interface ShopState {
  items: ShopItemRow[];
  purchases: ShopPurchaseRow[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHOP_FILE = path.join(__dirname, "..", "data", "shopItems.json");

let state: ShopState | null = null;

function empty(): ShopState {
  return { items: [], purchases: [] };
}

function load(): ShopState {
  if (state) return state;
  try {
    if (!fs.existsSync(SHOP_FILE)) {
      state = empty();
      return state;
    }
    const raw = fs.readFileSync(SHOP_FILE, "utf8");
    if (!raw.trim()) {
      state = empty();
      return state;
    }
    const parsed = JSON.parse(raw) as Partial<ShopState>;
    state = {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
    };
    return state;
  } catch {
    state = empty();
    return state;
  }
}

function save() {
  const s = load();
  try {
    const dir = path.dirname(SHOP_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SHOP_FILE, JSON.stringify(s, null, 2), "utf8");
  } catch (err) {
    console.error("[shop] persist failed:", err);
  }
}

export function listShopItems(filter: {
  category?: string;
  userId?: string;
  activeOnly?: boolean;
  limit?: number;
}): ShopItemRow[] {
  const s = load();
  let rows = [...s.items];
  if (filter.activeOnly !== false) {
    rows = rows.filter((r) => r.is_active);
  }
  if (filter.category && filter.category !== "all") {
    rows = rows.filter((r) => r.category === filter.category);
  }
  if (filter.userId) {
    rows = rows.filter((r) => r.user_id === filter.userId);
  }
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const lim = Math.min(200, Math.max(1, filter.limit ?? 50));
  return rows.slice(0, lim);
}

export function createShopItem(input: {
  user_id: string;
  title: string;
  description: string;
  price: number;
  image_url: string | null;
  category: string;
}): ShopItemRow {
  const s = load();
  const row: ShopItemRow = {
    id: crypto.randomUUID(),
    user_id: input.user_id,
    title: input.title.trim().slice(0, 200),
    description: input.description.trim().slice(0, 5000),
    price: Math.max(0, Number(input.price) || 0),
    image_url: input.image_url,
    category: input.category || "other",
    is_active: true,
    created_at: new Date().toISOString(),
  };
  s.items.push(row);
  save();
  return row;
}

export function getShopItemById(id: string): ShopItemRow | null {
  const s = load();
  return s.items.find((i) => i.id === id) ?? null;
}

export function markItemSold(id: string): boolean {
  const s = load();
  const item = s.items.find((i) => i.id === id);
  if (!item) return false;
  item.is_active = false;
  save();
  return true;
}

export function recordShopPurchase(input: {
  item_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  stripe_session_id: string;
}): ShopPurchaseRow {
  const s = load();
  const row: ShopPurchaseRow = {
    id: crypto.randomUUID(),
    item_id: input.item_id,
    buyer_id: input.buyer_id,
    seller_id: input.seller_id,
    amount: input.amount,
    stripe_session_id: input.stripe_session_id,
    status: "completed",
    created_at: new Date().toISOString(),
  };
  s.purchases.push(row);
  save();
  return row;
}

export function listShopPurchases(buyerId: string): ShopPurchaseRow[] {
  const s = load();
  return s.purchases
    .filter((p) => p.buyer_id === buyerId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
