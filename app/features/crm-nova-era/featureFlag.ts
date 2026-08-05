/**
 * Feature flag do CRM Nova Era — PREPARADA, ainda NÃO conectada à produção.
 * ---------------------------------------------------------------------------
 * Regras:
 *  - CRM antigo continua o padrão em qualquer ambiente.
 *  - Nova Era só liga quando a flag do AMBIENTE está true E o usuário está autorizado.
 *  - Ativação é por ambiente: staging = true, produção = false (até liberação explícita).
 *
 * Nada aqui altera o comportamento do CRM atual: enquanto CRM_NOVA_ERA_ENABLED=false
 * (default), `crmNovaEraLiberado()` retorna sempre false e o gate nem deve ser oferecido.
 *
 * Wiring futuro (fora desta entrega): em ProductCatalog, envolver o branch CRM com o Gate
 * somente quando `crmNovaEraLiberado(user)` === true. Não fazer isso em produção ainda.
 */

// Lida em build/runtime. Em produção, mantenha ausente/"false".
// NEXT_PUBLIC_ para uso client-side no seletor; a checagem de verdade é sempre no banco (RLS+RPC).
const FLAG_AMBIENTE =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_CRM_NOVA_ERA_ENABLED ??
      process.env.CRM_NOVA_ERA_ENABLED)) ||
  "false";

/**
 * Canary compilado temporário.
 *
 * O runtime vinext usado em produção não refletiu a flag NEXT_PUBLIC_* no
 * bundle do navegador após o rebuild. Manter o piloto preso a UUIDs explícitos
 * permite validar a interface sem liberar a equipe inteira. Remover quando a
 * configuração runtime/client for centralizada.
 */
const CANARY_USUARIOS = new Set([
  "4dfdffae-0009-41de-8d6f-2365a06dc066", // Samuel
]);

/** true somente se o ambiente habilitou explicitamente a flag. Default: false. */
export function crmNovaEraFlagAmbiente(): boolean {
  return String(FLAG_AMBIENTE).trim().toLowerCase() === "true";
}

/**
 * Decisão final (client-side, apenas para EXIBIR o seletor). A autorização efetiva de dados
 * é sempre reforçada no banco (RLS + RPC fail-closed) — esta função nunca concede acesso a dados.
 *
 * Regras (ordem):
 *  - flag do ambiente desligada => sempre false (todos veem só o CRM antigo);
 *  - com a flag ligada: administrador SEMPRE liberado (piloto canário);
 *  - com a flag ligada: usuário na allowlist liberado;
 *  - qualquer outro (corretor sem permissão) => false.
 */
export function crmNovaEraLiberado(
  usuarioId?: string | null,
  opts?: { role?: string | null },
): boolean {
  /* Piloto fechado: corretores usam exclusivamente o funil atual até a
     liberação operacional. Admin e gestor podem validar o 3.0; acesso sem
     papel conhecido fecha, exceto para o canário explícito. */
  if (!usuarioId) return false;
  const kill =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_CRM_NOVA_ERA_KILL ?? process.env.CRM_NOVA_ERA_KILL)) || "false";
  /* Kill-switch continua respeitado: liga o canario e mais ninguem. E a saida
     de emergencia se o Funil 2.0 apresentar problema com a equipe dentro. */
  if (String(kill).trim().toLowerCase() === "true") return CANARY_USUARIOS.has(usuarioId);

  /* 05/08/2026: o Funil 2.0 deixou de ser piloto e virou A operacao. Todo
     usuario autenticado entra nele -- corretor inclusive.

     Antes: canario (1 UUID) + admin/gestor. Consequencia pratica: o corretor
     caia no CRM antigo, onde o "Funil 2.0" aparecia como MAIS UM pipe na lista
     lateral, ao lado de PIPE ATENDIMENTO e FECHAMENTO. Duas leituras diferentes
     da mesma operacao, e o corretor na errada.

     A autorizacao de DADOS continua no banco (RLS + RPC fail-closed); esta
     funcao so decide qual tela mostrar. */
  return true;
}
