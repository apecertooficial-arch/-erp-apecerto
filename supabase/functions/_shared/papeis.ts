// ============================================================================
// PAPÉIS — fonte única de "quem pertence a qual grupo".
//
// Os papéis vêm do enum real do banco `public.user_role`
// (admin | executivo | diretor | gerente | corretor). Nada fora dele existe:
// "gestor", "gestor_comercial" e "gestor_equipe" NÃO são papéis de usuário.
//   - "gestor" só existe como CLASSE DE SESSÃO normalizada (ver papelDeSessao);
//   - "gestor_comercial", "gestor_equipe", "auditor" e "financeiro" são ids de
//     linhas da tabela `perfis` (modelos de permissão), não papéis atribuíveis.
//
// Cada grupo nomeia UMA decisão de negócio. Grupos com os mesmos membros
// continuam separados de propósito: mudar quem define metas não deve mudar,
// por acidente, quem apaga venda.
//
// ESPELHO SQL: `public.papeis_do_grupo(text)` na migration
// supabase/migrations/20260916130000_fase2_papeis_canonicos.sql. O teste
// tests/papeis.test.mjs compara as duas definições e falha se divergirem.
// CÓPIA DENO: supabase/functions/_shared/papeis.ts precisa ser idêntica a este
// arquivo (as Edge Functions não enxergam app/); o mesmo teste confere.
//
// Este arquivo não importa nada, de propósito: roda no Node, no Vite e no Deno.
// ============================================================================

export const PAPEIS = ["admin", "executivo", "diretor", "gerente", "corretor"] as const;
export type Papel = (typeof PAPEIS)[number];

export const GRUPOS = {
  /** Qualquer usuário do sistema (SQL: is_equipe). */
  todos: ["admin", "executivo", "diretor", "gerente", "corretor"],
  /** Só administrador (SQL: is_admin). */
  admin: ["admin"],
  /** Ignora o mapa de permissões: canDo, has_perm, /api/permissions,
      can_manage_all, is_admin_exec, projetos. */
  acesso_total: ["admin", "executivo"],
  /** Exerce gestão: sessão "gestor", Central de Comando, Minha Equipe,
      escolher corretor ao cadastrar cliente, leitura de Ads. */
  gestao: ["admin", "executivo", "diretor", "gerente"],
  /** Balcão financeiro: categorias de caixa, apagar venda, editar comissões. */
  financeiro: ["admin", "executivo"],
  /** Definir metas. */
  metas: ["admin", "executivo"],
  /** Painel gerencial (/api/dashboard). */
  dashboard_gerencial: ["admin", "executivo"],
  /** Configurar etapas da esteira; venda gerada por eles já nasce aprovada. */
  esteira_config: ["admin", "executivo"],
  /** Excluir venda da esteira (SQL: excluir_venda_esteira). */
  excluir_venda: ["admin", "diretor"],
  /** Gestão de Produtos (SQL: is_product_manager). */
  produtos: ["admin", "executivo", "gerente"],
  /** Pode ser superior hierárquico na equipe; WhatsApp "ver tudo". */
  hierarquia: ["admin", "diretor", "gerente"],
  /** Supervisão da Sara/IA: visão global, testes de agente. */
  supervisao_ia: ["admin", "gerente"],
} as const satisfies Record<string, readonly Papel[]>;

export type Grupo = keyof typeof GRUPOS;

/** Normaliza o texto do banco para um papel real; qualquer outra coisa vira null. */
export function normalizarPapel(valor: unknown): Papel | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().toLowerCase();
  return (PAPEIS as readonly string[]).includes(limpo) ? (limpo as Papel) : null;
}

/** O papel pertence ao grupo? Papel desconhecido ou grupo inexistente = não (fail-closed). */
export function papelNoGrupo(papel: unknown, grupo: Grupo): boolean {
  const real = normalizarPapel(papel);
  const membros = (GRUPOS as Record<string, readonly Papel[]>)[grupo];
  return Boolean(real && membros && membros.includes(real));
}

export type PapelSessao = "admin" | "gestor" | "corretor";

/** Classe de sessão usada pela interface: admin, gestor (grupo gestao) ou corretor. */
export function papelDeSessao(papel: unknown): PapelSessao {
  const real = normalizarPapel(papel);
  if (real === "admin") return "admin";
  return papelNoGrupo(real, "gestao") ? "gestor" : "corretor";
}
