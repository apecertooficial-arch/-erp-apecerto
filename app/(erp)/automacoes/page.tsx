"use client";

import { AutomationsCentralCloudV4 } from "../../features/automations/AutomationsCentralCloudV4";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Automações">{(t) => <AutomationsCentralCloudV4 accessToken={t} />}</GuardaModulo>;
}
