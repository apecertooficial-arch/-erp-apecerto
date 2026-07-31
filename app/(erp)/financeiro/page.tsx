"use client";

import { useRouter } from "next/navigation";
import { FinanceWorkspace } from "../../features/finance/FinanceWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";

export default function Pagina() {
  const { profile, role } = useErpSession();
  const router = useRouter();
  return (
    <GuardaModulo modulo="Financeiro">
      {(t) => (
        <FinanceWorkspace
          accessToken={t}
          sessionRole={role}
          perfil={profile?.perfil ?? null}
          sessionUserId={profile?.userId ?? null}
          onNavigateToNewSale={() => router.push("/crm?vista=vendas&novaVenda=1")}
        />
      )}
    </GuardaModulo>
  );
}
