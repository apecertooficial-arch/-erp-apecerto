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
  currentTask: "Fatia funcional: prazos do Meu Dia e implantação pendente",
  lastCheckpoint: "Meu Dia desktop passou a atualizar prazos e visitas a cada minuto; 56 testes dirigidos, lint e build passaram. O commit 0508204a foi enviado ao branch remoto, mas /api/build ainda apontou 8667778d em produção: não declarar esta correção implantada.",
  lastCheckpointAt: "2026-09-22T21:19:00-03:00",
  lastCommitSent: "0508204a",
  productionCommit: "8667778de339bff41ac52adae36d1b75d7603fa7",
  latestDeliveries: [
    "Seletor de novo negócio remove opções antigas ao trocar busca e pagina nomes empatados por ID estável.",
    "CRM desktop esconde imediatamente clientes da busca antiga ao trocar o termo; reprodução em produção passou de 40 cartões obsoletos a zero.",
    "CRM móvel não oferece clientes da busca anterior sob um novo termo e limpa o estado de pesquisa ao zerar filtros.",
    "Consulta de conflitos respeita a duração padrão de uma hora quando o horário final da visita fica vazio.",
    "Agendamento sem gerente explícito usa o gerente vinculado ao corretor, igual à consulta de conflitos; produção confirmou bloqueio diante de conflito.",
  ],
  blockers: ["Fila segue parada: erro 23505 na recuperação de lease Sara; a migração está preparada, mas não aplicada em produção.", "As 39 falhas recentes da Sara na API de IA retornaram credit_balance_exhausted; saldo da API é separado do teto de uso do Codex.", "O Local digitado na visita não é persistido pela RPC canônica; corrigir exige schema de produção.", "A RPC gerente_conflitos aceita chamada autenticada direta e retorna nomes de clientes sem escopo de usuário; correção exige gate de schema de produção."],
  nextStep: "Confirmar o caminho autorizado de implantação do branch funcional antes do smoke em produção; seguir pelas falhas independentes da Sara e preservar o gate de schema. Identidade visual fica para a última fase.",
};

if (!isProjectProgressState(PROJECT_PROGRESS)) throw new Error("Fonte de progresso inválida.");
