"use client";

import { AutomationsWorkspace } from "../../features/automations/AutomationsWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Automações">{(t) => <AutomationsWorkspace accessToken={t} />}</GuardaModulo>;
}
