export function getBrowserSupabaseClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "harness-test-only" } } }),
      refreshSession: async () => ({ data: { session: { access_token: "harness-test-only" } } }),
    },
  };
}
