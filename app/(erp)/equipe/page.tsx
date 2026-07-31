"use client";

import { EquipeWorkspace } from "../../features/team/EquipeWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Minha Equipe">{(t) => <EquipeWorkspace accessToken={t} />}</GuardaModulo>;
}
