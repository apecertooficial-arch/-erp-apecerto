"use client";

import { useRouter } from "next/navigation";
import { HomeWorkspace } from "../../features/home/HomeWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";
import { pathDoModulo } from "../../features/system/erp-routes";
import { isModuleName } from "../../features/system/module-map";

export default function Pagina() {
  const { profile } = useErpSession();
  const router = useRouter();
  return (
    <GuardaModulo modulo="Início">
      {(t) => (
        <HomeWorkspace
          accessToken={t}
          sessionName={profile?.name ?? ""}
          onNavigate={(nome) => { if (isModuleName(nome)) router.push(pathDoModulo(nome)); }}
          onIr={(destino) => router.push(destino)}
        />
      )}
    </GuardaModulo>
  );
}
