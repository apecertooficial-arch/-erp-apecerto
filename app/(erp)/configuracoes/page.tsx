"use client";

import { useRouter } from "next/navigation";
import { SettingsWorkspace } from "../../features/settings/SettingsWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";
import { pathDoModulo } from "../../features/system/erp-routes";
import { isModuleName } from "../../features/system/module-map";

export default function Pagina() {
  const { role } = useErpSession();
  const router = useRouter();
  return (
    <GuardaModulo modulo="Configurações">
      {(t) => (
        <SettingsWorkspace
          accessToken={t}
          sessionRole={role}
          onNavigate={(nome) => { if (isModuleName(nome)) router.push(pathDoModulo(nome)); }}
        />
      )}
    </GuardaModulo>
  );
}
