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

/* Prefixos que pertencem ao ApeCerto. Tudo fora desta lista fica intacto.
 *
 * A versao anterior apagava TODAS as chaves menos "theme" -- amplo demais.
 * A primeira tentativa de estreitar errou para o outro lado: cobria so
 * "apecerto-" e "sb-", e a homologacao em producao mostrou que ficavam para
 * tras apecerto_os_v1, ncrm_onboarding_v1_<uuid> e ncrm:variante:<uuid>.
 * As duas ultimas carregam o ID do usuario. Em aparelho compartilhado -- o
 * caso normal numa imobiliaria -- isso e vazamento entre pessoas.
 *
 * A lista abaixo saiu das chaves REAIS observadas em producao, nao de
 * suposicao. Os dois separadores existem de fato ("-" e "_").
 *
 * apecerto-  apecerto-notif-read, apecerto-lead-tab-order, apecerto-alert-*
 * apecerto_  apecerto_os_v1, apecerto_kb, apecerto_onboard
 * ncrm_      ncrm_onboarding_v1_<uuid>
 * ncrm:      ncrm:variante:<uuid>, ncrm:wa*
 * sb-        token de sessao do supabase-js
 */
const PREFIXOS_APECERTO: readonly string[] = ["apecerto-", "apecerto_", "ncrm_", "ncrm:", "sb-"];
const PREFIXOS_SESSAO: readonly string[] = ["apecerto-", "apecerto_", "ncrm_", "ncrm:"];

const pertenceAoApp = (chave: string, prefixos: readonly string[]) => prefixos.some((p) => chave.startsWith(p));

/** Nome de cache criado por este app (ver public/sw.js: apecerto-v1, estatico-apecerto-v1). */
const cacheDoApp = (nome: string) => nome.includes("apecerto");

export type ResultadoLimpeza = { tipo: "LIMPEZA_CONCLUIDA"; recacheado: boolean };

/* Teto de espera pela confirmacao do service worker.
 * Sem teto, um worker travado penduraria o logout para sempre -- e ficar preso
 * numa tela de saida e pior do que sair com o cache em estado incerto. O dado
 * sensivel (localStorage e sessionStorage) e limpo aqui de qualquer forma. */
const LIMITE_CONFIRMACAO_MS = 4000;

/* Pede a limpeza ao service worker e ESPERA a confirmacao.
 *
 * Antes isso era postMessage e segue o baile: a pagina recarregava enquanto o
 * worker ainda apagava, e nada recriava a tela offline. Agora ha porta de volta
 * (MessageChannel) e o worker so responde depois de apagar E recriar.
 *
 * Devolve null quando nao ha worker ou quando ele nao responde a tempo -- ai a
 * propria pagina faz a parte dela. */
function pedirLimpezaAoServiceWorker(): Promise<ResultadoLimpeza | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) { resolve(null); return; }
    navigator.serviceWorker.getRegistration()
      .then((reg) => {
        const worker = reg?.active;
        if (!worker) { resolve(null); return; }
        const canal = new MessageChannel();
        const relogio = setTimeout(() => resolve(null), LIMITE_CONFIRMACAO_MS);
        canal.port1.onmessage = (e: MessageEvent) => { clearTimeout(relogio); resolve(e.data ?? null); };
        worker.postMessage("LIMPAR_TUDO", [canal.port2]);
      })
      .catch(() => resolve(null));
  });
}

/** Chamado no logout: apaga caches e estado local DO APECERTO. Nada mais.
 *
 * Quem manda nos caches e o service worker: ele apaga e recria a casca publica
 * (so /offline.html) numa operacao so, e confirma no fim. Esperar essa
 * confirmacao e o que evita o reload pegar a limpeza pela metade. */
export async function limparDadosLocais(): Promise<ResultadoLimpeza | null> {
  const confirmacao = await pedirLimpezaAoServiceWorker();

  /* Sem worker, ou sem resposta a tempo: a pagina apaga os caches deste app.
     Nao recriamos nada por aqui de proposito -- recriar exige rede, e o logout
     nao pode ficar dependente disso. Fica sem tela offline ate a proxima visita,
     que e exatamente o que o sw.js ja resolve sozinho. */
  if (!confirmacao) {
    try {
      if (typeof window !== "undefined" && "caches" in window) {
        const nomes = await caches.keys();
        await Promise.all(nomes.filter(cacheDoApp).map((n) => caches.delete(n)));
      }
    } catch { /* melhor esforco: nao pode impedir o logout */ }
  }

  /* Storage e sempre limpo, em bloco proprio: uma falha no cache nao pode
     deixar token e estado do usuario anterior no aparelho. */
  try {
    for (const chave of Object.keys(localStorage)) {
      if (pertenceAoApp(chave, PREFIXOS_APECERTO)) localStorage.removeItem(chave);
    }
    for (const chave of Object.keys(sessionStorage)) {
      if (pertenceAoApp(chave, PREFIXOS_SESSAO)) sessionStorage.removeItem(chave);
    }
  } catch { /* modo privado pode barrar o acesso ao storage */ }

  return confirmacao;
}
