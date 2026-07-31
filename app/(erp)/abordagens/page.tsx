"use client";

import { ApproachesWorkspace } from "../../features/approaches/ApproachesWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Abordagens">{(t) => <ApproachesWorkspace accessToken={t} />}</GuardaModulo>;
}
