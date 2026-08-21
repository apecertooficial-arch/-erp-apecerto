/* Espelho em código das etapas que vivem em f2_etapa_config. Hoje nada lê esta
   constante — a tela usa sempre a configuração do banco. Fica aqui como
   documentação do funil; se um dia deixar de refletir o banco, apague em vez de
   deixar mentir. */
export const ETAPAS_FUNIL2 = [
  { codigo: "novo", rotulo: "Lead novo", ajuda: "Chegou agora; primeira abordagem em até 5 minutos." },
  { codigo: "pescado", rotulo: "Pescado", ajuda: "Puxado do Aquário; sem prazo e fora do Meu Dia. Uma chamada: se responder, sai sozinho; se não, o corretor atualiza." },
  { codigo: "tentando_contato", rotulo: "Tentando contato", ajuda: "Nunca respondeu; seis tentativas em dias úteis, a última é a despedida." },
  { codigo: "em_atendimento", rotulo: "Em atendimento", ajuda: "Respondeu; qualificar e provocar a visita." },
  { codigo: "visita", rotulo: "Visita", ajuda: "Agendada, realizada ou cancelada." },
  { codigo: "atualizar_manual", rotulo: "Atualizar manualmente", ajuda: "Sem conversa para a Sara ler; o corretor classifica com o que sabe." },
] as const;

export type EtapaFunil2 = string;

export type EtapaConfigFunil2 = {
  codigo: string;
  ordem: number;
  rotulo: string;
  ajuda: string;
  ativo: boolean;
};

export type MomentoFunil2 = {
  codigo: string;
  etapa: EtapaFunil2;
  ordem: number;
  rotulo: string;
  descricao: string;
  acao_codigo: string;
  acao_rotulo: string;
  prazo_minutos: number | null;
  prazo_rotulo: string;
  exige_dapi: boolean;
  ativo?: boolean;
  /* false = momento sem cobranca: nao entra no Meu Dia, nao conta como atrasado.
     Quem decide isso e o banco (f2_momento_config.cobra_no_meu_dia); a tela le
     o efeito pelo prazo sentinela, nunca pela lista de codigos. */
  cobra_no_meu_dia?: boolean;
};

/* Produto, unidade, gerente e fim precisam viajar junto: f2_salvar_visita e um
   upsert que sobrescreve tudo, entao editar so a data apagaria o resto. */
export type VisitaFunil2 = {
  id: string;
  funil_lead_id: string;
  inicio_em: string;
  fim_em?: string | null;
  imovel: string;
  status: "agendada" | "confirmada" | "realizada" | "cancelada" | "nao_compareceu";
  observacao: string | null;
  empreendimento_id?: string | null;
  unidade?: string | null;
  com_gerente?: boolean | null;
  gerente_id?: number | null;
  feedback_em?: string | null;
  feedback_por?: string | null;
  atualizado_em: string;
};

export type NegociacaoFunil2 = {
  id: string;
  funil_lead_id: string;
  titulo: string;
  etapa: "qualificacao" | "simulacao" | "proposta" | "documentacao" | "contrato" | "venda" | "perdida";
  valor: number | null;
  observacao: string | null;
  atualizado_em: string;
};

export type CandidatoAquarioFunil2 = {
  negocio_id: number;
  nome: string;
};

export type SaraStatusFunil2 = {
  modo: string | null;
  runnerAtivo: boolean;
  analisesNoLaboratorio: number;
  reavaliacaoAutomaticaFunil2: boolean;
  loteFunil2?: number | null;
  modoExecucaoFunil2?: "canary" | "completo";
  canaryLimiteFunil2?: number | null;
};

export type OperacaoConfigFunil2 = {
  id: boolean;
  horario_inicio: string;
  horario_fim: string;
  presenca_ttl_min: number;
  primeira_abordagem_min: number;
  feedback_visita_min: number;
  notificacao_urgente_min: number;
  peso_primeira_abordagem: number;
  peso_acoes_prazo: number;
  peso_feedback_visita: number;
  peso_presenca_dapi: number;
  peso_coerencia_sara: number;
  suspensao_nivel_1_h: number;
  suspensao_nivel_2_h: number;
  suspensao_nivel_3_h: number;
};

/** Nota do atendimento, escrita pelo corretor no card. */
export type NotaFunil2 = {
  id: number;
  funil_lead_id: string;
  texto: string;
  origem: "corretor" | "gestao" | "sara";
  autor_nome: string | null;
  criado_em: string;
};

/** Por qual numero o contato esta sendo feito. Corretor com mais de uma
    instancia precisa disso para nao se perder. */
export type InstanciaDoLead = {
  rotulo: string | null;
  telefone: string | null;
  status: string | null;
};

export type TagLeadFunil2 = {
  nome: string;
  cor: string | null;
};

