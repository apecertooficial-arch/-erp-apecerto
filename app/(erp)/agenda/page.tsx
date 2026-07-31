"use client";

import { CalendarWorkspace } from "../../features/calendar/CalendarWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Calendário">{(t) => <CalendarWorkspace accessToken={t} />}</GuardaModulo>;
}
