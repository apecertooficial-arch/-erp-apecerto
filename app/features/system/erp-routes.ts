/* Fonte unica de verdade da navegacao do ERP.
 *
 * Antes deste arquivo o ERP inteiro vivia em UMA rota ("/"), com a navegacao
 * guardada num useState<ModuleName> dentro de ProductCatalog. Isso impedia
 * deep-link, botao voltar, atalhos do manifest e notificacao clicavel.
 *
 * Aqui cada modulo ganha: um caminho de URL, o(s) slug(s) de permissao que ja
 * existem no banco, a classificacao A/B/C do app (FASE 1 do briefing) e se ele
 * EXISTE NO CELULAR.
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
  /**
   * O modulo tem tela desenhada para celular?
   *
   * false = existe SO no formato computador. O celular nao oferece o caminho:
   * nem na barra de baixo, nem na folha "Mais", nem na tela de Gestao. Antes
   * desta flag a folha "Mais" espelhava a sidebar e listava 17 modulos; tocar
   * em qualquer um deles abria uma tela de escritorio comprimida em 390px, que
   * na pratica se le como "o botao nao faz nada".
   *
   * A rota continua existindo: quem abrir o link no navegador do computador
   * chega normalmente. Isto controla apenas o que o APP oferece.
   */
  mobile: boolean;
};

export const rotasModulo: Record<ModuleName, RotaModulo> = {
  /* "Meu Dia", nao "Inicio": no celular esta aba abre a FILA do dia -- o que
     chegou, o que chamar agora, o que fica para mais tarde. O rotulo diz o que
     o corretor vai encontrar, nao onde ele esta. */
  "Início": { path: "/inicio", slugs: ["dashboard"], classe: "A", rotuloCurto: "Meu Dia", mobile: true },
  CRM: { path: "/crm", slugs: ["crm", "leads", "pipeline"], classe: "A", rotuloCurto: "CRM", mobile: true },
  "Calendário": { path: "/agenda", slugs: ["calendario"], classe: "A", rotuloCurto: "Agenda", mobile: true },
  "Notificações": { path: "/notificacoes", slugs: ["notificacoes"], classe: "A", rotuloCurto: "Avisos", mobile: true },
  Produtos: { path: "/produtos", slugs: ["produtos"], classe: "A", rotuloCurto: "Produtos", mobile: true },
  /* "projetos" NAO existe no catalogo de permissoes do banco -- conferido na
     homologacao contra /api/permissions. Como podeVer() e fail-closed, um slug
     inexistente escondia Tarefas de TODO mundo que nao fosse admin. Sem
     conceito de permissao no banco, o modulo nao e gateado. Se um dia criarem
     o slug "projetos", basta devolve-lo aqui. */
  "Projetos e Tarefas": { path: "/tarefas", slugs: [], classe: "A", rotuloCurto: "Tarefas", mobile: true },

  /* MINHA EQUIPE fica fora do celular por enquanto: a RPC equipe_visao depende
     da relacao `perf_snapshots`, que nao existe no banco -- a tela abria e so
     tinha erro para mostrar. O que o gestor precisa dali (quem esta
     trabalhando, resposta no prazo) esta no Inicio dele. Volta a true no dia em
     que a relacao existir. */
  "Minha Equipe": { path: "/equipe", slugs: [], classe: "B", rotuloCurto: "Equipe", mobile: false },
  /* Rotulo "Inicio": no celular do gestor esta e a primeira tela, o resumo da
     operacao. "Painel" dizia onde ele estava, nao o que ia encontrar. */
  /* Módulo temporariamente fora da navegação durante a reconstrução visual. */
  Performance: { path: "/performance", slugs: ["performance"], classe: "B", rotuloCurto: "Performance", mobile: false },
  Abordagens: { path: "/abordagens", slugs: ["abordagens"], classe: "B", mobile: false },
  "Automações": { path: "/automacoes", slugs: ["automacoes"], classe: "B", mobile: false },
  "Agentes de IA": { path: "/agentes-ia", slugs: ["agentes_ia"], classe: "B", rotuloCurto: "Agentes", mobile: false },
  "Usuários": { path: "/usuarios", slugs: ["usuarios"], classe: "B", mobile: false },
  "Perfis e Permissões": { path: "/permissoes", slugs: ["usuarios"], classe: "B", rotuloCurto: "Permissões", mobile: false },
  /* So o slug "financeiro". O AppShell antigo aceitava tambem comissoes,
     vendas e fluxo_caixa com .some() -- e TODOS os 8 perfis tem
     "comissoes: ver", inclusive corretor. Resultado observado em producao:
     corretor enxergava o modulo Financeiro inteiro. Ver a propria comissao
     nao e o mesmo que abrir o Financeiro da imobiliaria.
     Quem tem o slug hoje: admin, auditor, diretor, financeiro. */
  Financeiro: { path: "/financeiro", slugs: ["financeiro"], classe: "B", mobile: false },
  Auditoria: { path: "/auditoria", slugs: ["auditoria"], classe: "B", mobile: false },

  "Chat ao Vivo": { path: "/chat", slugs: ["chat"], classe: "C", rotuloCurto: "Chat", mobile: false },
  Disparos: { path: "/disparos", slugs: ["disparos"], classe: "C", mobile: false },
  Financiamento: { path: "/financiamento", slugs: [], classe: "C", mobile: false },
  "Base de conhecimento": { path: "/conhecimento", slugs: [], classe: "C", rotuloCurto: "Base", mobile: false },
  "Configurações": { path: "/configuracoes", slugs: ["configuracoes"], classe: "C", rotuloCurto: "Gestão", mobile: true },
  Ajuda: { path: "/ajuda", slugs: [], classe: "C", mobile: true },
};

const barraCorretor: ModuleName[] = ["Início", "CRM", "Calendário", "Notificações"];
/* Barra do gestor: Inicio (resumo da operacao), Produtos, Calendario, Gestao.
   Equipe saiu -- ver a nota em "Minha Equipe". */
const barraGestor: ModuleName[] = ["Início", "Produtos", "Calendário", "Configurações"];

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

/** O modulo tem tela de celular? Usado pela navegacao do app e pela tela de Gestao. */
export function existeNoApp(nome: ModuleName): boolean {
  return rotasModulo[nome].mobile;
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
  // Painel, Equipe e Gestão são a rotina do gestor e nunca a do corretor.
  if (nome === "Minha Equipe" || nome === "Performance" || nome === "Configurações") {
    if (isManager || role === "gestor") return true;
    if (nome === "Minha Equipe") return false;
  }

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
 *
 * O APP NAO E O ERP INTEIRO. Modulo com mobile:false nao aparece em nenhuma das
 * duas: no celular o corretor tem a rotina dele, e o gestor tem o resumo da
 * operacao, produtos, calendario e gestao. O resto vive no computador.
 */
export type ItensNavegacao = { barra: ModuleName[]; mais: ModuleName[] };

export function itensDaNavegacao(opcoes: Parameters<typeof podeVer>[1]): ItensNavegacao {
  const visiveis = modulosVisiveis(opcoes).filter(existeNoApp);
  const gestao = opcoes.role === "admin" || opcoes.role === "gestor" || opcoes.isManager === true;
  const barra = (gestao ? barraGestor : barraCorretor).filter((m) => visiveis.includes(m));
  const mais = visiveis.filter((m) => !barra.includes(m));
  return { barra, mais };
}
