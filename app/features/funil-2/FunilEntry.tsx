"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Funil2Mobile } from "./Funil2Mobile";
import { Funil2Workspace } from "./Funil2Workspace";
import { MobileCrmNavigation } from "./MobileCrmNavigation";
import { SalesProcessView } from "../sales/SalesProcessWorkspace";
import { GuardaModulo } from "../system/GuardaModulo";
import { useErpSession } from "../system/ErpSession";
import { useEhCelular } from "../system/useFormato";

/** Entrada única do Funil. Dados, permissões e mutações continuam canônicos. */
export function FunilEntry() {
  const { profile, role } = useErpSession();
  const ehCelular = useEhCelular();
  const router = useRouter();
  const searchParams = useSearchParams();
  const vistaMobile = searchParams.get("vista");

  return (
    <GuardaModulo modulo="CRM">
      {(accessToken) => {
        if (ehCelular === null) return null;
        if (ehCelular) {
          if (vistaMobile === "vendas") {
            return <section className="funil-oficial ape-app modo-crm" aria-label="Esteira de vendas">
              <header className="ape-abertura">
                <span className="ape-sobrancelha">CRM</span>
                <h1 className="ape-manchete">Esteira de vendas</h1>
              </header>
              <MobileCrmNavigation areaAtual="vendas" onIr={(destino) => router.push(destino)} />
              <section className="ape-mobile-esteira">
                <SalesProcessView accessToken={accessToken} sessionRole={role} />
              </section>
            </section>;
          }
          return (
            <Funil2Mobile
              accessToken={accessToken}
              nome={profile?.name ?? "Corretor"}
              modo="crm"
              onIr={(destino) => router.push(destino)}
            />
          );
        }
        return <Funil2Workspace
          key={profile?.userId || "perfil-pendente"}
          accessToken={accessToken}
          profile={{
            userId: profile?.userId ?? "",
            role,
            name: profile?.name ?? "Corretor",
          }}
        />;
      }}
    </GuardaModulo>
  );
}
