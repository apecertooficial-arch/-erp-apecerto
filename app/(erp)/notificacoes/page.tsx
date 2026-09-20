"use client";

import { useRouter } from "next/navigation";
import { NotificationsWorkspace } from "../../features/notifications/NotificationsWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  const router = useRouter();
  return (
    <GuardaModulo modulo="Notificações">
      {(t) => {
        const navegar = (href: string) => router.push(href);
        return <NotificationsWorkspace accessToken={t} onNavigate={navegar} />;
      }}
    </GuardaModulo>
  );
}
