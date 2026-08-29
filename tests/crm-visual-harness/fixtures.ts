import type {
  ArquivoVinculadoFunil2,
  AtividadeFunil2,
  CandidatoAquarioFunil2,
  EtapaConfigFunil2,
  EventoFunil2,
  ImovelVinculadoFunil2,
  LeadFunil2,
  MomentoFunil2,
  NegociacaoFunil2,
  NegocioVinculadoFunil2,
  NotaFunil2,
  TagCatalogoFunil2,
  VisitaFunil2,
} from "../../app/features/funil-2/modelo";

const base = new Date("2026-08-28T12:00:00-03:00").getTime();

export const etapas: EtapaConfigFunil2[] = [
  ["novo", "Lead novo", "Primeiro contato pendente"],
  ["tentando_contato", "Tentando contato", "Aguardando resposta"],
  ["em_atendimento", "Em atendimento", "Conversa em andamento"],
  ["visita", "Visita", "Visita marcada ou realizada"],
  ["pos_visita", "Pós-visita", "Retorno e proposta"],
  ["pescado", "Pescado", "Contato recuperado da carteira"],
  ["legado", "Leads legado", "Fora do quadro operacional"],
].map(([codigo, rotulo, ajuda], indice) => ({ codigo, rotulo, ajuda, ordem: indice + 1, ativo: true }));

export const momentos: MomentoFunil2[] = etapas.map((etapa, indice) => ({
  codigo: etapa.codigo === "novo" ? "PRIMEIRA_ABORDAGEM" : etapa.codigo === "tentando_contato" ? "CADENCIA_CONTATO" : etapa.codigo === "pescado" ? "CADENCIA_PESCADO" : `MOMENTO_${etapa.codigo.toUpperCase()}`,
  etapa: etapa.codigo,
  ordem: 1,
  rotulo: etapa.codigo === "novo" ? "Primeira abordagem" : etapa.codigo === "em_atendimento" ? "Produto enviado" : etapa.rotulo,
  descricao: etapa.ajuda,
  acao_codigo: `ACAO_${indice + 1}`,
  acao_rotulo: etapa.codigo === "novo" ? "Fazer a primeira abordagem" : etapa.codigo === "visita" ? "Confirmar a visita" : "Retomar o atendimento",
  prazo_minutos: etapa.codigo === "pescado" || etapa.codigo === "legado" ? null : 120,
  prazo_rotulo: etapa.codigo === "pescado" || etapa.codigo === "legado" ? "Sem prazo" : "2 horas",
  exige_dapi: etapa.codigo === "novo" || etapa.codigo === "tentando_contato",
  ativo: true,
}));

const etapasQuadro = etapas.filter((etapa) => etapa.codigo !== "legado").map((etapa) => etapa.codigo);
const temperaturas: LeadFunil2["temperatura"][] = ["quente", "negociando", "morno", "frio", null];

export const leads: LeadFunil2[] = etapasQuadro.flatMap((etapa, coluna) => Array.from({ length: 18 }, (_, indice) => {
  const sequencia = coluna * 18 + indice + 1;
  const momento = momentos.find((item) => item.etapa === etapa)!;
  return {
    id: `lead-teste-${String(sequencia).padStart(3, "0")}`,
    origem_negocio_id: 900000 + sequencia,
    valor: 720000 + sequencia * 5000,
    lead_id: 800000 + sequencia,
    nome: `Cliente teste ${String(sequencia).padStart(3, "0")}`,
    telefone: "+55 00 00000-0000",
    email: `cliente.${sequencia}@example.invalid`,
    cpf_cnpj: null,
    endereco: "Endereço sanitizado · Moema",
    origem_cadastro: "harness visual",
    corretor_id: 7,
    corretor_nome: "Corretor teste",
    instancia_rotulo: "Canal teste",
    instancia_telefone: null,
    instancia_status: "conectado",
    instancia_origem: "padrao",
    interesse: sequencia % 2 ? "Reserva Botânica · 2 dorms" : "Apartamento mobiliado · Moema",
    tags: [{ nome: "Origem sanitizada", cor: "var(--ape-purple)" }],
    etapa,
    momento_codigo: momento.codigo,
    temperatura: temperaturas[sequencia % temperaturas.length] ?? null,
    acao_codigo: momento.acao_codigo,
    acao_rotulo: momento.acao_rotulo,
    proxima_acao_em: new Date(base + (indice - 4) * 45 * 60 * 1000).toISOString(),
    qualidade_atendimento_nota: sequencia % 3 ? 8.4 : null,
    qualidade_atendimento_resumo: sequencia % 3 ? "Atendimento objetivo, com próximo passo confirmado." : null,
    qualidade_atendimento_em: sequencia % 3 ? new Date(base - 60 * 60 * 1000).toISOString() : null,
    cadencia_passo: indice % 3,
    ultima_interacao_em: new Date(base - 2 * 60 * 60 * 1000).toISOString(),
    ultima_acao_confirmada_em: new Date(base - 3 * 60 * 60 * 1000).toISOString(),
    ultima_acao_fonte: "humano",
    ultima_reavaliacao_sara_em: new Date(base - 60 * 60 * 1000).toISOString(),
    ultima_reavaliacao_resumo: "O cliente pediu opções compatíveis com o interesse informado.",
    corte_conversa_em: new Date(base - 7 * 24 * 60 * 60 * 1000).toISOString(),
    historico_completo: true,
    versao: 3,
    atualizado_em: new Date(base - indice * 60 * 1000).toISOString(),
    versaoDados: new Date(base - indice * 60 * 1000).toISOString(),
  } satisfies LeadFunil2;
}));

