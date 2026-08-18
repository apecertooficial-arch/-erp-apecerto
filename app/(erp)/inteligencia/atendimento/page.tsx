"use client";

import { AtendimentoSla } from "../../../features/inteligencia/AtendimentoSla";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <AtendimentoSla accessToken={t} />}</GuardaModulo>;
}
