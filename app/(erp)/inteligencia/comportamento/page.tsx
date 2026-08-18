"use client";

import { Comportamento } from "../../../features/inteligencia/Comportamento";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <Comportamento accessToken={t} />}</GuardaModulo>;
}
