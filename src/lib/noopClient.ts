/**
 * Stub client when backend is not configured. Use for call sites that must not throw.
 */
const msg = 'Database not configured.';

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
  channel: () => ({
    subscribe: () => {},
    send: () => Promise.resolve(),
    on: () => ({}),
  }),
  removeChannel: () => {},
  removeAllChannels: () => {},
} as any;

export const noopConfig = {
  url: undefined as string | undefined,
  anonKey: undefined as string | undefined,
  hasValidConfig: false,
};
