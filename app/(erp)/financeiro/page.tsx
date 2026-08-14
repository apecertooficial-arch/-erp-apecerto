"use client";

import { FinanceWorkspace } from "../../features/finance/FinanceWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";

export default function Pagina() {
  const { profile, role } = useErpSession();
  return (
    <GuardaModulo modulo="Financeiro">
      {(t) => (
        <FinanceWorkspace
          accessToken={t}
          sessionRole={role}
          perfil={profile?.perfil ?? null}
          sessionUserId={profile?.userId ?? null}
        />
      )}
    </GuardaModulo>
  );
}
