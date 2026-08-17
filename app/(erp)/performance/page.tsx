"use client";

import { PerformanceWorkspace } from "../../features/team/PerformanceWorkspace";
import { ManagerPanelMobile } from "../../features/team/ManagerPanelMobile";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";
import { useEhCelular } from "../../features/system/useFormato";

export default function Pagina() {
  const { role, isManager } = useErpSession();
  const ehCelular = useEhCelular();
  return <GuardaModulo modulo="Performance">{(t) => {
    if (ehCelular === null) return null;
    return ehCelular
      ? isManager || role === "admin" || role === "gestor"
        ? <ManagerPanelMobile accessToken={t} />
        : <div className="modulo-sem-acesso" role="alert"><strong>Área de gestão</strong><p>Este painel é exclusivo para gestores.</p></div>
      : <PerformanceWorkspace accessToken={t} sessionRole={role} />;
  }}</GuardaModulo>;
}
