"use client";

import { Proprietarios } from "../../../features/inteligencia/Proprietarios";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <Proprietarios accessToken={t} />}</GuardaModulo>;
}
