"use client";

import { useRouter } from "next/navigation";
import { Funil2Mobile } from "./Funil2Mobile";
import { Funil2Workspace } from "./Funil2Workspace";
import { GuardaModulo } from "../system/GuardaModulo";
import { useErpSession } from "../system/ErpSession";
import { useEhCelular } from "../system/useFormato";

/** Entrada única do Funil. Dados, permissões e mutações continuam canônicos. */
export function FunilEntry() {
  const { profile, role } = useErpSession();
  const ehCelular = useEhCelular();
  const router = useRouter();

  return (
    <GuardaModulo modulo="CRM">
      {(accessToken) => {
        if (ehCelular === null) return null;
        if (ehCelular) {
          return (
            <Funil2Mobile
              accessToken={accessToken}
              nome={profile?.name ?? "Corretor"}
              role={role}
              modo="crm"
              onIr={(destino) => router.push(destino)}
            />
          );
        }
        return (
          <Funil2Workspace
            accessToken={accessToken}
            profile={{
              userId: profile?.userId ?? "",
              role,
              name: profile?.name ?? "Corretor",
            }}
          />
        );
      }}
    </GuardaModulo>
  );
}
