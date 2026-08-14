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
  return (
    <div className="settings-workspace settings-connections-only">
      <header className="workspace-top settings-top">
        <div>
          <span className="settings-kicker">CONEXÕES</span>
          <h1>WhatsApp</h1>
          <p>Conecte e acompanhe as instâncias usadas pelos corretores.</p>
        </div>
      </header>
      <section className="settings-embed">
        <ConnectionsWorkspace accessToken={accessToken} />
      </section>
    </div>
  );
}
