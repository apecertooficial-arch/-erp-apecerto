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
  currentTask: "P0 funcional: dispatcher de automações com fila vencida",
  lastCheckpoint: "Logs do Render mostram erro 23505 no claim: lease Sara expirado colide com outro lote pendente do mesmo card. Correção SQL preparada, não aplicada em produção.",
  lastCheckpointAt: "2026-09-22T17:44:28-03:00",
  lastCommitSent: "cf0527a0f5f365318e2167354eb762ff9dff290d",
  productionCommit: "cf0527a0f5f365318e2167354eb762ff9dff290d",
  latestDeliveries: [
    "RPC de processamento do dispatcher agora tem limite de espera e cancelamento.",
    "Telefone importado deixa de aparecer no título e nos rótulos acessíveis dos cartões.",
    "Resultado de visita só sai da fila após feedback persistido pelo corretor responsável.",
    "Painel administrativo responsivo com atualização automática e estado de desatualização.",
    "Prioridade móvel acompanha o recorte filtrado.",
  ],
  blockers: ["Fila segue parada: erro 23505 na recuperação de lease Sara. Há 265 itens vencidos; a correção de banco ainda não foi aplicada nem validada em produção."],
  nextStep: "Validar e aplicar a migração de recuperação em janela controlada quando houver autoridade para alterar schema de produção; confirmar claims e conclusões. Depois validar captação → distribuição → carteira → Meu Dia. Identidade visual fica para a última fase.",
};

if (!isProjectProgressState(PROJECT_PROGRESS)) throw new Error("Fonte de progresso inválida.");
