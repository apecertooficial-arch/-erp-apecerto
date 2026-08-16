"use client";

import { SettingsWorkspace } from "../../features/settings/SettingsWorkspace";
import { ManagementMobile } from "../../features/system/ManagementMobile";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";
import { useEhCelular } from "../../features/system/useFormato";

export default function Pagina() {
  const ehCelular = useEhCelular();
  const { isManager } = useErpSession();
  return (
    <GuardaModulo modulo="Configurações">
      {(t) => ehCelular === null ? null : ehCelular && isManager ? <ManagementMobile /> : <SettingsWorkspace accessToken={t} />}
    </GuardaModulo>
  );
}
