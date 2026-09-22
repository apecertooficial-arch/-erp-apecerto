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
  weeklyUsagePercent: 65,
  weeklyUsageCeilingPercent: 80,
  currentTask: "Prioridade funcional: captação e distribuição de leads, CRM e Meu Dia",
  lastCheckpoint: "Usuário rejeitou a prova visual; identidade fica para a última fase. Execução volta às funções observáveis.",
  lastCheckpointAt: "2026-09-22T16:51:46-03:00",
  lastCommitSent: "5840dfc0928a79e7cb44e18ea920c00ebcacdcf6",
  productionCommit: "5840dfc0928a79e7cb44e18ea920c00ebcacdcf6",
  latestDeliveries: [
    "Telefone importado deixa de aparecer no título e nos rótulos acessíveis dos cartões.",
    "Resultado de visita só sai da fila após feedback persistido pelo corretor responsável.",
    "Painel administrativo responsivo com atualização automática e estado de desatualização.",
    "Prioridade móvel acompanha o recorte filtrado.",
  ],
  blockers: [],
  nextStep: "Reproduzir a captação e a distribuição de um lead até aparecer na carteira e no Meu Dia; corrigir a primeira falha funcional comprovada. Identidade visual só na última fase, após nova conversa.",
};

if (!isProjectProgressState(PROJECT_PROGRESS)) throw new Error("Fonte de progresso inválida.");
