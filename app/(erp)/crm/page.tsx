"use client";

/* Entrada única do CRM.
 *
 * Não existe mais seletor nem fallback para as gerações anteriores.
 * Todo perfil que passou pela GuardaModulo recebe a mesma carteira F2; RLS e
 * as RPCs do banco continuam limitando cada corretor aos próprios registros. */
import { useRouter } from "next/navigation";
import { Funil2Mobile } from "../../features/funil-2/Funil2Mobile";
import { Funil2Workspace } from "../../features/funil-2/Funil2Workspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";
import { useEhCelular } from "../../features/system/useFormato";

export default function Pagina() {
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
