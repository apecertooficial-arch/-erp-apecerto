"use client";

import { Imoveis } from "../../../features/inteligencia/Imoveis";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <Imoveis accessToken={t} />}</GuardaModulo>;
}
