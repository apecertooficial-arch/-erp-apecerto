/* Escopo de acesso da Inteligência no servidor.
 *
 * A trava de banco (is_equipe() nas RPCs) garante que só a equipe lê. Aqui
 * aplicamos o escopo FINO por papel ANTES de consultar: a família "Site e
 * marketing" é restrita a admin, gestor e marketing.
 *
 * IMPORTANTE: "marketing" ainda NÃO é um papel/perfil do sistema (ver
 * app/lib/permissions.ts — os módulos vão de dashboard a auditoria, sem
 * marketing/inteligência). Então hoje isto libera na prática admin + gestor.
 * O gancho já reconhece um perfil cujo nome contenha "market" ou uma permissão
 * explícita de marketing/inteligência, para funcionar sozinho quando esse papel
 * for criado. */

import type { PermissionMap } from "../permissions";

export type PapelNormalizado = "admin" | "gestor" | "corretor";

const PAPEIS_GESTAO = new Set(["gestor", "executivo", "gestor_comercial", "gestor_equipe", "diretor", "gerente"]);
const PERFIL_MARKETING = /market/i;
const PERMISSOES_MARKETING = ["marketing", "inteligencia", "inteligencia_site"];

/** As 8 telas da família "Site e marketing". */
export const TELAS_FAMILIA_SITE = new Set([
  "digital", "aquisicao", "comportamento", "imoveis", "conversao", "proprietarios", "sara", "privacidade",
]);

export function normalizarPapel(perfilBruto: string | null | undefined): PapelNormalizado {
  if (perfilBruto === "admin") return "admin";
  if (perfilBruto && PAPEIS_GESTAO.has(perfilBruto)) return "gestor";
  return "corretor";
}

/** Pode ver a família Site e marketing? admin/gestor/marketing — nunca corretor puro. */
export function podeVerFamiliaSite(perfilBruto: string | null | undefined, permissoes: PermissionMap | null | undefined): boolean {
  const papel = normalizarPapel(perfilBruto);
  if (papel === "admin" || papel === "gestor") return true;
  if (perfilBruto && PERFIL_MARKETING.test(perfilBruto)) return true;
  return PERMISSOES_MARKETING.some((k) => (permissoes?.[k] ?? []).includes("ver"));
}

/** Rótulo de período das telas -> janela em dias para as RPCs. */
export function diasDoPeriodo(rotulo: string | null): number {
  switch ((rotulo ?? "").trim().toLowerCase()) {
    case "hoje": return 1;
    case "7 dias": return 7;
    case "90 dias": return 90;
    case "30 dias": return 30;
    default: return 30;
  }
}

/* Família "Performance" — abre para CEO, gestores e gerentes (não corretor puro).
 * Como o time hoje é só admin/gestor, isto cobre a decisão atual; refino
 * por-tela (ex.: corretor vê só a própria página) fica para quando entrar corretor. */
export const TELAS_FAMILIA_PERFORMANCE = new Set([
  "empresa", "atendimento", "equipe", "gerentes", "corretores", "qualidade", "vendas", "financeiro", "alertas",
]);

export function podeVerPerformance(perfilBruto: string | null | undefined): boolean {
  const papel = normalizarPapel(perfilBruto);
  return papel === "admin" || papel === "gestor";
}
