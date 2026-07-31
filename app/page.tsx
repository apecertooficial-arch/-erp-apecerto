"use client";

/* Porta de entrada legada.
 *
 * Ate esta branch, "/" ERA o ERP inteiro. Agora cada modulo tem URL propria,
 * mas "/" continua funcionando: quem chegar por link antigo, atalho salvo na
 * tela de inicio ou pelo start_url anterior do PWA e redirecionado, nao
 * recebe 404.
 *
 * O hash e preservado de proposito: o fluxo de redefinicao de senha do
 * Supabase volta em "/#access_token=...&type=recovery" e precisa chegar
 * inteiro no destino, senao o usuario perde a troca de senha.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { destinoEntradaLegada } from "./features/system/erp-routes";

export default function EntradaLegada() {
  const router = useRouter();

  useEffect(() => {
    router.replace(destinoEntradaLegada(window.location.search, window.location.hash));
  }, [router]);

  return (
    <div className="workspace-loading" aria-busy="true">
      <span />
      <strong>Abrindo o ERP…</strong>
    </div>
  );
}
