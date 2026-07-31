/**
 * MEU DIA 3.0 — PURO e testável (sem React, sem rede).
 *
 * Três seções, nesta ordem: Atender agora · Fazer hoje · Acompanhar depois.
 *
 * Duas regras que os testes prendem:
 *  1. UM CLIENTE APARECE UMA ÚNICA VEZ. Quem tem mais de um atendimento aberto
 *     entra uma vez só, no bloco mais urgente, com o contador dos demais.
 *  2. A partição vem da regra canônica (`crm-nova-era/lib/linguagem`). Aqui só
 *     traduzimos o rótulo — se o domínio mudar, a tela muda junto.
 *
 * A ordem DENTRO da seção é a que o banco devolveu (ncrm_fila_trabalho). Nada
 * é reordenado no cliente, senão a tela discordaria da regra.
 */
import { grupoDoItem, grupoVisivel, type GrupoVisivel } from "../../crm-nova-era/lib/linguagem.ts";
import { esperaHumana } from "../../crm-nova-era/lib/meuDia.ts";

export type ItemFila3 = {
  negocio_id: number;
  lead_nome: string | null;
  etapa: string;
  temperatura: string | null;
  corretor_nome: string | null;
  proxima_acao_titulo: string | null;
  proxima_acao_em: string | null;
  prioridade: number;
  motivo: string;
  espera_min: number;
  respondeu: boolean;
};

export type Secao3 = "atender_agora" | "fazer_hoje" | "acompanhar_depois";

export const ORDEM_SECOES: readonly Secao3[] = Object.freeze([
  "atender_agora",
  "fazer_hoje",
  "acompanhar_depois",
]);

export const SECAO_TITULO: Record<Secao3, string> = {
  atender_agora: "Atender agora",
  fazer_hoje: "Fazer hoje",
  acompanhar_depois: "Acompanhar depois",
};

export const SECAO_AJUDA: Record<Secao3, string> = {
  atender_agora: "Cliente novo, cliente que respondeu ou prazo estourado.",
  fazer_hoje: "Retornos, documentos e visitas que você combinou.",
  acompanhar_depois: "Ações futuras e clientes sem urgência agora.",
};

/** Ponte com a partição canônica do domínio. */
export function secaoDoItem(item: Pick<ItemFila3, "prioridade" | "respondeu" | "proxima_acao_em">): Secao3 {
  const visivel: GrupoVisivel = grupoVisivel(grupoDoItem(item));
  if (visivel === "atenda_agora") return "atender_agora";
  if (visivel === "faca_combinado") return "fazer_hoje";
  return "acompanhar_depois";
}

/** Chave de identidade do cliente. Sem nome, cai no próprio atendimento. */
export function chaveCliente(item: ItemFila3): string {
  const nome = String(item.lead_nome ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!nome) return `negocio:${item.negocio_id}`;
  const corretor = String(item.corretor_nome ?? "").toLowerCase().trim();
  return `cliente:${nome}|${corretor}`;
}

export type CartaoDia = {
  /** Atendimento que será aberto pelo botão principal. */
  negocioId: number;
  nome: string;
  corretor: string;
  motivo: string;
  tempo: string;
  proximaAcao: string;
  proximaAcaoEm: string | null;
  secao: Secao3;
  prioridade: number;
  /** Quantos outros atendimentos do mesmo cliente foram absorvidos aqui. */
  outrosAtendimentos: number;
};

export type BlocoDia = {
  secao: Secao3;
  titulo: string;
  ajuda: string;
  cartoes: CartaoDia[];
};

function paraCartao(item: ItemFila3, secao: Secao3, outros: number): CartaoDia {
  return {
    negocioId: item.negocio_id,
    nome: item.lead_nome?.trim() || `Atendimento ${item.negocio_id}`,
    corretor: item.corretor_nome?.trim() || "Sem corretor",
    motivo: item.motivo,
    tempo: esperaHumana(item.espera_min),
    proximaAcao: item.proxima_acao_titulo?.trim() || "Definir próxima ação",
    proximaAcaoEm: item.proxima_acao_em,
    secao,
    prioridade: item.prioridade,
    outrosAtendimentos: outros,
  };
}

/**
 * Um cliente, uma linha. Mantém a PRIMEIRA ocorrência (a fila já vem ordenada
 * por prioridade), conta as demais e devolve na ordem original.
 */
