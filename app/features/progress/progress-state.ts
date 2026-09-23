export type ProgressFront = { name: string; percent: number };

export type ProjectProgressState = {
  version: 1;
  overallPercent: number;
  fronts: ProgressFront[];
  weeklyUsagePercent: number;
  weeklyUsageCeilingPercent: number;
  currentTask: string;
  lastCheckpoint: string;
  lastCheckpointAt: string;
  lastCommitSent: string;
  productionCommit: string;
  latestDeliveries: string[];
  blockers: string[];
  nextStep: string;
};

const percent = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100;

export function isProjectProgressState(value: unknown): value is ProjectProgressState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  const fronts = state.fronts;
  return state.version === 1
    && percent(state.overallPercent)
    && Array.isArray(fronts) && fronts.length > 0
    && fronts.every((front) => !!front && typeof front === "object" && !Array.isArray(front)
      && typeof (front as Record<string, unknown>).name === "string"
      && percent((front as Record<string, unknown>).percent))
    && percent(state.weeklyUsagePercent)
    && percent(state.weeklyUsageCeilingPercent)
    && ["currentTask", "lastCheckpoint", "lastCheckpointAt", "lastCommitSent", "productionCommit", "nextStep"].every((key) => typeof state[key] === "string" && state[key].length > 0)
    && !Number.isNaN(Date.parse(String(state.lastCheckpointAt)))
    && [state.latestDeliveries, state.blockers].every((items) => Array.isArray(items) && items.every((item) => typeof item === "string"));
}

export const PROJECT_PROGRESS: ProjectProgressState = {
  version: 1,
  overallPercent: 51,
  fronts: [
    { name: "CRM / Kanban", percent: 73 },
    { name: "Identidade visual (fase final)", percent: 0 },
    { name: "Meu Dia", percent: 70 },
    { name: "Agenda / visitas", percent: 75 },
    { name: "Aplicativo móvel", percent: 66 },
  ],
  weeklyUsagePercent: 70,
  weeklyUsageCeilingPercent: 80,
  currentTask: "Sara: investigar oito erros P0001 após a retomada da fila",
  lastCheckpoint: "Em 23/09, as PRs #246–#248 foram integradas e confirmadas em /api/build. Agenda móvel abriu com cobrança e qualidade; Local da visita persiste; conflitos de gerente não expõem clientes alheios. A migração de recuperação Sara foi aplicada no banco após ensaio com rollback: um lease foi consolidado, itens vencidos caíram de 273 para 180 e 129 processamentos terminaram com status ok na primeira janela. Oito itens ficaram em erro P0001; ainda exigem diagnóstico.",
  lastCheckpointAt: "2026-09-23T12:13:00-03:00",
  lastCommitSent: "954cefc7",
  productionCommit: "2b9fd1e542c2e1f7c1a716005eb7fe7d49776dc2",
  latestDeliveries: [
    "Recuperação de lease Sara aplicada: lote colidente fundido e dispatcher voltou a concluir itens; migração alinhada ao histórico remoto.",
    "Consulta de conflitos de gerente protege nomes, IDs de visita e corretor de carteiras alheias; teste com usuários reais simulados em transação passou.",
    "Local da visita persistido no Funil 2 e no espelho da Agenda; edição preserva ou limpa o valor na mesma transação. PR #247 publicada.",
    "Agenda móvel valida o campo meu como booleano e abriu em produção com 66 cobranças e série de qualidade. PR #246 publicada.",
    "Cobrança de feedback de visita no banco: 64 visitas pendentes, 128 avisos in-app, cron a cada 10 minutos e push/WhatsApp desligados.",
    "Agenda desktop impede segundo envio de visita enquanto a primeira criação aguarda a API.",
    "Tarefas móveis e Meu Dia desktop atualizam prazos automaticamente; classificação e rótulo concordam no instante do vencimento.",
    "Busca de cliente bloqueia clique duplo em Mostrar mais, sem saltar a última página.",
    "Seletor de novo negócio remove opções antigas ao trocar busca e pagina nomes empatados por ID estável.",
    "CRM desktop esconde imediatamente clientes da busca antiga ao trocar o termo; reprodução em produção passou de 40 cartões obsoletos a zero.",
  ],
  blockers: ["Oito itens da Sara entraram em erro P0001 após a retomada; causa ainda não classificada.", "A API de IA da Sara retornou credit_balance_exhausted; saldo da API é separado do teto de uso do Codex."],
  nextStep: "Publicar o alinhamento da migração Sara no repositório; investigar os oito erros P0001 sem expor dados de clientes. Identidade visual fica por último e exige conversa com o usuário.",
};

if (!isProjectProgressState(PROJECT_PROGRESS)) throw new Error("Fonte de progresso inválida.");
