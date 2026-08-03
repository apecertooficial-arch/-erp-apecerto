/**
 * Adaptador PURO ncrm_estado/evento/proposta -> LeadNova (modelo do protótipo).
 * Sem rede, sem React: recebe as linhas já lidas pela API e devolve LeadNova,
 * para reaproveitar 100% dos componentes e regras (rules.ts) com dados reais.
 */
import type {
  AcaoComercialRegistro,
  CanalContato,
  LeadNova,
  MomentoLead,
  ProximaAcaoTipo,
  ResultadoAcaoComercial,
  ResultadoTentativa,
  Tentativa,
} from "../lib/rules";

export interface EstadoRow {
  negocio_id: number;
  etapa: string;
  momento_codigo?: string | null;
  respondeu: boolean;
  resposta_pendente: boolean;
  aguardando_automacao: boolean;
  tentativas_feitas: number;
  proxima_acao_tipo: string | null;
  proxima_acao_titulo: string | null;
  proxima_acao_em: string | null;
  ultima_interacao_em: string | null;
  temperatura: string | null;
  saida: string | null;
  saida_em: string | null;
  visita_id: string | null;
  proposta_id: string | null;
  descarte_motivo: string | null;
  descarte_detalhe: string | null;
  versao: number;
  atualizado_em: string;
  msg_automatica_em: string | null;
  primeira_resposta_em: string | null;
  negocios: {
    id: number;
    status: string;
    lead_id: number;
    corretor_id: number | null;
    leads: { nome: string | null; telefone: string | null; email: string | null } | null;
    corretores: { id: number; nome: string | null } | null;
  } | null;
}

export interface EventoRow {
  id: number;
  tipo: string;
  numero_tentativa: number | null;
  canal: string | null;
  resultado: string | null;
  payload: Record<string, unknown> | null;
  origem: string;
  criado_em: string;
  estado_versao_apos: number | null;
}

export interface PropostaRow {
  id: string;
  status: string;
  valor: number;
  data_proposta: string;
  motivo_encerramento: string | null;
  criada_em: string;
}

const COLUNAS_VALIDAS = new Set(["novo", "tentando_contato", "em_atendimento", "em_acompanhamento"]);
const TEMPS = new Set(["frio", "morno", "quente", "negociando"]);

function coluna(etapa: string): LeadNova["coluna"] {
  return (COLUNAS_VALIDAS.has(etapa) ? etapa : "novo") as LeadNova["coluna"];
}
function momento(t: string | null): MomentoLead {
  return (t && TEMPS.has(t) ? t : "frio") as MomentoLead;
}

/** Board-level: sintetiza as tentativas (nao_respondeu) a partir do contador. */
export function mapEstadoToLead(row: EstadoRow): LeadNova {
  const lead = row.negocios?.leads ?? null;
  const tentativas: Tentativa[] = Array.from({ length: Math.max(0, row.tentativas_feitas) }, (_, i) => ({
    numero: i + 1,
    canal: "whatsapp" as CanalContato,
    resultado: "nao_respondeu" as ResultadoTentativa, // cadência só continua enquanto não respondeu
    em: row.ultima_interacao_em ?? row.atualizado_em,
  }));
  return {
    id: String(row.negocio_id),
    nome: lead?.nome || `Negócio ${row.negocio_id}`,
    telefone: lead?.telefone || "—",
    origem: "—",
    corretorNome: row.negocios?.corretores?.nome || "—",
    coluna: coluna(row.etapa),
    momento: momento(row.temperatura),
    criadoEm: row.msg_automatica_em ?? row.atualizado_em,
    respondeu: row.respondeu,
    respostaPendenteCorretor: row.resposta_pendente,
    ultimaInteracaoEm: row.ultima_interacao_em,
    proximaAcaoTipo: (row.proxima_acao_tipo as ProximaAcaoTipo | null) ?? null,
    proximaAcaoTitulo: row.proxima_acao_titulo,
    proximaAcaoEm: row.proxima_acao_em,
    tentativas,
    acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: row.msg_automatica_em,
    aguardandoRespostaAutomacao: row.aguardando_automacao,
    visitaAgendadaEm:
      row.momento_codigo === "VISITA_AGENDADA" && row.visita_id
        ? row.proxima_acao_em ?? row.atualizado_em
        : row.saida === "pipeline_visitas" ? row.saida_em : null,
    proposta:
      row.saida === "esteira_vendas"
        ? { produto: "—", valor: 0, data: row.saida_em ?? row.atualizado_em }
        : null,
    descartadoMotivo: row.saida === "descartado" ? row.descarte_motivo : null,
    nutricao: row.saida === "nutricao",
  };
}

/** Detalhe: substitui tentativas/ações sintetizadas pelos eventos reais. */
export function enriquecerComEventos(base: LeadNova, eventos: EventoRow[], propostas: PropostaRow[]): LeadNova {
  const tentativas: Tentativa[] = [];
  const acoes: AcaoComercialRegistro[] = [];
  let msgAuto: string | null = base.mensagemAutomaticaEnviadaEm;
  for (const e of eventos) {
    if (e.tipo === "mensagem_automatica") msgAuto = e.criado_em;
    else if (e.tipo === "tentativa") {
      tentativas.push({
        numero: e.numero_tentativa ?? tentativas.length + 1,
        canal: (e.canal as CanalContato) ?? "whatsapp",
        resultado: (e.resultado as ResultadoTentativa) ?? "nao_respondeu",
        em: e.criado_em,
        observacao: typeof e.payload?.obs === "string" ? (e.payload.obs as string) : undefined,
      });
    } else if (e.tipo === "acao_comercial") {
      acoes.push({
        seq: acoes.length + 1,
        acaoPrevista: null,
        resultado: (e.resultado as ResultadoAcaoComercial) ?? "acao_concluida",
        em: e.criado_em,
        observacao: typeof e.payload?.obs === "string" ? (e.payload.obs as string) : undefined,
      });
    }
  }
  const propViva = propostas.find((p) => ["registrada", "em_negociacao", "aceita"].includes(p.status));
  return {
    ...base,
    tentativas: tentativas.length ? tentativas : base.tentativas,
    acoesComerciais: acoes,
    mensagemAutomaticaEnviadaEm: msgAuto,
    proposta:
      base.proposta && propViva
        ? { produto: "Proposta", valor: propViva.valor, data: propViva.data_proposta }
        : base.proposta,
  };
}
