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
  overallPercent: 50,
  fronts: [
    { name: "CRM / Kanban", percent: 72 },
    { name: "Identidade visual", percent: 67 },
    { name: "Meu Dia", percent: 70 },
    { name: "Agenda / visitas", percent: 75 },
    { name: "Aplicativo móvel", percent: 66 },
  ],
  weeklyUsagePercent: 64,
  weeklyUsageCeilingPercent: 70,
  currentTask: "Publicar e validar o painel administrativo de progresso",
  lastCheckpoint: "Painel /progresso implementado com fonte validada e acesso exclusivo de administrador.",
  lastCheckpointAt: "2026-09-22T12:07:03-03:00",
  lastCommitSent: "4804e6be1750b3e009a189a2f7bebdb39ff5f06e",
  productionCommit: "4804e6be1750b3e009a189a2f7bebdb39ff5f06e",
  latestDeliveries: [
    "Painel administrativo responsivo com atualização automática e estado de desatualização.",
    "Prioridade móvel acompanha o recorte filtrado.",
    "Limpeza de filtros permanece disponível com resultados parciais.",
  ],
  blockers: [],
  nextStep: "Retomar a próxima falha comprovada no CRM / Kanban após confirmar o painel em produção.",
};

if (!isProjectProgressState(PROJECT_PROGRESS)) throw new Error("Fonte de progresso inválida.");
