"use client";

import { useSearchParams } from "next/navigation";
import { PerformanceWorkspace } from "../../features/team/PerformanceWorkspace";
import { ManagerPanelMobile } from "../../features/team/ManagerPanelMobile";
import { RelatoriosMobile } from "../../features/team/RelatoriosMobile";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";
import { useEhCelular } from "../../features/system/useFormato";

/* Duas telas de celular na mesma rota, decididas por `?vista=`:
 *
 *   /performance                -> Inicio do gestor (resumo da operacao)
 *   /performance?vista=relatorios -> Relatorios (quatro numeros do periodo)
 *
 * Mesma permissao, mesma fonte (/api/performance), leituras diferentes. Uma
 * rota nova exigiria um ModuleName novo e um item de menu que ninguem pediu --
 * na Gestao o caminho e uma linha, nao um modulo.
 */
export default function Pagina() {
  const { role, isManager } = useErpSession();
  const ehCelular = useEhCelular();
  const vista = useSearchParams()?.get("vista") ?? "";
  return <GuardaModulo modulo="Performance">{(t) => {
    if (ehCelular === null) return null;
    if (!ehCelular) return <PerformanceWorkspace accessToken={t} sessionRole={role} />;
    if (!(isManager || role === "admin" || role === "gestor")) {
      return <div className="modulo-sem-acesso" role="alert"><strong>Área de gestão</strong><p>Este painel é exclusivo para gestores.</p></div>;
    }
    return vista === "relatorios" ? <RelatoriosMobile accessToken={t} /> : <ManagerPanelMobile accessToken={t} />;
  }}</GuardaModulo>;
}
