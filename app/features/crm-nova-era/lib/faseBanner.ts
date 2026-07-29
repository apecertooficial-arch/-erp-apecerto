/**
 * CRM Nova Era — resumo da FASE do piloto (Fase 4; PURO e testável).
 * ------------------------------------------------------------------
 * Regras de exibição do banner de fase e da explicação do quadro vazio.
 * Sem I/O: recebe o estado já carregado e devolve textos prontos.
 */

export const TITULO_FASE = "Fase 4 — piloto funcional";

export interface EstadoPiloto {
  /** null = desconhecido (ex.: usuário sem permissão de leitura do status). */
  ingestAtivo: boolean | null;
  ativoDesde: string | null;
  saraModo: string | null;
  runnerEnabled: boolean | null;
  runnerUltimaExecucao: string | null;
  totalLeads: number;
  errosRecentes: number;
}

function fmtData(iso: string | null): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

/** Chips do banner, em ordem estável. Nunca inventa estado: desconhecido vira "—". */
export function linhasResumoFase(e: EstadoPiloto): string[] {
  const ingest = e.ingestAtivo == null ? "Ingest: —" : e.ingestAtivo ? `Ingest: ligado desde ${fmtData(e.ativoDesde)}` : "Ingest: desligado";
  const sara = `Sara: ${e.saraModo ?? "—"}${e.saraModo === "observer" ? " (só observa e sugere)" : ""}`;
  const runner = e.runnerEnabled == null ? "Runner: —" : e.runnerEnabled ? "Runner: ligado (lote máx. 3)" : "Runner: desligado";
  const leads = `Leads no piloto: ${e.totalLeads}`;
  const ult = `Última análise: ${fmtData(e.runnerUltimaExecucao)}`;
  const erros = e.errosRecentes > 0 ? `Erros recentes: ${e.errosRecentes}` : "Sem erros recentes";
  return [ingest, sara, runner, leads, ult, erros];
}

/**
 * Explicação do quadro vazio (Fase 4, item 13).
 *  - admin com ingest desligado => aponta o caminho real de ativação;
 *  - admin com ingest ligado    => aguardando primeira mensagem elegível após o corte;
 *  - demais papéis              => mensagem neutra (sem detalhes administrativos).
 */
export function mensagemQuadroVazio(p: { ingestAtivo: boolean | null; ativoDesde: string | null; souAdmin: boolean }): string {
  if (p.souAdmin && p.ingestAtivo === false) {
    return "O ingest ainda está desligado — os leads entram automaticamente após a ativação em Visão gerencial → Painel do piloto.";
  }
  if (p.souAdmin && p.ingestAtivo === true) {
    return `Ingest ativo. Aguardando a primeira mensagem elegível após o corte (${fmtData(p.ativoDesde)}). Nenhum lead antigo é migrado automaticamente.`;
  }
  return "Aguardando os primeiros leads do piloto. A carteira atual continua no CRM de produção.";
}
