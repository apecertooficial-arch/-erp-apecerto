"use client";

import { CentralAlertas } from "../../../features/inteligencia/CentralAlertas";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <CentralAlertas accessToken={t} />}</GuardaModulo>;
}
