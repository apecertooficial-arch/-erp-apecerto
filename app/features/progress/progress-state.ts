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
  weeklyUsagePercent: 66,
  weeklyUsageCeilingPercent: 80,
  currentTask: "Fatia funcional: confirmações de escrita financeira",
  lastCheckpoint: "Baixa de parcela e edição/exclusão de caixa exigem linha confirmada; lançamento com baixa não confirmada sinaliza parcial. Deploy validado, sem mutação financeira de teste.",
  lastCheckpointAt: "2026-09-22T18:11:41-03:00",
  lastCommitSent: "d8cf4538ce65a779477f65898170c67d53c2326b",
  productionCommit: "d8cf4538ce65a779477f65898170c67d53c2326b",
  latestDeliveries: [
    "Escritas financeiras deixam de confirmar baixa, edição ou exclusão sem linha alterada; baixa parcial após caixa exige reconciliação.",
    "Carteira completa usa ordenação estável entre páginas, inclusive para 579 cards empatados sem prazo.",
    "RPC de processamento do dispatcher agora tem limite de espera e cancelamento.",
    "Telefone importado deixa de aparecer no título e nos rótulos acessíveis dos cartões.",
    "Resultado de visita só sai da fila após feedback persistido pelo corretor responsável.",
  ],
  blockers: ["Fila segue parada: erro 23505 na recuperação de lease Sara; a migração está preparada, mas não aplicada em produção.", "As 39 falhas recentes da Sara na API de IA retornaram credit_balance_exhausted; saldo da API é separado do teto de uso do Codex."],
  nextStep: "Seguir pelas fatias funcionais sem dependência da Sara; preservar o gate de schema de produção e não declarar a fila recuperada sem novos claims. Identidade visual fica para a última fase.",
};

if (!isProjectProgressState(PROJECT_PROGRESS)) throw new Error("Fonte de progresso inválida.");
