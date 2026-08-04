/* Fonte unica de verdade da navegacao do ERP.
 *
 * Antes deste arquivo o ERP inteiro vivia em UMA rota ("/"), com a navegacao
 * guardada num useState<ModuleName> dentro de ProductCatalog. Isso impedia
 * deep-link, botao voltar, atalhos do manifest e notificacao clicavel.
 *
 * Aqui cada modulo ganha: um caminho de URL, o(s) slug(s) de permissao que ja
 * existem no banco, e a classificacao A/B/C do app (FASE 1 do briefing).
 *
 * REGRA: nao invente slug. Os slugs abaixo sao os mesmos que AppShell.tsx ja
 * usava em permSlugs -- se divergirem, o corretor perde o menu.
 */

import type { ModuleName } from "./module-map";

/** A = essencial no app - B = conforme papel - C = baixa frequencia */
export type ClasseApp = "A" | "B" | "C";

export type RotaModulo = {
  /** Caminho canonico. Deep-link, atalho de manifest e notificacao apontam pra ca. */
  path: string;
  /** Slugs de permissao gravados no banco. Vazio = modulo sem controle de permissao. */
  slugs: string[];
  classe: ClasseApp;
  /** Rotulo curto para a barra inferior do celular (o nome completo nao cabe). */
  rotuloCurto?: string;
};

export const rotasModulo: Record<ModuleName, RotaModulo> = {
  "Início": { path: "/inicio", slugs: ["dashboard"], classe: "A", rotuloCurto: "Início" },
  CRM: { path: "/crm", slugs: ["crm", "leads", "pipeline"], classe: "A", rotuloCurto: "CRM" },
  "Calendário": { path: "/agenda", slugs: ["calendario"], classe: "A", rotuloCurto: "Agenda" },
  "Notificações": { path: "/notificacoes", slugs: ["notificacoes"], classe: "A", rotuloCurto: "Avisos" },
  Produtos: { path: "/produtos", slugs: ["produtos"], classe: "A", rotuloCurto: "Produtos" },
  /* "projetos" NAO existe no catalogo de permissoes do banco -- conferido na
     homologacao contra /api/permissions. Como podeVer() e fail-closed, um slug
     inexistente escondia Tarefas de TODO mundo que nao fosse admin. Sem
     conceito de permissao no banco, o modulo nao e gateado. Se um dia criarem
     o slug "projetos", basta devolve-lo aqui. */
  "Projetos e Tarefas": { path: "/tarefas", slugs: [], classe: "A", rotuloCurto: "Tarefas" },

  "Minha Equipe": { path: "/equipe", slugs: [], classe: "B", rotuloCurto: "Equipe" },
  Performance: { path: "/performance", slugs: ["performance"], classe: "B", rotuloCurto: "Performance" },
  Abordagens: { path: "/abordagens", slugs: ["abordagens"], classe: "B" },
  "Automações": { path: "/automacoes", slugs: ["automacoes"], classe: "B" },
  "Agentes de IA": { path: "/agentes-ia", slugs: ["agentes_ia"], classe: "B", rotuloCurto: "Agentes" },
  "Usuários": { path: "/usuarios", slugs: ["usuarios"], classe: "B" },
  "Perfis e Permissões": { path: "/permissoes", slugs: ["usuarios"], classe: "B", rotuloCurto: "Permissões" },
  /* So o slug "financeiro". O AppShell antigo aceitava tambem comissoes,
     vendas e fluxo_caixa com .some() -- e TODOS os 8 perfis tem
     "comissoes: ver", inclusive corretor. Resultado observado em producao:
     corretor enxergava o modulo Financeiro inteiro. Ver a propria comissao
     nao e o mesmo que abrir o Financeiro da imobiliaria.
     Quem tem o slug hoje: admin, auditor, diretor, financeiro. */
  Financeiro: { path: "/financeiro", slugs: ["financeiro"], classe: "B" },
  Auditoria: { path: "/auditoria", slugs: ["auditoria"], classe: "B" },

  "Chat ao Vivo": { path: "/chat", slugs: ["chat"], classe: "C", rotuloCurto: "Chat" },
  Disparos: { path: "/disparos", slugs: ["disparos"], classe: "C" },
  Financiamento: { path: "/financiamento", slugs: [], classe: "C" },
  "Base de conhecimento": { path: "/conhecimento", slugs: [], classe: "C", rotuloCurto: "Base" },
  "Configurações": { path: "/configuracoes", slugs: ["configuracoes"], classe: "C", rotuloCurto: "Ajustes" },
  Ajuda: { path: "/ajuda", slugs: [], classe: "C" },
};

