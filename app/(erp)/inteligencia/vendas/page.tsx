"use client";

import { VendasPrevisao } from "../../../features/inteligencia/VendasPrevisao";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <VendasPrevisao accessToken={t} />}</GuardaModulo>;
}
