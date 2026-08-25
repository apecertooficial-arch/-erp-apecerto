"use client";

import { AutomationsWorkspaceV2 } from "../../features/automations/AutomationsWorkspaceV2";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Automações">{(t) => <AutomationsWorkspaceV2 accessToken={t} />}</GuardaModulo>;
}
