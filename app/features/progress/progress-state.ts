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
  overallPercent: 52,
  fronts: [
    { name: "CRM / Kanban", percent: 75 },
    { name: "Identidade visual", percent: 70 },
    { name: "Meu Dia", percent: 72 },
    { name: "Agenda / visitas", percent: 75 },
    { name: "Aplicativo móvel", percent: 70 },
  ],
  weeklyUsagePercent: 65,
  weeklyUsageCeilingPercent: 80,
  currentTask: "Prova visual do CRM e Meu Dia enviada; aguardando confirmação do deploy",
  lastCheckpoint: "Prova desktop e móvel publicada em main após testes, lint e build; aguardando confirmação em produção.",
  lastCheckpointAt: "2026-09-22T14:45:00-03:00",
  lastCommitSent: "361b5a169b361d3bf12bcac149a72982e7090df1",
  productionCommit: "aaf507d3750fad34ec963adb01d72d00f236f16a",
  latestDeliveries: [
    "Prova visual do CRM e Meu Dia consolidada no shell e nas autoridades CSS existentes.",
    "Telefone importado deixa de aparecer no título e nos rótulos acessíveis dos cartões.",
    "Painel administrativo responsivo com atualização automática e estado de desatualização.",
    "Prioridade móvel acompanha o recorte filtrado.",
  ],
  blockers: [],
  nextStep: "Confirmar a prova visual em produção e seguir pelos P0/P1 comprovados; a reformulação integral ainda não foi entregue.",
};

if (!isProjectProgressState(PROJECT_PROGRESS)) throw new Error("Fonte de progresso inválida.");
