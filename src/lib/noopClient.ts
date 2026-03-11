/**
 * Placeholder client: no Supabase/Vercel/Railway/Appwrite. App stack is Bunny + Hetzner + LiveKit.
 * All data should eventually come from backend API (auth, feed, profiles). This stub returns
 * empty so the app does not throw. Replace call sites with fetch() to Node API as needed.
 */
const msg = 'Use backend API (Bunny + Hetzner + LiveKit stack).';

function noopQuery() {
  const base: any = {
    then: (resolve: (v: any) => void) => resolve({ data: null, error: { message: msg } }),
  };
  return new Proxy(base, {
    get: (_t, prop) => {
      if (prop === 'then') return base.then;
      return () => noopQuery();
    },
  });
}

export const noopClient = {
  auth: {
    async getSession() {
      return { data: { session: null }, error: null };
    },
    async getUser() {
      return { data: { user: null }, error: null };
    },
    async signInWithPassword() {
      return { data: { user: null, session: null }, error: { message: msg } };
    },
    async signUp() {
      return { data: { user: null, session: null }, error: { message: msg } };
    },
    async resend() {
      return { data: null, error: { message: msg } };
    },
    async signOut() {
      return { error: null };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    async exchangeCodeForSession() {
      return { data: { session: null }, error: { message: msg } };
    },
    async resetPasswordForEmail() {
      return { data: null, error: { message: msg } };
    },
    async updateUser() {
      return { data: { user: null }, error: { message: msg } };
    },
    async refreshSession() {
      return { data: { session: null }, error: null };
    },
    admin: undefined as any,
  },
  from: () => noopQuery(),
  functions: {
    invoke: () => Promise.resolve({ data: null, error: { message: msg } }),
  },
  storage: {
    from: () => noopQuery(),
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
    upload: () => noopQuery(),
    remove: () => noopQuery(),
    listBuckets: async () => ({ data: null, error: { message: msg } }),
  },
  rpc: () => noopQuery(),
  channel: () => {
    const channel = {
      // Keep API surface compatible with Supabase Realtime so calls like
      // client.channel(...).on(...).subscribe(cb) do NOT throw when backend is disabled.
      on: (..._args: any[]) => channel,
      async subscribe(_callback?: (status: unknown) => void) {
        try {
          if (typeof _callback === 'function') {
            _callback('SUBSCRIBED');
          }
        } catch {
          // ignore callback errors in noop client
        }
        return { data: { subscription: { unsubscribe: () => {} } }, error: null };
      },
      async send() {
        return { data: null, error: { message: msg } };
      },
    };
    return channel as any;
  },
  removeChannel: () => {},
  removeAllChannels: () => {},
} as any;

export const noopConfig = {
  url: undefined as string | undefined,
  anonKey: undefined as string | undefined,
  hasValidConfig: false,
};