export function unificarPorCliente(itens: ItemFila3[]): Array<{ item: ItemFila3; outros: number }> {
  const posicao = new Map<string, number>();
  const saida: Array<{ item: ItemFila3; outros: number }> = [];
  for (const item of itens) {
    const chave = chaveCliente(item);
    const idx = posicao.get(chave);
    if (idx === undefined) {
      posicao.set(chave, saida.length);
      saida.push({ item, outros: 0 });
    } else {
      saida[idx].outros += 1;
    }
  }
  return saida;
}

/** Monta as três seções já unificadas por cliente. */
export function montarSecoes(itens: ItemFila3[]): BlocoDia[] {
  const unicos = unificarPorCliente(itens);
  const mapa: Record<Secao3, CartaoDia[]> = {
    atender_agora: [],
    fazer_hoje: [],
    acompanhar_depois: [],
  };
  for (const { item, outros } of unicos) {
    const secao = secaoDoItem(item);
    mapa[secao].push(paraCartao(item, secao, outros));
  }
  return ORDEM_SECOES.map((secao) => ({
    secao,
    titulo: SECAO_TITULO[secao],
    ajuda: SECAO_AJUDA[secao],
    cartoes: mapa[secao],
  }));
}

/** Chamada do topo: conta só o que é urgência de verdade. */
export function totalParaAtender(itens: ItemFila3[]): number {
  return unificarPorCliente(itens).filter(({ item }) => secaoDoItem(item) === "atender_agora").length;
}

/**
 * O botão principal do cartão. É sempre UM só e sempre abre o atendimento —
 * a conversa, o WhatsApp e a Sara vivem dentro da ficha. Prometer discagem na
 * lista seria promessa vazia: a fila não devolve telefone.
 */
export function botaoPrincipal(cartao: CartaoDia): { rotulo: string; acao: "abrir_atendimento" } {
  if (cartao.secao === "atender_agora") return { rotulo: "Atender agora", acao: "abrir_atendimento" };
  if (cartao.secao === "fazer_hoje") return { rotulo: "Abrir atendimento", acao: "abrir_atendimento" };
  return { rotulo: "Ver atendimento", acao: "abrir_atendimento" };
}

/* ==================== Painel de abertura ====================
 *
 * A primeira coisa que o corretor le nao deveria ser uma lista: deveria ser o
 * tamanho do dia dele, em numeros que ele reconhece.
 *
 * Os tres contadores saem da MESMA fila que a tela ja carrega. Visitas do dia
 * NAO entram: a fila de trabalho nao devolve visita, e inventar um numero que
 * o corretor nao consegue conferir e pior do que nao mostrar. Visita tem aba
 * propria, e e la que ela e contada.
 */

export type PainelAbertura = {
  aguardandoResposta: number;
  leadsNovos: number;
  retornosHoje: number;
  /** O cliente que deve ser atendido agora, ja sem repeticao. */
  proximo: CartaoDia | null;
};

function ehHoje(iso: string | null, agora: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === agora.getFullYear()
    && d.getMonth() === agora.getMonth()
    && d.getDate() === agora.getDate();
}

export function painelDeAbertura(itens: ItemFila3[], agora: Date = new Date()): PainelAbertura {
  const unicos = unificarPorCliente(itens);
  let aguardandoResposta = 0;
  let leadsNovos = 0;
  let retornosHoje = 0;

  for (const { item } of unicos) {
    if (item.respondeu) aguardandoResposta++;
    if (item.etapa === "novo") leadsNovos++;
    if (!item.respondeu && item.etapa !== "novo" && ehHoje(item.proxima_acao_em, agora)) retornosHoje++;
    else if (item.respondeu && ehHoje(item.proxima_acao_em, agora)) retornosHoje++;
  }

  const primeiroUrgente = unicos.find(({ item }) => secaoDoItem(item) === "atender_agora");
  const proximo = primeiroUrgente
    ? paraCartao(primeiroUrgente.item, "atender_agora", primeiroUrgente.outros)
    : null;

  return { aguardandoResposta, leadsNovos, retornosHoje, proximo };
}

/** Saudacao pela hora do dia. Sem exclamacao: e uma ferramenta de trabalho. */
export function saudacao(nome: string, agora: Date = new Date()): string {
  const h = agora.getHours();
  const parte = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const primeiro = String(nome ?? "").trim().split(/\s+/)[0] || "corretor";
  return `${parte}, ${primeiro}`;
}
