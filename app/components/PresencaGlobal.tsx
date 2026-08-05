"use client";

import { useErpSession } from "../features/system/ErpSession";
import { PresenceHeartbeat } from "../features/presence/PresenceHeartbeat";

/* JANELA "VOCÊ AINDA ESTÁ CONECTADO?".
 *
 * O componente ja existia e funcionava, mas NAO era montado por nenhuma tela --
 * mesmo problema do aviso de push. Resultado: a pergunta de presenca nunca
 * aparecia para ninguem, e quem saia da fila nao era avisado.
 *
 * Vai no layout do (erp) para existir em qualquer rota. So para quem atende:
 * gestao nao entra na fila de distribuicao, entao a pergunta nao faz sentido. */
export function PresencaGlobal() {
  const { accessToken, role, perfilCarregado } = useErpSession();
  if (!accessToken || !perfilCarregado) return null;
  if (role !== "corretor") return null;
  return <PresenceHeartbeat accessToken={accessToken} initialOnline />;
}
