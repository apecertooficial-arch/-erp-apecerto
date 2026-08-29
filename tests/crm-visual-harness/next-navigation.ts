import { useMemo, useSyncExternalStore } from "react";

const ouvir = (notificar: () => void) => {
  window.addEventListener("popstate", notificar);
  window.addEventListener("crm:harness:navigate", notificar);
  return () => {
    window.removeEventListener("popstate", notificar);
    window.removeEventListener("crm:harness:navigate", notificar);
  };
};

const caminho = () => window.location.pathname;

export function usePathname() {
  return useSyncExternalStore(ouvir, caminho, () => "/crm");
}

export function useRouter() {
  return useMemo(() => ({
    push(destino: string) {
      window.history.pushState(null, "", destino);
      window.dispatchEvent(new Event("crm:harness:navigate"));
    },
    replace(destino: string) {
      window.history.replaceState(null, "", destino);
      window.dispatchEvent(new Event("crm:harness:navigate"));
    },
    refresh() {
      window.dispatchEvent(new Event("crm:harness:navigate"));
    },
    back() { window.history.back(); },
    forward() { window.history.forward(); },
    prefetch: async () => undefined,
  }), []);
}
