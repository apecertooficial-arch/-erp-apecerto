"use client";

import { CascaInteligencia } from "../../features/inteligencia/CascaInteligencia";
import { GuardaInteligencia } from "../../features/inteligencia/GuardaInteligencia";

export default function Pagina() {
  return <GuardaInteligencia>{(t) => <CascaInteligencia accessToken={t} />}</GuardaInteligencia>;
}
