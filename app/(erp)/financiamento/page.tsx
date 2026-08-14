"use client";

import { FinancingWorkspace } from "../../features/finance/FinancingWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return (
    <GuardaModulo modulo="Financiamento">
      {(t) => <FinancingWorkspace accessToken={t} />}
    </GuardaModulo>
  );
}