/** Aplicativo operacional: somente as três entradas que o corretor usa todo dia. */
export const barraInferior: ModuleName[] = ["Início", "CRM", "Calendário"];

const porPath = new Map<string, ModuleName>(
  (Object.entries(rotasModulo) as Array<[ModuleName, RotaModulo]>).map(([nome, rota]) => [rota.path, nome]),
);

export function moduloDoPath(pathname: string): ModuleName | null {
  if (!pathname) return null;
  // "/crm/lead/123" continua sendo o modulo CRM.
  const base = "/" + (pathname.split("/").filter(Boolean)[0] ?? "");
  return porPath.get(base) ?? null;
}

export function pathDoModulo(nome: ModuleName): string {
  return rotasModulo[nome].path;
}

/* Permissao.
 *
 * ATENCAO -- mudanca de comportamento deliberada em relacao ao AppShell antigo:
 * la, modulePermissions nulo ou vazio liberava TODOS os modulos (fail-open).
 * Numa falha da API de permissoes o corretor enxergava Financeiro, Auditoria e
 * Usuarios. Aqui o default e fail-closed para quem nao e admin: sem mapa de
 * permissao carregado, so ficam de pe os modulos sem slug de controle.
 *
 * "carregado" distingue "ainda buscando" de "buscou e veio vazio", para nao
 * piscar um menu vazio durante o carregamento.
 */
export function podeVer(
  nome: ModuleName,
  opcoes: {
    role: "admin" | "gestor" | "corretor";
    permissoes: Record<string, string[]> | null;
    carregado: boolean;
    isManager?: boolean;
  },
): boolean {
  const { role, permissoes, carregado, isManager = false } = opcoes;

  if (role === "admin") return true;
  // "Minha Equipe" nao tem slug: quem libera e o papel real de gestao.
  if (nome === "Minha Equipe") return isManager;

  const { slugs } = rotasModulo[nome];
  if (slugs.length === 0) return true;

  if (!carregado || !permissoes) return false;
  return slugs.some((slug) => (permissoes[slug] ?? []).includes("ver"));
}

export function modulosVisiveis(opcoes: Parameters<typeof podeVer>[1]): ModuleName[] {
  return (Object.keys(rotasModulo) as ModuleName[]).filter((nome) => podeVer(nome, opcoes));
}

/* Entrada legada "/".
 *
 * Funcao pura para poder ser testada sem navegador. O hash e devolvido intacto
 * porque o retorno de redefinicao de senha do Supabase chega em
 * "/#access_token=...&type=recovery" -- perder o hash quebra a troca de senha.
 */
export function destinoEntradaLegada(search: string, hash: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const destino = params.get("crm") === "nova-era" ? "/crm" : "/inicio";
  params.delete("crm");
  const resto = params.toString();
  return `${destino}${resto ? `?${resto}` : ""}${hash || ""}`;
}

/* Nucleo da navegacao, puro.
 *
 * A barra inferior e a folha "Mais" sao duas faces da MESMA decisao. Manter a
 * regra aqui, fora do componente, permite testa-la sem navegador e garante que
 * as duas nunca divirjam.
 */
export type ItensNavegacao = { barra: ModuleName[]; mais: ModuleName[] };

export function itensDaNavegacao(opcoes: Parameters<typeof podeVer>[1]): ItensNavegacao {
  const visiveis = modulosVisiveis(opcoes);
  const barra = barraInferior.filter((m) => visiveis.includes(m));
  const mais = visiveis.filter((m) => !barra.includes(m));
  return { barra, mais };
}
