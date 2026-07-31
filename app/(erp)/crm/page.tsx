"use client";

/* O CRM Nova Era nao e reconstruido aqui. Esta pagina so o monta e traduz
   deep-link (?lead=, ?chat=, ?vista=, ?novaVenda=) nas props que o
   CrmWorkspace/CrmNovaEraGate ja aceitavam quando a navegacao era useState. */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
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
              onInitialChatHandled={() => limpar(["chat"])}
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
