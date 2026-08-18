"use client";

import { Aquisicao } from "../../../features/inteligencia/Aquisicao";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <Aquisicao accessToken={t} />}</GuardaModulo>;
}