export type LeadFunil2 = {
  id: string;
  origem_negocio_id: number;
  /** Lead original. Usado pelo mini-chat oficial para localizar a conversa real. */
  lead_id: number;
  nome: string;
  telefone: string | null;
  corretor_id: number | null;
  corretor_nome: string | null;
  instancia_rotulo?: string | null;
  instancia_telefone?: string | null;
  instancia_status?: string | null;
  /** Interesse principal inferido somente das tags reais do lead original. */
  interesse?: string | null;
  /** Tags normalizadas do lead original (produto, anúncio, campanha e origem). */
  tags?: TagLeadFunil2[];
  etapa: EtapaFunil2;
  momento_codigo: string;
  acao_codigo: string;
  acao_rotulo: string;
  proxima_acao_em: string;
  cadencia_passo: number;
  ultima_interacao_em: string | null;
  ultima_acao_confirmada_em: string | null;
  ultima_acao_fonte: string | null;
  ultima_reavaliacao_sara_em: string | null;
  ultima_reavaliacao_resumo: string | null;
  corte_conversa_em: string;
  historico_completo: boolean;
  descartado_em?: string | null;
  descarte_motivo?: string | null;
  descarte_detalhe?: string | null;
  versao: number;
  atualizado_em: string;
};

export type EventoFunil2 = {
  id: number;
  funil_lead_id: string;
  tipo: string;
  titulo: string;
  detalhe: string | null;
  payload: Record<string, unknown>;
  criado_em: string;
};

/* A cadencia nao conta data, conta TENTATIVA. Sao 6, e o que escorrega no fim
   de semana e o dia -- nunca a tentativa. Os numeros abaixo sao os dias uteis
   de folga entre uma tentativa e a anterior; a tentativa 5 tem 2 dias porque e
   o respiro que o Romulo chamava de "o dia 5 nao existe".
   O calculo real da data mora no banco (f2_soma_dias_uteis); aqui e so rotulo. */
export const TOTAL_TENTATIVAS_CADENCIA = 6;
export const FOLGA_ENTRE_TENTATIVAS = [0, 1, 1, 1, 2, 1] as const;

export const MOMENTOS_COM_CADENCIA: Record<string, number> = {
  CADENCIA_CONTATO: 6,
  CADENCIA_SEM_RESPOSTA: 3,
  /* Pescado tem UMA tentativa, nao seis -- e nenhuma delas cobra prazo. O lead
     distribuido acabou de levantar a mao; o do Aquario nunca falou com a
     imobiliaria. Insistir seis vezes num contato frio queima o numero, e cobrar
     prazo por ele enche o Meu Dia com o que menos responde.

     O ciclo: pescou, o card espera em Pescado sem prazo; o corretor chama; se o
     cliente responder, f2_pescado_promover_respondidos leva o card para "Em
     atendimento / Conversando e qualificando" sozinho; se nao responder, fica
     em Pescado ate o corretor atualizar. Nenhuma etapa disso passa pelo Meu Dia. */
  CADENCIA_PESCADO: 1,
};

/* cadencia_passo conta quantas tentativas JA SAIRAM. A que interessa na tela e
   a proxima -- a que o corretor tem que fazer hoje. Lead recem-entrado tem
   passo 0 e precisa mostrar "Tentativa 1 de 6", nao um card mudo. */
export function tentativaAtual(lead: Pick<LeadFunil2, "momento_codigo" | "cadencia_passo">): number | null {
  const total = MOMENTOS_COM_CADENCIA[lead.momento_codigo];
  if (!total) return null;
  const proxima = (Number(lead.cadencia_passo) || 0) + 1;
  return proxima <= total ? proxima : null;
}

/** True quando a cadencia acabou e falta o corretor decidir: insistir ou descartar. */
export function aguardandoDecisao(lead: Pick<LeadFunil2, "momento_codigo" | "cadencia_passo">): boolean {
  const total = MOMENTOS_COM_CADENCIA[lead.momento_codigo];
  if (!total) return false;
  return (Number(lead.cadencia_passo) || 0) >= total;
}

export function rotuloCadencia(lead: Pick<LeadFunil2, "momento_codigo" | "cadencia_passo">): string | null {
  const total = MOMENTOS_COM_CADENCIA[lead.momento_codigo];
  if (!total) return null;
  /* No Pescado "Tentativa 1 de 1" nao informa nada, e "Decidir: insistir ou
     descartar" cobra decisao de quem so esta esperando o cliente responder. */
  if (lead.momento_codigo === "CADENCIA_PESCADO") {
    return aguardandoDecisao(lead) ? "Aguardando resposta · atualize quando decidir" : null;
  }
  if (aguardandoDecisao(lead)) return "Decidir: insistir ou descartar";
  const tentativa = tentativaAtual(lead);
  if (tentativa === null) return null;
  const despedida = lead.momento_codigo === "CADENCIA_CONTATO" && tentativa === total;
  return `Tentativa ${tentativa} de ${total}${despedida ? " · despedida" : ""}`;
}

