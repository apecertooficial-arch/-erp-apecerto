"use client";

import { useEffect, useState } from "react";

// Registra o service worker e avisa quando existe versao nova.
// A troca so acontece quando a pessoa toca em "Atualizar": nunca no meio de um
// atendimento, para nao deixar o bundle antigo inconsistente com o novo.
export function RegistroPwa() {
  const [aguardando, setAguardando] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelado = false;

    const registrar = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        if (reg.waiting) setAguardando(reg.waiting);

        reg.addEventListener("updatefound", () => {
          const novo = reg.installing;
          if (!novo) return;
          novo.addEventListener("statechange", () => {
            // 'installed' com controller ativo = ja havia uma versao rodando.
            if (novo.state === "installed" && navigator.serviceWorker.controller && !cancelado) {
              setAguardando(novo);
            }
          });
        });
      } catch {
        // Sem service worker o ERP continua funcionando normalmente pela rede.
      }
    };

    void registrar();

    let recarregando = false;
    const aoTrocar = () => {
      if (recarregando) return;
      recarregando = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", aoTrocar);

    return () => {
      cancelado = true;
      navigator.serviceWorker.removeEventListener("controllerchange", aoTrocar);
    };
  }, []);

  if (!aguardando) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed", left: 16, right: 16, bottom: "calc(16px + env(safe-area-inset-bottom))",
        zIndex: 9999, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
        background: "#1d1d1f", color: "#fff", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,.24)",
        font: "14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      }}
    >
      <span style={{ flex: 1 }}>Nova versao disponivel.</span>
      <button
        type="button"
        onClick={() => aguardando.postMessage("ATUALIZAR_AGORA")}
        style={{
          padding: "8px 14px", fontWeight: 700, fontSize: 14, color: "#fff",
          background: "#ff6500", border: 0, borderRadius: 10, cursor: "pointer",
        }}
      >
        Atualizar
      </button>
    </div>
  );
}

/** Chamado no logout: apaga caches e estado local do usuario anterior. */
export async function limparDadosLocais() {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      reg?.active?.postMessage("LIMPAR_TUDO");
    }
    if ("caches" in window) {
      const nomes = await caches.keys();
      await Promise.all(nomes.map((n) => caches.delete(n)));
    }
    // Preserva apenas o que nao identifica ninguem.
    const preservar = new Set(["theme"]);
    for (const chave of Object.keys(localStorage)) {
      if (!preservar.has(chave)) localStorage.removeItem(chave);
    }
    sessionStorage.clear();
  } catch {
    // Melhor esforco: falha aqui nao pode impedir o logout.
  }
}
