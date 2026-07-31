/* Regras do Meu Dia do corretor, fora do componente.
 *
 * O app do corretor nao e o ERP encolhido. Ele responde uma pergunta so:
 * "quem eu atendo agora, e por que?". Tudo aqui existe para produzir essa
 * resposta a partir do que o BANCO ja decidiu -- a prioridade vem de
 * ncrm_fila_trabalho, nunca e recalculada aqui.
 */

/* A regra canonica dos grupos vive em crm-nova-era/lib/linguagem.ts. Ela nao e
   importada aqui de proposito: aquele arquivo faz parte da arvore do CRM, e o
   Inicio do celular precisa carregar leve. A copia abaixo e amarrada por teste
   -- tests/meu-dia.test.mjs importa as DUAS e falha se discordarem. */
export type GrupoVisivel = "atenda_agora" | "faca_combinado" | "acompanhe";

export function grupoDoItem(item: { prioridade: number; respondeu?: boolean; proxima_acao_em?: string | null }): string {
  if (item.prioridade <= 2) return "atenda_agora";
  if (item.prioridade <= 6) return "faca_hoje";
  if (item.respondeu) return "aguardando_cliente";
  return "agendados";
}

export function grupoVisivel(grupo: string): GrupoVisivel {
  if (grupo === "atenda_agora") return "atenda_agora";
  if (grupo === "aguardando_cliente") return "acompanhe";
  return "faca_combinado";
}

/* Payload de GET /api/ncrm/fila-operacional — o contrato do app. */
export type ItemFila = {
  negocio_id: number;
  lead_id: number | null;
  nome: string | null;
  etapa: string;
  motivo_prioridade: string;
  tempo_espera: number;
  prioridade: number;
  respondeu: boolean;
  telefone_normalizado: string | null;
  interesse_resumo: string | null;
  sara_orientacao_curta: string | null;
  proxima_acao_tipo: string | null;
  proxima_acao_prazo: string | null;
  outbound_real_confirmado: boolean;
  aguardando_sincronizacao: boolean;
  deep_link: string;
};

/* Etapas do funil inteligente, na linguagem de quem atende. */
export const ROTULO_ETAPA: Record<string, string> = {
  novo: "Novo",
  tentando_contato: "Tentando contato",
  em_atendimento: "Em atendimento",
  em_acompanhamento: "Em acompanhamento",
};

export type Acao = "whatsapp" | "atendimento" | "tarefa";

/* Qual e a UNICA acao do card.
 *
 * "Chamar no WhatsApp" so pode aparecer com telefone validado em maos. A fila
 * (/api/ncrm/fila) NAO devolve telefone -- conferido em producao --, entao o
 * card leva para a ficha, que tem o telefone e o botao de verdade. Prometer
 * discagem que nao acontece seria pior do que um toque a mais.
 *
 * Quando a proxima acao e um compromisso operacional (visita, documento,
 * proposta), a acao vira "Ver tarefa": abrir uma conversa nao e o que resolve.
 */
const PALAVRAS_TAREFA = /visita|document|proposta|contrato|reuni|assinatura|vistoria/i;

export function acaoDoItem(i: ItemFila): Acao {
  if (i.proxima_acao_tipo && PALAVRAS_TAREFA.test(i.proxima_acao_tipo)) return "tarefa";
  if (i.telefone_normalizado) return "whatsapp";
  return "atendimento";
}

export const ROTULO_ACAO: Record<Acao, string> = {
  whatsapp: "Chamar no WhatsApp",
  atendimento: "Abrir atendimento",
  tarefa: "Ver tarefa",
};

export function esperaHumana(min: number): string {
  if (!Number.isFinite(min) || min < 1) return "agora";
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = Math.floor(h / 24);
  const r = Math.round(h % 24);
  return r ? `${d}d ${r}h` : `${d}d`;
}

export function saudacao(hora: number): string {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export type Card = {
  id: string;
  negocioId: number;
  nome: string;
  motivo: string;
  espera: string;
  etapa: string;
  interesse: string | null;
  orientacaoSara: string | null;
  telefone: string | null;
  vencida: boolean;
  aguardandoServidor: boolean;
  outboundConfirmado: boolean;
  deepLink: string;
  acao: Acao;
};

export type Bloco = { chave: GrupoVisivel; titulo: string; ajuda: string; cards: Card[]; total: number };

export const TITULO_BLOCO: Record<GrupoVisivel, string> = {
  atenda_agora: "Atenda agora",
  faca_combinado: "Faça o combinado",
  acompanhe: "Acompanhe",
};
export const AJUDA_BLOCO: Record<GrupoVisivel, string> = {
  atenda_agora: "Cliente respondeu, lead novo ou ação vencida.",
  faca_combinado: "Retornos, documentos, visitas e propostas que você prometeu.",
  acompanhe: "Sem urgência agora. Ações futuras e acompanhamentos.",
};

export const ORDEM_BLOCOS: GrupoVisivel[] = ["atenda_agora", "faca_combinado", "acompanhe"];

function paraCard(i: ItemFila): Card {
  return {
    id: `n${i.negocio_id}`,
    negocioId: i.negocio_id,
    nome: i.nome?.trim() || `Atendimento ${i.negocio_id}`,
    motivo: i.motivo_prioridade,
    espera: esperaHumana(i.tempo_espera),
    etapa: ROTULO_ETAPA[i.etapa] ?? i.etapa,
    interesse: i.interesse_resumo,
    orientacaoSara: i.sara_orientacao_curta,
    telefone: i.telefone_normalizado,
    vencida: !!i.proxima_acao_prazo && new Date(i.proxima_acao_prazo).getTime() < Date.now(),
    aguardandoServidor: i.aguardando_sincronizacao,
    outboundConfirmado: i.outbound_real_confirmado,
    deepLink: i.deep_link,
    acao: acaoDoItem(i),
  };
}

/* Monta os tres blocos.
 *
 * grupoVisivel e uma PARTICAO: cada item cai em exatamente um bloco. E por isso
 * que o mesmo lead nunca aparece em duas listas.
 */
export function montarBlocos(itens: ItemFila[], porBloco = 3): Bloco[] {
  const balde: Record<GrupoVisivel, ItemFila[]> = { atenda_agora: [], faca_combinado: [], acompanhe: [] };
  for (const i of itens) balde[grupoVisivel(grupoDoItem({ prioridade: i.prioridade, respondeu: i.respondeu, proxima_acao_em: i.proxima_acao_prazo }))].push(i);

  return ORDEM_BLOCOS.map((chave) => ({
    chave,
    titulo: TITULO_BLOCO[chave],
    ajuda: AJUDA_BLOCO[chave],
    cards: balde[chave].slice(0, porBloco).map(paraCard),
    total: balde[chave].length,
  }));
}

/** "Você tem X clientes para atender" — só o bloco de urgência conta. */
export function paraAtender(itens: ItemFila[]): number {
  return itens.filter((i) => grupoVisivel(grupoDoItem({ prioridade: i.prioridade, respondeu: i.respondeu, proxima_acao_em: i.proxima_acao_prazo })) === "atenda_agora").length;
}

/** Progresso do dia: o que saiu da urgência sobre o que entrou. */
export function progressoDoDia(itens: ItemFila[], concluidosHoje: number): { feitos: number; total: number; pct: number } {
  const pendentes = paraAtender(itens);
  const total = pendentes + concluidosHoje;
  return { feitos: concluidosHoje, total, pct: total > 0 ? Math.round((concluidosHoje / total) * 100) : 0 };
}
