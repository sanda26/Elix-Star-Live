import { apiUrl } from "./api";
import { useAuthStore } from "../store/useAuthStore";

const STUB_MSG = "Backend adapter unavailable for this operation.";

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().session?.access_token;
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function requestJson(path: string, init: RequestInit = {}) {
  const res = await fetch(apiUrl(path), {
    credentials: "include",
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { data: null, error: body?.error ? { message: String(body.error) } : { message: `HTTP_${res.status}` } };
  return { data: body, error: null };
}

type Filter = { op: "eq" | "in"; col: string; val: any };
class QueryBuilder {
  private filters: Filter[] = [];
  private _limit: number | null = null;
  private _single = false;
  private _insert: any = null;
  private _update: any = null;
  private _delete = false;
  private _orExpr: string | null = null;
  private mode: "select" | "insert" | "update" | "delete" = "select";
  constructor(private table: string) {}
  select(_cols?: any, _opts?: any) {
    this.mode = "select";
    return this;
  }
  insert(v: any) { this._insert = v; this.mode = "insert"; return this; }
  update(v: any) { this._update = v; this.mode = "update"; return this; }
  delete() { this._delete = true; this.mode = "delete"; return this; }
  eq(col: string, val: any) { this.filters.push({ op: "eq", col, val }); return this; }
  in(col: string, val: any[]) { this.filters.push({ op: "in", col, val }); return this; }
  limit(n: number) { this._limit = n; return this; }
  order(_c: string, _o?: any) { return this; }
  or(expr: string) { this._orExpr = expr; return this; }
  single() {
    this._single = true;
    return this.exec(this.mode);
  }
  then(resolve: (v: any) => void) {
    return this.exec(this.mode).then(resolve);
  }

  private async exec(mode: "select" | "insert" | "update" | "delete") {
    try {
      if (this.table === "profiles" && mode === "select") {
        const isCount = this.filters.length === 1 && this.filters[0].col === "id";
        if (isCount) return { data: null, count: 0, error: null };
        const r = await requestJson("/api/profiles");
        return { data: r.data?.profiles ?? [], error: r.error, count: Array.isArray(r.data?.profiles) ? r.data.profiles.length : 0 };
      }
      if (this.table === "followers" && mode === "select") {
        const byFollowing = this.filters.find((f) => f.col === "following_id");
        const byFollower = this.filters.find((f) => f.col === "follower_id");
        if (byFollowing) {
          const r = await requestJson(`/api/profiles/${encodeURIComponent(String(byFollowing.val))}/followers`);
          return { data: null, count: Number(r.data?.count ?? 0), error: r.error };
        }
        if (byFollower) {
          const r = await requestJson(`/api/profiles/${encodeURIComponent(String(byFollower.val))}/following`);
          return { data: null, count: Number(r.data?.count ?? 0), error: r.error };
        }
      }
      if (this.table === "videos" && mode === "select") {
        const id = this.filters.find((f) => f.col === "id")?.val;
        if (id) {
          const r = await requestJson(`/api/videos/${encodeURIComponent(String(id))}`);
          return { data: this._single ? r.data : [r.data], error: r.error };
        }
      }
      if (this.table === "shop_items") {
        if (mode === "insert" && this._insert) {
          const r = await requestJson("/api/shop/items", { method: "POST", body: JSON.stringify(this._insert) });
          return { data: this._single ? r.data?.item : [r.data?.item], error: r.error };
        }
        if (mode === "select") {
          const r = await requestJson("/api/shop/items");
          return { data: r.data?.items ?? [], error: r.error };
        }
      }
      if (this.table === "reports" && mode === "insert" && this._insert) {
        const r = await requestJson("/api/report", { method: "POST", body: JSON.stringify(this._insert) });
        return { data: r.data, error: r.error };
      }
      if (this.table === "chat_threads") {
        if (mode === "insert" && this._insert) {
          const otherUserId = String(this._insert.user2_id || "");
          const r = await requestJson("/api/chat/threads/ensure", { method: "POST", body: JSON.stringify({ otherUserId }) });
          return { data: this._single ? { id: r.data?.threadId } : [{ id: r.data?.threadId }], error: r.error };
        }
        if (mode === "select") {
          if (this._orExpr) {
            const m = this._orExpr.match(/user2_id\.eq\.([^),]+)\).*user1_id\.eq\.([^),]+)/);
            const candidate = m?.[1] || m?.[2] || "";
            if (candidate) {
              const ensure = await requestJson("/api/chat/threads/ensure", {
                method: "POST",
                body: JSON.stringify({ otherUserId: candidate }),
              });
              if (ensure.error) return { data: null, error: ensure.error };
              return { data: this._single ? { id: ensure.data?.threadId } : [{ id: ensure.data?.threadId }], error: null };
            }
          }
          const r = await requestJson("/api/chat/threads");
          return { data: this._single ? r.data?.threads?.[0] ?? null : r.data?.threads ?? [], error: r.error };
        }
        if (mode === "update") {
          return { data: null, error: null };
        }
      }
      if (this.table === "messages" && mode === "insert" && this._insert) {
        const threadId = String(this._insert.thread_id || "");
        const text = String(this._insert.text || "");
        if (!threadId) return { data: null, error: { message: "missing_thread_id" } };
        const r = await requestJson(`/api/chat/threads/${encodeURIComponent(threadId)}/messages`, {
          method: "POST",
          body: JSON.stringify({ text }),
        });
        return { data: r.data, error: r.error };
      }
      if (this.table === "blocked_users") {
        return { data: null, error: null };
      }
      return { data: null, error: { message: STUB_MSG } };
    } catch (e: any) {
      return { data: null, error: { message: String(e?.message || "request_failed") } };
    }
  }
}

