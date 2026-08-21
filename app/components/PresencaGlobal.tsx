"use client";

import { useErpSession } from "../features/system/ErpSession";
import { PresenceHeartbeat } from "../features/presence/PresenceHeartbeat";

/* JANELA "VOCÊ AINDA ESTÁ CONECTADO?".
 *
 * O componente ja existia e funcionava, mas NAO era montado por tela nenhuma --
 * por isso ninguem confirmava presenca desde 30/07 e a fila decidia com
 * informacao velha.
 *
 * QUEM VE: nao filtramos por `role`. Estar na fila e ter linha em `corretores`,
 * o que nao e a mesma coisa que ter papel "corretor" -- hoje ha um gerente e um
 * diretor que ATENDEM. Filtrar por papel os deixaria de fora, e eles cairiam da
 * fila em silencio, que e exatamente o defeito que estamos consertando.
 *
 * Quem decide e o servidor: `presenca_status` procura o usuario em `corretores`
 * e devolve prompt=false para quem nao esta la. Para gestao pura o componente
 * so faz um GET leve a cada 20s e nunca mostra nada. */
export function PresencaGlobal() {
  const { accessToken, perfilCarregado, profile } = useErpSession();
  if (!accessToken || !perfilCarregado || profile?.brokerId == null) return null;
  return <PresenceHeartbeat accessToken={accessToken} initialOnline={profile.online} />;
}
