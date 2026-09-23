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
  weeklyUsagePercent: 69,
  weeklyUsageCeilingPercent: 80,
  currentTask: "Agenda móvel: rastrear falha intermitente de carregamento e indicador de qualidade indisponível",
  lastCheckpoint: "Cobrança in-app de feedback aplicada no banco em 23/09: 64 visitas geraram 128 avisos, sem duplicatas nem push; o cron executou com sucesso às 10:50 BRT. Gestão visualizou as 64 ações no ERP móvel real. Migrações alinhadas ao histórico remoto e CI do commit 9f7444d6 passou. A PR #246 continua em rascunho; o frontend desse commit não foi implantado.",
  lastCheckpointAt: "2026-09-23T11:04:00-03:00",
  lastCommitSent: "9f7444d6",
  productionCommit: "8667778de339bff41ac52adae36d1b75d7603fa7",
  latestDeliveries: [
    "Cobrança de feedback de visita no banco: 64 visitas pendentes, 128 avisos in-app, cron a cada 10 minutos e push/WhatsApp desligados.",
    "Agenda desktop impede segundo envio de visita enquanto a primeira criação aguarda a API.",
    "Tarefas móveis e Meu Dia desktop atualizam prazos automaticamente; classificação e rótulo concordam no instante do vencimento.",
    "Busca de cliente bloqueia clique duplo em Mostrar mais, sem saltar a última página.",
    "Seletor de novo negócio remove opções antigas ao trocar busca e pagina nomes empatados por ID estável.",
    "CRM desktop esconde imediatamente clientes da busca antiga ao trocar o termo; reprodução em produção passou de 40 cartões obsoletos a zero.",
  ],
  blockers: ["Agenda móvel real falhou no primeiro carregamento e voltou a falhar após o retry; causa ainda não isolada.", "Indicador móvel de qualidade mostra baseline indisponível embora a RPC responda no banco; falta diagnosticar o contrato autenticado da API.", "O Local digitado na visita não chega à RPC canônica e o espelho sobrescreve a agenda; exige campo persistente e escrita atômica.", "Fila Sara segue parada por erro 23505 na recuperação de lease; migração preparada, não aplicada.", "A API de IA da Sara retornou credit_balance_exhausted; saldo da API é separado do teto de uso do Codex.", "A RPC gerente_conflitos retorna nomes de clientes sem escopo de usuário para chamada autenticada direta."],
  nextStep: "Corrigir e validar uma falha móvel por vez com perfil real, teste de persistência e smoke desktop. Não marcar frontend da PR #246 como implantado antes de /api/build. Identidade visual fica por último e exige conversa com o usuário.",
};

if (!isProjectProgressState(PROJECT_PROGRESS)) throw new Error("Fonte de progresso inválida.");
