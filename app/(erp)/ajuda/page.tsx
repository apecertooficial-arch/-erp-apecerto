"use client";

/* Modulo ainda servido pelo HTML legado. FASE 9: continua acessivel, com aviso,
   sem redesenho nesta rodada. */

import { LegacyModuleWorkspace } from "../../features/system/LegacyModuleWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";

export default function Pagina() {
  const { profile } = useErpSession();
  return (
    <GuardaModulo modulo="Ajuda">
      {(t) => <LegacyModuleWorkspace moduleName="Ajuda" accessToken={t} session={profile} />}
    </GuardaModulo>
  );
}