export const apiStub = {
  auth: {
    async getSession() {
      const session = useAuthStore.getState().session || null;
      return { data: { session }, error: null };
    },
    async getUser() {
      const r = await requestJson("/api/auth/me");
      return { data: { user: r.data?.user ?? null }, error: r.error };
    },
    async signInWithPassword(input: { email: string; password: string }) {
      const r = await requestJson("/api/auth/login", { method: "POST", body: JSON.stringify(input) });
      return { data: { user: r.data?.user ?? null, session: r.data?.session ?? null }, error: r.error };
    },
    async signUp(input: { email: string; password: string; options?: { data?: { username?: string } } }) {
      const r = await requestJson("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: input.email, password: input.password, username: input.options?.data?.username }),
      });
      return { data: { user: r.data?.user ?? null, session: r.data?.session ?? null }, error: r.error };
    },
    async resend(input: { email?: string }) {
      return requestJson("/api/auth/resend-confirmation", { method: "POST", body: JSON.stringify({ email: input.email }) });
    },
    async signOut() {
      const r = await requestJson("/api/auth/logout", { method: "POST" });
      return { error: r.error };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    async exchangeCodeForSession() {
      const r = await requestJson("/api/auth/me");
      return { data: { session: r.data?.session ?? null }, error: r.error };
    },
    async resetPasswordForEmail(email: string) {
      return requestJson("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    },
    async updateUser(input: { password?: string }) {
      if (!input?.password) return { data: { user: null }, error: { message: "password_required" } };
      const r = await requestJson("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ password: input.password }) });
      return { data: { user: r.data?.user ?? null }, error: r.error };
    },
    async refreshSession() {
      const r = await requestJson("/api/auth/me");
      return { data: { session: r.data?.session ?? null }, error: r.error };
    },
    admin: undefined as any,
  },
  from: (table: string) => new QueryBuilder(table),
  functions: {
    invoke: () => Promise.resolve({ data: null, error: { message: STUB_MSG } }),
  },
  storage: {
    from: () => new QueryBuilder("storage"),
    getPublicUrl: () => ({ data: { publicUrl: "" } }),
    upload: () => new QueryBuilder("storage_upload"),
    remove: () => new QueryBuilder("storage_remove"),
    listBuckets: async () => ({ data: null, error: { message: STUB_MSG } }),
  },
  rpc: () => new QueryBuilder("rpc"),
  channel: () => {
    const ch = {
      on: (..._args: any[]) => ch,
      async subscribe(cb?: (status: unknown) => void) {
        try { if (typeof cb === "function") cb("SUBSCRIBED"); } catch {}
        return { data: { subscription: { unsubscribe: () => {} } }, error: null };
      },
      async send() {
        return { data: null, error: { message: STUB_MSG } };
      },
    };
    return ch as any;
  },
  removeChannel: () => {},
  removeAllChannels: () => {},
} as any;

export const apiStubConfig = {
  url: undefined as string | undefined,
  anonKey: undefined as string | undefined,
  hasValidConfig: false,
};
