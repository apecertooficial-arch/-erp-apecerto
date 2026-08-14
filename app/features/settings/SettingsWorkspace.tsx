"use client";

import { ConnectionsWorkspace } from "./ConnectionsWorkspace";

/**
 * Configurações deixou de ser um segundo painel administrativo do ERP.
 * Regras de negócio pertencem aos módulos que as executam; esta rota existe
 * somente para a equipe conectar e acompanhar as instâncias de WhatsApp.
 */
export function SettingsWorkspace({ accessToken }: {
  accessToken: string;
}) {
  return <ConnectionsWorkspace accessToken={accessToken} />;
}
