type Canal = { on: () => Canal; subscribe: () => Canal };

const canal: Canal = {
  on: () => canal,
  subscribe: () => canal,
};

export function getBrowserSupabaseClient() {
  return {
    channel: () => canal,
    removeChannel: async () => undefined,
  };
}
