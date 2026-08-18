"use client";

import { useSearchParams } from "next/navigation";
import { PerformanceWorkspace } from "../../features/team/PerformanceWorkspace";
import { ManagerPanelMobile } from "../../features/team/ManagerPanelMobile";
import { RelatoriosMobile } from "../../features/team/RelatoriosMobile";
import { VisaoEmpresa } from "../../features/inteligencia/VisaoEmpresa";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";
import { useEhCelular } from "../../features/system/useFormato";

/* FASE 1B — aposentadoria da aba Performance antiga, sem quebrar navegação.
 *
 * O item do menu continua apontando para /performance de propósito: a ordem
 * visual da sidebar é definida por href em redesign-apecerto-menu.css, e trocar o
 * href faria o item saltar de lugar. Aqui dentro:
 *
 *   /performance                  -> COMPUTADOR: Visão da empresa (área nova)
 *                                    CELULAR: Início do gestor (inalterado)
 *   /performance?vista=relatorios -> Relatórios no celular (inalterado)
 *   /performance?vista=antiga     -> a tela antiga, preservada para comparação
 *   /inteligencia                 -> a mesma área, deep-link canônico
 *
 * Renderiza a tela nova direto em vez de redirecionar: redirect faria piscar uma
 * tela a cada clique no menu. Nada foi apagado — PerformanceWorkspace continua
 * inteiro e alcançável enquanto a transição durar. Quando o Romulo confirmar que
 * ninguém mais precisa dela, o ramo "antiga" sai em um commit de uma linha.
 */
export default function Pagina() {
  const { role, isManager } = useErpSession();
  const ehCelular = useEhCelular();
  const vista = useSearchParams()?.get("vista") ?? "";
  return <GuardaModulo modulo="Performance">{(t) => {
    if (ehCelular === null) return null;
    if (!ehCelular) {
      return vista === "antiga"
        ? <PerformanceWorkspace accessToken={t} sessionRole={role} />
        : <VisaoEmpresa accessToken={t} />;
    }
    if (!(isManager || role === "admin" || role === "gestor")) {
      return <div className="modulo-sem-acesso" role="alert"><strong>Área de gestão</strong><p>Este painel é exclusivo para gestores.</p></div>;
    }
    return vista === "relatorios" ? <RelatoriosMobile accessToken={t} /> : <ManagerPanelMobile accessToken={t} />;
  }}</GuardaModulo>;
}
