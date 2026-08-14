"use client";

/* Modulo ainda servido pelo HTML legado. FASE 9: continua acessivel, com aviso,
   sem redesenho nesta rodada. */

import { HelpWorkspace } from "../../features/system/HelpWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return (
    <GuardaModulo modulo="Ajuda">
      {() => <HelpWorkspace />}
    </GuardaModulo>
  );
}