leads.push({ ...leads[0]!, id: "lead-legado-001", origem_negocio_id: 990001, lead_id: 890001, nome: "Cliente teste legado", etapa: "legado", momento_codigo: "MOMENTO_LEGADO", proxima_acao_em: "2999-12-31T23:59:59.000Z" });

const primeiro = leads[0]!;

export const eventos: EventoFunil2[] = [
  { id: 1, funil_lead_id: primeiro.id, tipo: "humano", titulo: "Atendimento iniciado", detalhe: "Registro sanitizado para validação visual.", payload: {}, criado_em: new Date(base - 4 * 60 * 60 * 1000).toISOString() },
  { id: 2, funil_lead_id: primeiro.id, tipo: "sara", titulo: "Sara reavaliou o atendimento", detalhe: "Próxima ação mantida.", payload: {}, criado_em: new Date(base - 2 * 60 * 60 * 1000).toISOString() },
];

export const notas: NotaFunil2[] = [
  { id: 1, funil_lead_id: primeiro.id, texto: "Cliente prefere visita no período da manhã.", origem: "corretor", autor_nome: "Corretor teste", criado_em: new Date(base - 90 * 60 * 1000).toISOString() },
];

export const visitas: VisitaFunil2[] = [
  { id: "visita-teste-1", funil_lead_id: primeiro.id, inicio_em: new Date(base + 2 * 60 * 60 * 1000).toISOString(), fim_em: new Date(base + 3 * 60 * 60 * 1000).toISOString(), imovel: "Produto teste · unidade 101", status: "agendada", observacao: "Encontrar na portaria.", empreendimento_id: "produto-teste", unidade: "101", com_gerente: false, atualizado_em: new Date(base).toISOString() },
];

export const atividades: AtividadeFunil2[] = [
  { id: "atividade-teste-1", funil_lead_id: primeiro.id, lead_id: primeiro.lead_id, negocio_id: primeiro.origem_negocio_id, tipo: "tarefa", titulo: "Enviar opções atualizadas", responsavel: "Corretor teste", prazo_em: new Date(base + 60 * 60 * 1000).toISOString(), status: "pendente", prioridade: "alta" },
];

export const negociacoes: NegociacaoFunil2[] = [
  { id: "negociacao-teste-1", funil_lead_id: primeiro.id, titulo: "Oportunidade sanitizada", etapa: "qualificacao", valor: 890000, observacao: null, atualizado_em: new Date(base).toISOString() },
];

export const negociosVinculados: NegocioVinculadoFunil2[] = leads.slice(0, 8).map((lead) => ({ id: lead.origem_negocio_id, funil_lead_id: lead.id, pipeline: "Comercial", etapa: lead.etapa, empreendimento_id: "produto-teste", unidade_id: "101", valor: lead.valor ?? null, status: "aberto" }));
export const imoveisVinculados: ImovelVinculadoFunil2[] = [{ negocio_id: primeiro.origem_negocio_id, funil_lead_id: primeiro.id, empreendimento_id: "produto-teste", empreendimento: "Produto teste em Moema", unidade_id: "101", unidade: "101", valor: 890000 }];
export const arquivosVinculados: ArquivoVinculadoFunil2[] = [{ id: "arquivo-teste-1", funil_lead_id: primeiro.id, negocio_id: primeiro.origem_negocio_id, nome: "proposta-sanitizada.pdf", status: "disponível", criado_em: new Date(base).toISOString() }];
export const aquario: CandidatoAquarioFunil2[] = Array.from({ length: 3 }, (_, indice) => ({ negocio_id: 990100 + indice, nome: `Candidato teste ${indice + 1}` }));
export const tagCatalogo: TagCatalogoFunil2[] = [{ id: "tag-teste", nome: "Origem sanitizada", cor: "#8B00CC" }];

export const payloadNormal = {
  leads,
  momentos,
  eventos,
  notas,
  tagCatalogo,
  etapas,
  visitas,
  atividades,
  negociacoes,
  negociosVinculados,
  imoveisVinculados,
  arquivosVinculados,
  fontes: { arquivos: "ok", conversas: "ok", instanciasPadrao: "ok", operacao: "ok", sara: "ok" },
  aquario,
  podePescar: true,
  operacao: null,
  sara: { modo: "completo", runnerAtivo: true, analisesNoLaboratorio: 0, reavaliacaoAutomaticaFunil2: true },
};

export const payloadVazio = { ...payloadNormal, leads: [], eventos: [], notas: [], visitas: [], atividades: [], negociacoes: [], negociosVinculados: [], imoveisVinculados: [], arquivosVinculados: [], aquario: [] };

export const vendasVazias = { sales: [], processes: [], deals: [], leads: [], products: [], brokers: [], stages: [], etapaDocs: [], anexos: [], users: [], history: [], verificacoes: [], solicitacoes: [], docModelo: [], condicoes: [], comissao: [], comissaoParcelas: [], observacoes: [], pipelines: [], pipelineStages: [], partes: [], anexoEventos: [] };
