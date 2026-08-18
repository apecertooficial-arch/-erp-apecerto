"use client";

import { Qualidade } from "../../../features/inteligencia/Qualidade";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <Qualidade accessToken={t} />}</GuardaModulo>;
}
