"use client";

import { AutomationsCentralV4 } from "../../features/automations/AutomationsCentralV4";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Automações">{(t) => <AutomationsCentralV4 accessToken={t} />}</GuardaModulo>;
}
