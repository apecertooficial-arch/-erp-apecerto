"use client";

/* Rota de comparação: /automacoes-novo.
 *
 * /automacoes continua idêntica e no ar. Esta rota existe para o Romulo abrir as
 * duas lado a lado e conferir fluxo por fluxo antes de qualquer troca. Mesma
 * guarda de permissão do módulo Automações — quem não vê uma, não vê a outra. */

import { AutomationsWorkspaceNovo } from "../../features/automations/AutomationsWorkspaceNovo";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Automações">{(t) => <AutomationsWorkspaceNovo accessToken={t} />}</GuardaModulo>;
}
