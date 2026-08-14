"use client";

import { useRouter } from "next/navigation";
import { NotificationsWorkspace } from "../../features/notifications/NotificationsWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  const router = useRouter();
  return (
    <GuardaModulo modulo="Notificações">
      {(t) => {
        const abrirLead = (dealId: number) => router.push(`/crm?lead=${dealId}`);
        return <NotificationsWorkspace accessToken={t} onOpenLead={abrirLead} />;
      }}
    </GuardaModulo>
  );
}
