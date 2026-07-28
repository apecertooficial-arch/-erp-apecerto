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

/** true somente se o ambiente habilitou explicitamente a flag. Default: false. */
export function crmNovaEraFlagAmbiente(): boolean {
  return String(FLAG_AMBIENTE).trim().toLowerCase() === "true";
}

/**
 * Allowlist de usuários autorizados (ids de `usuarios`). Vazio = ninguém, mesmo com flag on.
 * Fonte da lista fica fora do código (env/config por ambiente); aqui só o parser.
 */
function allowlist(): Set<string> {
  const raw =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_CRM_NOVA_ERA_ALLOWLIST ??
        process.env.CRM_NOVA_ERA_ALLOWLIST)) ||
    "";
  return new Set(
    String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
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
  if (!crmNovaEraFlagAmbiente()) return false; // ambiente não habilitou => padrão antigo
  if (!usuarioId) return false;
  if ((opts?.role ?? "") === "admin") return true; // canário: admin sempre pode
  const lista = allowlist();
  return lista.size > 0 && lista.has(usuarioId);
}
