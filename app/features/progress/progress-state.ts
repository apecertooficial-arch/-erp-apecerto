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
  weeklyUsagePercent: 67,
  weeklyUsageCeilingPercent: 80,
  currentTask: "Fatia funcional: busca da carteira antiga no CRM móvel",
  lastCheckpoint: "Busca móvel limpa resultados anteriores ao mudar o termo, ignora resposta abortada e encerra loading ao limpar filtros. Build 5dbc3e30 publicado; navegador móvel confirmou cartões antigos ocultos, sem alerta ou overflow.",
  lastCheckpointAt: "2026-09-22T20:54:00-03:00",
  lastCommitSent: "5dbc3e30b7be080235fb69d1e0730af751e94a6f",
  productionCommit: "5dbc3e30b7be080235fb69d1e0730af751e94a6f",
  latestDeliveries: [
    "CRM móvel não oferece clientes da busca anterior sob um novo termo e limpa o estado de pesquisa ao zerar filtros.",
    "Consulta de conflitos respeita a duração padrão de uma hora quando o horário final da visita fica vazio.",
    "Agendamento sem gerente explícito usa o gerente vinculado ao corretor, igual à consulta de conflitos; produção confirmou bloqueio diante de conflito.",
    "Testes móveis/PWA preservam rascunhos mesmo quando a aba está oculta; 89 verificações direcionadas passaram.",
    "Chat consulta disponibilidade do gerente com PATCH, método aceito pela Agenda; falhas da RPC deixam de significar ausência de conflitos.",
  ],
  blockers: ["Fila segue parada: erro 23505 na recuperação de lease Sara; a migração está preparada, mas não aplicada em produção.", "As 39 falhas recentes da Sara na API de IA retornaram credit_balance_exhausted; saldo da API é separado do teto de uso do Codex.", "O Local digitado na visita não é persistido pela RPC canônica; corrigir exige schema de produção.", "A RPC gerente_conflitos aceita chamada autenticada direta e retorna nomes de clientes sem escopo de usuário; correção exige gate de schema de produção."],
  nextStep: "Seguir pelas fatias funcionais sem dependência da Sara; preservar o gate de schema de produção e não declarar a fila recuperada sem novos claims. Identidade visual fica para a última fase.",
};

if (!isProjectProgressState(PROJECT_PROGRESS)) throw new Error("Fonte de progresso inválida.");
