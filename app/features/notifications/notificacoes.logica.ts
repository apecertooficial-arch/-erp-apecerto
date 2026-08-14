/* Regras das notificacoes, fora do componente para serem testadas sem navegador.
 *
 * O problema real medido em producao: 631 avisos numa lista unica, ordenados por
 * uma prioridade de tres niveis que nao distingue "cliente respondeu" de
 * "alguem editou um produto". Isso nao e notificacao, e ruido.
 */

export type Categoria = "leads" | "desatualizados" | "mensagens" | "tarefas" | "vendas" | "sistema";

export type Aviso = {
  id: string;
  category: Categoria;
  title: string;
  context: string;
  when: string;
  dealId: number | null;
  count: number;
  /** Marcado por quem monta o aviso. Distingue "cliente respondeu" de "lead novo". */
  especie?: Especie;
};

/* Ordem pedida, do mais urgente para o menos. O numero e o peso: menor vem
   primeiro. Nao e alta/media/baixa -- "cliente respondeu" e "tarefa" seriam
   ambos "alta" e ficariam embaralhados. */
export type Especie = "respondeu" | "lead_novo" | "acao_vencida" | "visita_proxima" | "tarefa" | "sistema";

export const PESO: Record<Especie, number> = {
  respondeu: 1, lead_novo: 2, acao_vencida: 3, visita_proxima: 4, tarefa: 5, sistema: 6,
};

export const ROTULO_ESPECIE: Record<Especie, string> = {
  respondeu: "Cliente respondeu", lead_novo: "Lead novo", acao_vencida: "Ação vencida",
  visita_proxima: "Visita próxima", tarefa: "Tarefa", sistema: "Sistema",
};

/** Deduz a especie quando quem montou o aviso nao marcou. */
export function especieDe(a: Aviso): Especie {
  if (a.especie) return a.especie;
  if (a.category === "mensagens") return "respondeu";
  if (a.category === "leads") return a.id.startsWith("wait-") ? "acao_vencida" : "lead_novo";
  if (a.category === "tarefas") return "tarefa";
  if (a.category === "desatualizados") return "acao_vencida";
  return "sistema";
}

/** "Sistema" e historico, nao aviso operacional: nunca conta como util. */
export const ehUtil = (a: Aviso) => especieDe(a) !== "sistema";

const minutosAte = (iso: string, agora: Date) => (agora.getTime() - new Date(iso).getTime()) / 60000;

export type Balde = "agora" | "hoje" | "anteriores";

export function baldeDe(a: Aviso, agoraMin = 60, agora = new Date()): Balde {
  const m = minutosAte(a.when, agora);
  if (m < 0) return "agora";           // agendado para daqui a pouco
  if (m <= agoraMin) return "agora";
  /* "Hoje" e o dia de SAO PAULO, nao o do servidor. Em producao e no CI o
     relogio e UTC: das 21h a meia-noite de SP, comparar getDate() jogava
     aviso de hoje em "Anteriores" na frente do corretor. */
  const fuso = (x: Date) => x.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return fuso(new Date(a.when)) === fuso(agora) ? "hoje" : "anteriores";
}

/* Agrupa por LEAD + especie, nao por titulo.
 *
 * O agrupamento anterior usava categoria + titulo, e o titulo carrega o nome do
 * lead e o tempo -- entao "Lead parado: Ana (2 dias)" e "Lead parado: Ana
 * (3 dias)" viravam dois avisos do mesmo problema. Era assim que 631 apareciam.
 */
export function agrupar(avisos: Aviso[]): Aviso[] {
  const mapa = new Map<string, Aviso>();
  for (const a of avisos) {
    const chave = a.dealId != null ? `${especieDe(a)}:deal:${a.dealId}` : `${especieDe(a)}:${a.title}`;
    const atual = mapa.get(chave);
    if (!atual) { mapa.set(chave, { ...a, especie: especieDe(a) }); continue; }
    atual.count += a.count;
    if (a.when > atual.when) { atual.when = a.when; atual.title = a.title; atual.context = a.context; }
  }
  return [...mapa.values()];
}

/** Prioridade primeiro, mais recente depois. */
export function ordenar(avisos: Aviso[]): Aviso[] {
  return [...avisos].sort((a, b) => {
    const p = PESO[especieDe(a)] - PESO[especieDe(b)];
    return p !== 0 ? p : b.when.localeCompare(a.when);
  });
}

export type Secao = { balde: Balde; titulo: string; itens: Aviso[] };
const TITULO: Record<Balde, string> = { agora: "Agora", hoje: "Hoje", anteriores: "Anteriores" };

/* Monta a tela: agrupa, filtra, ordena, corta em paginas de 20 e reparte em
   Agora / Hoje / Anteriores. O corte acontece DEPOIS da ordenacao, senao a
   primeira pagina traria os avisos errados. */
export function montarSecoes(
  avisos: Aviso[],
  opcoes: { lidas: string[]; soNaoLidas: boolean; pagina: number; porPagina?: number },
): { secoes: Secao[]; total: number; mostrando: number; temMais: number } {
  const porPagina = opcoes.porPagina ?? 20;
  const lidas = new Set(opcoes.lidas);
  const base = ordenar(agrupar(avisos))
    .filter((a) => (opcoes.soNaoLidas ? !lidas.has(a.id) : true));

  const limite = Math.max(1, opcoes.pagina) * porPagina;
  const visiveis = base.slice(0, limite);

  const secoes: Secao[] = (["agora", "hoje", "anteriores"] as Balde[])
    .map((b) => ({ balde: b, titulo: TITULO[b], itens: visiveis.filter((a) => baldeDe(a) === b) }))
    .filter((s) => s.itens.length > 0);

  return { secoes, total: base.length, mostrando: visiveis.length, temMais: Math.max(0, base.length - visiveis.length) };
}

/** Badge: so nao lidas UTEIS. Sistema e historico lido ficam de fora. */
export function contarNaoLidasUteis(avisos: Aviso[], lidas: string[]): number {
  const lido = new Set(lidas);
  return agrupar(avisos).filter((a) => ehUtil(a) && !lido.has(a.id)).length;
}

/** "Marcar tudo como lido" pede confirmacao quando o estrago seria grande. */
export const LIMITE_CONFIRMACAO = 20;
export const precisaConfirmar = (quantos: number) => quantos > LIMITE_CONFIRMACAO;
