"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/* Registro do service worker.
 *
 * DEPLOY QUE ASSUME SOZINHO (correcao de agosto/2026).
 * Antes, a troca de versao dependia de alguem tocar em "Atualizar" e o /sw.js
 * era identico a cada build -- o navegador nem percebia que havia versao nova, e
 * o F5 comum continuava servindo o app velho.
 *
 * Agora:
 *   - registramos /sw.js?v=<build>. A query muda a cada deploy, entao o arquivo
 *     muda, o worker novo instala e o cache dele nasce com outro nome (o proprio
 *     sw.js le esse `v` para versionar o cache e apagar o antigo no activate);
 *   - o install chama skipWaiting e o activate chama clients.claim, ou seja a
 *     versao nova assume sem pedir licenca;
 *   - pedimos reg.update() ao abrir e ao voltar para a aba, para o navegador
 *     conferir o build sem esperar o ciclo dele.
 *
 * A recarga automatica acontece SO com a aba em segundo plano. Recarregar por
 * cima de quem esta digitando um atendimento perde texto -- e, com o worker novo
 * ja no ar, o proximo F5 da pessoa ja traz tudo novo. Quando a aba esta na frente
 * mostramos um aviso discreto com o botao de recarregar.
 */

async function buildPublicado() {
  try {
    const resposta = await fetch("/api/build", { cache: "no-store" });
    const corpo = await resposta.json() as { build?: unknown };
    if (resposta.ok && typeof corpo.build === "string" && /^[a-zA-Z0-9._-]{1,80}$/.test(corpo.build)) {
      return corpo.build;
    }
  } catch {
    // A casca continua abrindo mesmo se a consulta de versão falhar.
  }
  /* Fallback deliberadamente estável: Date.now() criava um service worker novo
     em CADA recarga e deixava o aviso de atualização em ciclo infinito. */
  return "estavel";
}

export function RegistroPwa() {
  const [precisaRecarregar, setPrecisaRecarregar] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let registro: ServiceWorkerRegistration | null = null;

    const registrar = async () => {
      try {
        const build = await buildPublicado();
        registro = await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(build)}`, { scope: "/" });
        /* updateViaCache padrao pode servir o proprio sw.js do cache HTTP; pedir
           update explicitamente elimina esse atraso. */
        void registro.update();
      } catch {
        // Sem service worker o ERP continua funcionando normalmente pela rede.
      }
    };

    void registrar();

    const conferir = () => { if (document.visibilityState === "visible") void registro?.update(); };
    document.addEventListener("visibilitychange", conferir);

    let recarregando = false;
    const aoTrocar = () => {
      if (recarregando) return;
      /* Aba em segundo plano: pode recarregar sem atropelar ninguem.
         Aba na frente: avisa, e a pessoa recarrega quando quiser. */
      if (document.visibilityState === "hidden") {
        recarregando = true;
        window.location.reload();
      } else {
        setPrecisaRecarregar(true);
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", aoTrocar);

    return () => {
      document.removeEventListener("visibilitychange", conferir);
      navigator.serviceWorker.removeEventListener("controllerchange", aoTrocar);
    };
  }, []);

  if (!precisaRecarregar) return null;
  const alvoDoShell = typeof document === "undefined" ? null : document.getElementById("erp-update-region");

  const aviso = (
    <div className="erp-update-toast" role="status" aria-live="polite">
      <span>Versão nova instalada.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
      >
        Recarregar
      </button>
    </div>
  );
  return alvoDoShell ? createPortal(aviso, alvoDoShell) : aviso;
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

/** Nome de cache criado por este app (ver public/sw.js: estatico-apecerto-<build>). */
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
