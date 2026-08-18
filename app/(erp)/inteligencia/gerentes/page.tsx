"use client";

import { Gerentes } from "../../../features/inteligencia/Gerentes";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <Gerentes accessToken={t} />}</GuardaModulo>;
}
