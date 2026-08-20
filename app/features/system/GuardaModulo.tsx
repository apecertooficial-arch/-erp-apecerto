"use client";

/* Guarda de rota.
 *
 * Esconder o item no menu nao basta: /financeiro digitado na barra de endereco,
 * atalho antigo do PWA ou deep-link de notificacao chegam direto na rota.
 *
 * IMPORTANTE -- esta guarda e de INTERFACE. Ela evita montar a tela e disparar
 * fetch desnecessario. A autorizacao real do dado continua sendo das rotas
 * /api/* e da RLS do Supabase, que nao sao alteradas por esta branch.
 */

import type { ReactNode } from "react";
import type { ModuleName } from "./module-map";
import { podeVer } from "./erp-routes";
import { useErpSession } from "./ErpSession";

export function GuardaModulo({ modulo, children }: { modulo: ModuleName; children: (accessToken: string) => ReactNode }) {
  const { accessToken, profile, role, permissoes, perfilCarregado, isManager } = useErpSession();

  if (!perfilCarregado || !accessToken) {
    return <div className="workspace-loading"><span /><strong>Carregando seu ERP…</strong></div>;
  }

  if (!podeVer(modulo, {
    role,
    permissoes,
    carregado: perfilCarregado,
    isManager,
    temCorretorVinculado: profile?.brokerId != null,
  })) {
    return (
      <div className="modulo-sem-acesso" role="alert">
        <strong>Você não tem acesso a {modulo}.</strong>
        <p>Se precisar deste módulo, peça liberação para quem administra o sistema.</p>
      </div>
    );
  }

  return <>{children(accessToken)}</>;
}
