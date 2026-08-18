"use client";

import { PerformanceEquipe } from "../../../features/inteligencia/PerformanceEquipe";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <PerformanceEquipe accessToken={t} />}</GuardaModulo>;
}
