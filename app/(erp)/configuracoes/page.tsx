"use client";

import { SettingsWorkspace } from "../../features/settings/SettingsWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return (
    <GuardaModulo modulo="Configurações">
      {(t) => <SettingsWorkspace accessToken={t} />}
    </GuardaModulo>
  );
}
