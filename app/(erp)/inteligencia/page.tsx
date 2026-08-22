"use client";

import { CentralComandoWorkspace } from "../../features/inteligencia/CentralComandoWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return (
    <GuardaModulo modulo="Central de Comando">
      {(accessToken) => <CentralComandoWorkspace accessToken={accessToken} />}
    </GuardaModulo>
  );
}
