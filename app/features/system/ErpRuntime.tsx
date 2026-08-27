"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ErpSessionCtx, type ErpSessionValue } from "./ErpSession";
import { ErpShell } from "./ErpShell";

/**
 * Mantém o runtime real do ERP em todas as rotas. Somente `/crm-v3`, durante
 * desenvolvimento, recebe uma sessão sanitizada e sem efeitos globais para a
 * validação local não depender de credenciais nem fazer chamadas externas.
 */
export function ErpRuntime({ children, localContent }: { children: ReactNode; localContent: ReactNode }) {
  const pathname = usePathname() || "/";
  const localCrmV3 = process.env.NODE_ENV === "development" && pathname === "/crm-v3";

  if (localCrmV3) return <CrmV3LocalRuntime>{localContent}</CrmV3LocalRuntime>;

  return <>{children}</>;
}

/** A sessão de laboratório só é materializada depois do guard exato acima. */
function CrmV3LocalRuntime({ children }: { children: ReactNode }) {
  const localSession = useMemo<ErpSessionValue>(() => ({
    accessToken: "crm-v3-local-sem-rede",
    profile: {
      userId: "crm-v3-local",
      email: "validacao.local@apecerto.invalid",
      name: "Bianca Rodrigues",
      role: "corretor",
      perfil: "corretor",
      active: true,
      brokerId: 1,
      online: false,
      permissoes: { crm: ["ver"], leads: ["ver"], pipeline: ["ver"] },
    },
    perfilCarregado: true,
    estado: "live",
    role: "corretor",
    isManager: false,
    permissoes: { crm: ["ver"], leads: ["ver"], pipeline: ["ver"] },
    badges: {},
    publicarBadge: () => undefined,
    recarregarPerfil: async () => undefined,
  }), []);

  return (
    <ErpSessionCtx.Provider value={localSession}>
      <ErpShell>{children}</ErpShell>
    </ErpSessionCtx.Provider>
  );
}
