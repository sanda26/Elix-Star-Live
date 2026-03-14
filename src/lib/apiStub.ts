/**
 * Backend API stub — Node + Bunny + LiveKit.
 * Legacy call sites use this until migrated to fetch(apiUrl(...)) and useAuthStore.
 * Do not add new call sites; use apiUrl(), bunnyUpload(), and LiveKit SDK instead.
 */

const STUB_MSG = "Use backend API (Node + Bunny + LiveKit).";

function stubQuery() {
  const base: any = {
    then: (resolve: (v: any) => void) =>
      resolve({ data: null, error: { message: STUB_MSG } }),
  };
  return new Proxy(base, {
    get: (_t, prop) => {
      if (prop === "then") return base.then;
      return () => stubQuery();
    },
  });
}

export const apiStub = {
  auth: {
    async getSession() {
      return { data: { session: null }, error: null };
    },
    async getUser() {
      return { data: { user: null }, error: null };
    },
    async signInWithPassword() {
      return { data: { user: null, session: null }, error: { message: STUB_MSG } };
    },
    async signUp() {
      return { data: { user: null, session: null }, error: { message: STUB_MSG } };
    },
    async resend() {
      return { data: null, error: { message: STUB_MSG } };
    },
    async signOut() {
      return { error: null };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    async exchangeCodeForSession() {
      return { data: { session: null }, error: { message: STUB_MSG } };
    },
    async resetPasswordForEmail() {
      return { data: null, error: { message: STUB_MSG } };
    },
    async updateUser() {
      return { data: { user: null }, error: { message: STUB_MSG } };
    },
    async refreshSession() {
      return { data: { session: null }, error: null };
    },
    admin: undefined as any,
  },
  from: () => stubQuery(),
  functions: {
    invoke: () => Promise.resolve({ data: null, error: { message: STUB_MSG } }),
  },
  storage: {
    from: () => stubQuery(),
    getPublicUrl: () => ({ data: { publicUrl: "" } }),
    upload: () => stubQuery(),
    remove: () => stubQuery(),
    listBuckets: async () => ({ data: null, error: { message: STUB_MSG } }),
  },
  rpc: () => stubQuery(),
  channel: () => {
    const ch = {
      on: (..._args: any[]) => ch,
      async subscribe(cb?: (status: unknown) => void) {
        try {
          if (typeof cb === "function") cb("SUBSCRIBED");
        } catch {
          /* noop */
        }
        return {
          data: { subscription: { unsubscribe: () => {} } },
          error: null,
        };
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
