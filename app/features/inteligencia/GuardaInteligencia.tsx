"use client";

/* Guarda da área Inteligência.
 *
 * Não usa GuardaModulo porque "Inteligência" ainda não é uma chave de
 * module-map.ts: rotasModulo é Record<ModuleName, RotaModulo> exaustivo, e
 * incluir a chave lá obriga a editar module-map.ts e erp-routes.ts no mesmo
 * commit. A regra de acesso é a mesma do podeVer, escrita aqui de forma
 * fail-closed: sem mapa de permissão carregado, ninguém que não seja admin
 * entra.
 *
 * ESTA GUARDA É DE INTERFACE. Autorização de dado continua sendo das rotas
 * /api/* e da RLS do Supabase.
 */

import type { ReactNode } from "react";
import { useErpSession } from "../system/ErpSession";

export function GuardaInteligencia({ children }: { children: (accessToken: string) => ReactNode }) {
  const { accessToken, role, permissoes, perfilCarregado, isManager } = useErpSession();

  if (!perfilCarregado || !accessToken) {
    return (
      <div className="workspace-loading">
        <span />
        <strong>Carregando seu ERP…</strong>
      </div>
    );
  }

  const liberado =
    role === "admin" ||
    role === "gestor" ||
    isManager === true ||
    (permissoes?.["dashboard"] ?? []).includes("ver");

  if (!liberado) {
    return (
      <div className="modulo-sem-acesso" role="alert">
        <strong>Você não tem acesso a Inteligência.</strong>
        <p>Se precisar desta área, peça liberação para quem administra o sistema.</p>
      </div>
    );
  }

  return <>{children(accessToken)}</>;
}
