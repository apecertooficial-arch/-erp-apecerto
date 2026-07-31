"use client";

/* O CRM Nova Era nao e reconstruido aqui. Esta pagina so o monta e traduz
   deep-link (?lead=, ?chat=, ?ler=, ?vista=, ?novaVenda=) nas props que o
   CrmWorkspace/CrmNovaEraGate ja aceitavam quando a navegacao era useState. */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CrmNovaEraGate } from "../../features/crm-nova-era/CrmNovaEraGate";
import { CrmWorkspace } from "../../features/crm/CrmWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";

export default function Pagina() {
  const { profile, role, permissoes } = useErpSession();
  const router = useRouter();
  const params = useSearchParams();

  const num = (chave: string) => {
    const bruto = params?.get(chave);
    if (!bruto) return null;
    const n = Number(bruto);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  /* Consumir o deep-link limpa a query, senao voltar/atualizar reabriria o lead. */
  const limpar = useCallback((chaves: string[]) => {
    const p = new URLSearchParams(params?.toString() ?? "");
    chaves.forEach((c) => p.delete(c));
    const q = p.toString();
    router.replace(q ? `/crm?${q}` : "/crm", { scroll: false });
  }, [params, router]);

  /* MODO LEITURA — `?ler=1`.
   *
   * Quem manda e o botao roxo "Abrir conversa", da tela de Inicio. O gestor
   * ACOMPANHA: ele abre o historico que a D-API ja grava, para LER. Nao
   * responde dali. A regra esta no topo de TelaCorretor.tsx e existe por um
   * motivo operacional -- gestor mandando mensagem pelo proprio numero e o
   * comeco de um atendimento sem dono e sem historico.
   *
   * O LeadChatDrawer nao tem prop de somente-leitura, e criar uma exigiria
   * abrir o CrmWorkspace (265 KB, a tela mais critica do ERP). Uma classe no
   * body resolve sem tocar nele: o CSS esconde compositor, gravador e
   * ferramentas so quando ela esta presente. O CRM do corretor nao muda.
   *
   * CLASSE NO BODY, NAO DIV EM VOLTA: o CrmWorkspace tem cadeia de altura
   * (`.crm-v2 { height: 100vh }`, kanban com `overflow` proprio) e um wrapper
   * novo no meio quebraria o layout. Classe nao entra no fluxo.
   *
   * LATCH: a query e apagada assim que o deep link e consumido. Relendo a URL
   * a cada render, a conversa abriria em leitura e ganharia compositor no
   * instante seguinte. */
  const [somenteLeitura] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return new URLSearchParams(window.location.search).get("ler") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!somenteLeitura) return;
    document.body.classList.add("conversa-leitura");
    return () => document.body.classList.remove("conversa-leitura");
  }, [somenteLeitura]);

  const podeAcao = (acao: string) => {
    if (role === "admin") return true;
    if (!permissoes || Object.keys(permissoes).length === 0) return false;
    return ["crm", "leads", "pipeline", "CRM"].some((m) => (permissoes[m] ?? []).includes(acao));
  };
  const podeTransferir = podeAcao("transferir");

  return (
    <GuardaModulo modulo="CRM">
      {(t) => (
        <CrmNovaEraGate
          accessToken={t}
          profile={{ userId: profile?.userId ?? null, role: profile?.role ?? null, name: profile?.name ?? null }}
          current={
            <CrmWorkspace
              accessToken={t}
              initialDealId={num("lead")}
              onInitialDealHandled={() => limpar(["lead"])}
              initialChatDealId={num("chat")}
              /* `ler` sai junto: quem segura o modo e o latch acima, nao a URL. */
              onInitialChatHandled={() => limpar(["chat", "ler"])}
              initialView={params?.get("vista") === "vendas" ? "sales" : null}
              initialCreateSale={params?.get("novaVenda") === "1"}
              onInitialViewHandled={() => limpar(["vista", "novaVenda"])}
              sessionRole={role}
              canReassign={podeTransferir}
              canAssign={podeAcao("atribuir") || podeTransferir}
            />
          }
        />
      )}
    </GuardaModulo>
  );
}
