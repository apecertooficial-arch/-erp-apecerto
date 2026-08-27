"use client";

import { useRouter } from "next/navigation";
import { Funil2Mobile } from "./Funil2Mobile";
import { Funil2Workspace } from "./Funil2Workspace";
import { GuardaModulo } from "../system/GuardaModulo";
import { useErpSession } from "../system/ErpSession";
import { useEhCelular } from "../system/useFormato";

export type CrmExperience = "v3" | "legacy";

/**
 * Uma única entrada funcional para as duas apresentações. V3 e rollback usam
 * a mesma sessão, o mesmo Funil 2.0 e as mesmas APIs/RPCs; somente a camada de
 * apresentação muda. Isso mantém o retorno ao legado pequeno e reversível.
 */
export function CrmEntry({ experience }: { experience: CrmExperience }) {
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
              experience={experience}
              onIr={(destino) => router.push(destino)}
            />
          );
        }
        return (
          <Funil2Workspace
            accessToken={accessToken}
            experience={experience}
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
