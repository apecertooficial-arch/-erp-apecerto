"use client";

import { PrivacidadeTracking } from "../../../features/inteligencia/PrivacidadeTracking";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <PrivacidadeTracking accessToken={t} />}</GuardaModulo>;
}
