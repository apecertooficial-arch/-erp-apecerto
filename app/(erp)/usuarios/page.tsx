"use client";

import { TeamWorkspace } from "../../features/team/TeamWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Usuários">{(t) => <TeamWorkspace accessToken={t} />}</GuardaModulo>;
}
