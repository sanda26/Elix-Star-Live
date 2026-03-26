import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface ChatThreadRow {
  id: string;
  user1_id: string;
  user2_id: string;
  last_at: string;
  last_message: string;
  created_at: string;
}

export interface ChatMessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  read: boolean;
}

interface ChatState {
  threads: ChatThreadRow[];
  messages: ChatMessageRow[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHAT_FILE = path.join(__dirname, "..", "data", "chat.json");

let state: ChatState | null = null;

function empty(): ChatState {
  return { threads: [], messages: [] };
}

function load(): ChatState {
  if (state) return state;
  try {
    if (!fs.existsSync(CHAT_FILE)) {
      state = empty();
      return state;
    }
    const raw = fs.readFileSync(CHAT_FILE, "utf8");
    if (!raw.trim()) {
      state = empty();
      return state;
    }
    const parsed = JSON.parse(raw) as Partial<ChatState>;
    state = {
      threads: Array.isArray(parsed.threads) ? parsed.threads : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
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
    const dir = path.dirname(CHAT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CHAT_FILE, JSON.stringify(s, null, 2), "utf8");
  } catch (err) {
    console.error("[chat] persist failed:", err);
  }
}

function isParticipant(thread: ChatThreadRow, userId: string): boolean {
  return thread.user1_id === userId || thread.user2_id === userId;
}

export function ensureThread(userId: string, otherUserId: string): ChatThreadRow {
  if (!userId || !otherUserId || userId === otherUserId) {
    throw new Error("invalid_participants");
  }
  const s = load();
  const existing = s.threads.find(
    (t) =>
      (t.user1_id === userId && t.user2_id === otherUserId) ||
      (t.user1_id === otherUserId && t.user2_id === userId),
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const thread: ChatThreadRow = {
    id: crypto.randomUUID(),
    user1_id: userId,
    user2_id: otherUserId,
    last_at: now,
    last_message: "",
    created_at: now,
  };
  s.threads.push(thread);
  save();
  return thread;
}

export function listThreadsForUser(userId: string, limit = 50): ChatThreadRow[] {
  const s = load();
  return s.threads
    .filter((t) => isParticipant(t, userId))
    .sort((a, b) => String(b.last_at).localeCompare(String(a.last_at)))
    .slice(0, Math.min(100, limit));
}

export function getThread(threadId: string, userId: string): ChatThreadRow | null {
  const s = load();
  const t = s.threads.find((x) => x.id === threadId);
  if (!t || !isParticipant(t, userId)) return null;
  return t;
}

export function listMessagesForThread(
  threadId: string,
  userId: string,
  limit = 200,
): ChatMessageRow[] {
  const t = getThread(threadId, userId);
  if (!t) return [];
  const s = load();
  return s.messages
    .filter((m) => m.thread_id === threadId)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .slice(-Math.min(500, limit));
}

export function appendMessage(
  threadId: string,
  senderId: string,
  text: string,
): ChatMessageRow | null {
  const t = getThread(threadId, senderId);
  if (!t) return null;
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) return null;

  const s = load();
  const msg: ChatMessageRow = {
    id: crypto.randomUUID(),
    thread_id: threadId,
    sender_id: senderId,
    text: trimmed,
    created_at: new Date().toISOString(),
    read: false,
  };
  s.messages.push(msg);
  const thread = s.threads.find((x) => x.id === threadId);
  if (thread) {
    thread.last_message = trimmed;
    thread.last_at = msg.created_at;
  }
  save();
  return msg;
}

export function unreadCountForThread(
  threadId: string,
  readerId: string,
): number {
  const t = getThread(threadId, readerId);
  if (!t) return 0;
  const s = load();
  return s.messages.filter(
    (m) =>
      m.thread_id === threadId &&
      m.sender_id !== readerId &&
      !m.read,
  ).length;
}
