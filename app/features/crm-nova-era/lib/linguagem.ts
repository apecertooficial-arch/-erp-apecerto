/**
 * LINGUAGEM DO CORRETOR (Fase 5.1). PURO e testável.
 * ------------------------------------------------------------------
 * Traduz jargão técnico para o vocabulário comercial. Termos técnicos
 * (nomes de tabelas/RPCs, context hash) NUNCA são exibidos ao corretor —
 * detalhes técnicos ficam apenas no painel administrativo.
 */

const DICIONARIO: Record<string, string> = {
  ingest: "Entrada de novos atendimentos",
  runner: "Análise automática da Sara",
  observer: "Sara apenas sugerindo",
  ncrm_estado: "atendimento",
  estado: "atendimento",
  checkpoint: "última atualização",
  noop: "ignorado sem alteração",
  sla: "tempo esperado de atendimento",
};

/** Termos que jamais podem aparecer na interface do corretor. */
const PROIBIDOS = [/context[_ ]?hash/i, /\bncrm_[a-z_]+/i, /\brpc\b/i, /\bsupabase\b/i];

export function termoCorretor(tecnico: string): string {
  return DICIONARIO[tecnico.trim().toLowerCase()] ?? tecnico;
}

/** true quando o texto contém jargão que não pode ser mostrado ao corretor. */
export function contemTermoTecnico(texto: string): boolean {
  return PROIBIDOS.some((re) => re.test(texto));
}

/** Rótulo do estado do piloto em linguagem do corretor. */
export function rotuloIngest(ativo: boolean | null): string {
  if (ativo == null) return "Entrada de novos atendimentos: —";
  return ativo ? "Entrada de novos atendimentos: ligada" : "Entrada de novos atendimentos: desligada";
}

export function rotuloSara(modo: string | null): string {
  if (modo === "observer") return "Sara apenas sugerindo";
  if (modo === "suggest") return "Sara sugerindo";
  if (modo === "off") return "Sara desligada";
  return "Sara: —";
}

export function rotuloRunner(ligado: boolean | null): string {
  if (ligado == null) return "Análise automática da Sara: —";
  return ligado ? "Análise automática da Sara: ligada" : "Análise automática da Sara: desligada";
}

/* ------------------------- Agrupamento do Meu dia ------------------------- */
export type GrupoMeuDia = "atenda_agora" | "faca_hoje" | "agendados" | "aguardando_cliente";

export const GRUPO_ROTULO: Record<GrupoMeuDia, string> = {
  atenda_agora: "Atenda agora",
  faca_hoje: "Faça hoje",
  agendados: "Agendados",
  aguardando_cliente: "Aguardando cliente",
};

export const GRUPO_ORDEM: GrupoMeuDia[] = ["atenda_agora", "faca_hoje", "agendados", "aguardando_cliente"];

/**
 * Classifica um item da fila em um dos 4 grupos visuais.
 *  - prioridade 1 (cliente respondeu) e 2 (lead novo) => Atenda agora
 *  - 3, 4, 5, 6 (vencidos / promessa / cadência / sem próxima ação) => Faça hoje
 *  - 7 com prazo futuro => Agendados
 *  - respondeu e sem pendência do corretor => Aguardando cliente
 */
export function grupoDoItem(item: { prioridade: number; respondeu?: boolean; proxima_acao_em?: string | null }): GrupoMeuDia {
  if (item.prioridade <= 2) return "atenda_agora";
  if (item.prioridade <= 6) return "faca_hoje";
  if (item.respondeu) return "aguardando_cliente";
  return "agendados";
}

/* ---------------- Meu Dia no celular: tres grupos, nao quatro ----------------
 *
 * O modelo interno tem quatro grupos e continua tendo — nada foi renomeado no
 * dominio. No celular, "Faca hoje" e "Agendados" respondem a mesma pergunta do
 * corretor ("o que eu combinei que ia fazer?") e quatro cabecalhos numa tela de
 * 360px viram rolagem sem ganho.
 *
 * Esta e uma camada de APRESENTACAO. Regra, prioridade e ordenacao continuam
 * vindo do banco (ncrm_fila_trabalho).
 */
export type GrupoVisivel = "atenda_agora" | "faca_combinado" | "acompanhe";

export const GRUPO_VISIVEL_ROTULO: Record<GrupoVisivel, string> = {
  atenda_agora: "Atenda agora",
  faca_combinado: "Faça o combinado",
  acompanhe: "Acompanhe",
};

export const GRUPO_VISIVEL_ORDEM: GrupoVisivel[] = ["atenda_agora", "faca_combinado", "acompanhe"];

/** Explica ao corretor por que o grupo existe. Sem jargao. */
export const GRUPO_VISIVEL_AJUDA: Record<GrupoVisivel, string> = {
  atenda_agora: "Lead novo, cliente que respondeu ou ação vencida.",
  faca_combinado: "Retornos, documentos, visitas e tarefas que você marcou.",
  acompanhe: "Ações futuras e clientes sem urgência agora.",
};

export function grupoVisivel(grupo: GrupoMeuDia): GrupoVisivel {
  if (grupo === "atenda_agora") return "atenda_agora";
  if (grupo === "aguardando_cliente") return "acompanhe";
  return "faca_combinado"; // faca_hoje + agendados
}

/* ------------- Resultados do atendimento, na lingua do corretor -------------
 *
 * O dominio separa, com razao, "resultado de tentativa de contato"
 * (ResultadoTentativa) de "resultado de acao comercial"
 * (ResultadoAcaoComercial). Para o corretor isso e uma pergunta so: "o que
 * aconteceu?". Esta tabela apresenta as duas familias juntas, SEM renomear
 * nada no dominio.
 *
 * `familia` diz para onde o registro vai. `saida` marca os dois resultados que
 * tiram o lead do quadro.
 */
export type ResultadoVisivel = {
  chave: string;
  rotulo: string;
  familia: "tentativa" | "acao_comercial";
  saida?: "pipeline_visitas" | "esteira_vendas";
};

export const RESULTADOS_VISIVEIS: readonly ResultadoVisivel[] = Object.freeze([
  { chave: "respondeu", rotulo: "Consegui falar", familia: "tentativa" },
  { chave: "nao_respondeu", rotulo: "Não respondeu", familia: "tentativa" },
  { chave: "telefone_invalido", rotulo: "Número inválido", familia: "tentativa" },
  { chave: "pediu_retorno", rotulo: "Retornar depois", familia: "tentativa" },
  { chave: "sem_interesse", rotulo: "Sem interesse", familia: "tentativa" },
  { chave: "visita_agendada", rotulo: "Visita agendada", familia: "acao_comercial", saida: "pipeline_visitas" },
  { chave: "proposta_registrada", rotulo: "Proposta realizada", familia: "acao_comercial", saida: "esteira_vendas" },
]);

/* Proposta registrada encaminha o lead para a ESTEIRA DE VENDAS — que e um
   processo comercial em andamento, nao uma venda fechada. O app nunca cria
   venda: quem fecha e o modulo de vendas, com aceite. */
export function resultadoCriaVenda(_chave: string): false {
  return false;
}
