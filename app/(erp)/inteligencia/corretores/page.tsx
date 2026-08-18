"use client";

import { Corretores } from "../../../features/inteligencia/Corretores";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <Corretores accessToken={t} />}</GuardaModulo>;
}
