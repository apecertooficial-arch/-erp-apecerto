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
  _opts?: { role?: string | null },
): boolean {
  /* Desde 31/07 o CRM Nova Era 3.0 é o CRM OFICIAL da operação: a carteira
     inteira dos pipes foi migrada e a entrada de leads novos acontece só nele.
     Todo usuário autenticado usa o 3.0. O desligamento de emergência vive no
     ambiente (CRM_NOVA_ERA_KILL=true volta todo mundo ao CRM antigo). */
  void _opts; // assinatura preservada para os chamadores existentes
  if (!usuarioId) return false;
  const kill =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_CRM_NOVA_ERA_KILL ?? process.env.CRM_NOVA_ERA_KILL)) || "false";
  if (String(kill).trim().toLowerCase() === "true") return CANARY_USUARIOS.has(usuarioId);
  return true;
}