export function acaoVisivel(lead: Pick<LeadFunil2, "momento_codigo" | "cadencia_passo" | "acao_rotulo">) {
  if (lead.momento_codigo === "CADENCIA_PESCADO") return rotuloCadencia(lead) ?? lead.acao_rotulo;
  if (aguardandoDecisao(lead)) return "Decidir: insistir mais ou descartar";
  const cadencia = rotuloCadencia(lead);
  if (cadencia) return `${lead.acao_rotulo} · ${cadencia}`;
  return lead.acao_rotulo;
}

export function prazoDaAcao(lead: Pick<LeadFunil2, "proxima_acao_em" | "momento_codigo" | "cadencia_passo" | "acao_rotulo">, agora = Date.now()) {
  const situacao = situacaoPrazo(lead.proxima_acao_em, agora);
  return { ...situacao, rotulo: `${situacao.rotulo} para ${acaoVisivel(lead).toLowerCase()}` };
}

/* SEM PRAZO.

   f2_lead.proxima_acao_em e NOT NULL e dezenas de funcoes do banco leem dela,
   entao "sem prazo" nao virou NULL: virou uma data sentinela que o banco grava
   por f2_sem_prazo(). Nenhuma comparacao de data trata esse valor como vencido,
   e checar por ele aqui, num lugar so, mantem TODA a tela coerente -- contador,
   filtro, badge e Meu Dia -- sem espalhar `momento_codigo === 'X'` pelo codigo.

   Hoje quem usa isso e o Pescado: lead do Aquario e aposta, nao obrigacao. */
const SEM_PRAZO_A_PARTIR_DE = Date.UTC(2900, 0, 1);

export function semPrazo(data: string) {
  return new Date(data).getTime() >= SEM_PRAZO_A_PARTIR_DE;
}

export function entraNoMeuDia(lead: Pick<LeadFunil2, "proxima_acao_em">, agora = Date.now()) {
  if (semPrazo(lead.proxima_acao_em)) return false;
  return new Date(lead.proxima_acao_em).getTime() <= agora + 2 * 60 * 60 * 1000;
}

/* A LISTA "LEAD NOVO" É A DE QUEM AINDA NÃO FOI CHAMADO.

   No pipe o pescado fica na coluna Pescado -- é lá que ele pertence, e é isso
   que mantém a cadência dele separada. Mas mandar o corretor abrir a coluna
   para achar quem chamar é atrito à toa: o lugar onde ele já olha primeiro é a
   lista de "leads novos" do Meu Dia. Então o pescado aparece nela ATÉ a
   primeira chamada, e some depois -- chamado, não há mais o que fazer até o
   cliente responder, e aí quem move o card é f2_pescado_promover_respondidos.

   Isto NÃO reabre a cobrança: o pescado continua sem prazo, fora de
   "atrasadas", "até 2h" e "para hoje". Ele ganha um atalho, não um relógio. */
export function esperandoPrimeiraChamada(
  lead: Pick<LeadFunil2, "etapa" | "momento_codigo" | "cadencia_passo">,
) {
  if (lead.etapa === "novo") return true;
  return lead.momento_codigo === "CADENCIA_PESCADO" && (Number(lead.cadencia_passo) || 0) === 0;
}

export function venceHoje(lead: Pick<LeadFunil2, "proxima_acao_em">, agora = Date.now()) {
  if (semPrazo(lead.proxima_acao_em)) return false;
  const limite = new Date(agora);
  limite.setHours(23, 59, 59, 999);
  return new Date(lead.proxima_acao_em).getTime() <= limite.getTime();
}

export function situacaoPrazo(data: string, agora = Date.now()) {
  if (semPrazo(data)) return { classe: "sem-prazo", rotulo: "Sem prazo" };
  const minutos = Math.round((new Date(data).getTime() - agora) / 60000);
  if (minutos < 0) return { classe: "atrasado", rotulo: `Atrasado há ${duracao(-minutos)}` };
  if (minutos <= 120) return { classe: "urgente", rotulo: `Vence em ${duracao(minutos)}` };
  return { classe: "no-prazo", rotulo: `No prazo · faltam ${duracao(minutos)}` };
}

export function duracao(minutos: number) {
  if (minutos < 60) return `${Math.max(0, minutos)} min`;
  if (minutos < 1440) return `${Math.floor(minutos / 60)}h ${minutos % 60}min`;
  return `${Math.floor(minutos / 1440)}d ${Math.floor((minutos % 1440) / 60)}h`;
}

export function dataCurta(data: string | null) {
  if (!data) return "ainda não confirmado";
  return new Date(data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
