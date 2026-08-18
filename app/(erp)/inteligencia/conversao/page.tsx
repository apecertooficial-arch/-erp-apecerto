"use client";

import { ConversaoCrm } from "../../../features/inteligencia/ConversaoCrm";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <ConversaoCrm accessToken={t} />}</GuardaModulo>;
}
