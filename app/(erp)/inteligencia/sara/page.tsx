"use client";

import { Sara } from "../../../features/inteligencia/Sara";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <Sara accessToken={t} />}</GuardaModulo>;
}
