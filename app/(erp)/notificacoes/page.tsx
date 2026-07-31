"use client";

import { useRouter } from "next/navigation";
import { NotificationsWorkspace } from "../../features/notifications/NotificationsWorkspace";
import { TelaAvisosMobile } from "../../features/notifications/TelaAvisosMobile";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useEhCelular } from "../../features/system/useFormato";

export default function Pagina() {
  const router = useRouter();
  /* null na primeira renderização: não dá para saber a largura antes de o
     navegador existir. Enquanto for null não renderizamos nenhuma das duas —
     chutar faria a tela trocar piscando na frente do corretor. */
  const ehCelular = useEhCelular();

  return (
    <GuardaModulo modulo="Notificações">
      {(t) => {
        if (ehCelular === null) return null;
        const abrirLead = (dealId: number) => router.push(`/crm?lead=${dealId}`);
        return ehCelular
          ? <TelaAvisosMobile accessToken={t} onOpenLead={abrirLead} />
          : <NotificationsWorkspace accessToken={t} onOpenLead={abrirLead} />;
      }}
    </GuardaModulo>
  );
}
