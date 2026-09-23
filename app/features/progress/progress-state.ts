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
  weeklyUsagePercent: 71,
  weeklyUsageCeilingPercent: 90,
  currentTask: "Proteção do dono: considerar somente visita ou negociação ativas",
  lastCheckpoint: "Em 23/09, a PR #251 entrou em produção no hash b560fff: mobile e desktop agora distinguem Aceites D-API da confirmação messages.sent. No recorte seguinte, uma consulta agregada encontrou cinco cards bloqueados apenas por visita encerrada; a correção transacional com rollback libera esses históricos e preserva visita/negociação ativas.",
  lastCheckpointAt: "2026-09-23T13:56:00-03:00",
  lastCommitSent: "b560fff8",
  productionCommit: "b560fff861ac0046433c1d95e01e25395d62d524",
  latestDeliveries: [
    "PR #251 publicada: contador e logs da primeira abordagem dizem Aceites D-API no mobile e desktop, sem alterar o envio.",
    "Entrada Autoral comprovada ponta a ponta com evento real recente: distribuição, card ativo, dono consistente, Meu Dia e abordagem entregue.",
    "Fila Sara voltou a escoar: zero itens vencidos e zero leases expirados na última consulta; 159 itens concluídos após a migração.",
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
  blockers: ["Duas tentativas de IA falharam com AI_UNAVAILABLE após a retomada; a API já havia retornado credit_balance_exhausted e seu saldo é separado do teto de uso do Codex."],
  nextStep: "Publicar a proteção do dono pelo estado atual, validar a migração e o construtor em produção e então avançar para transferências auditáveis. Não reprocessar cards descartados. Identidade visual fica por último e exige conversa com o usuário.",
};

if (!isProjectProgressState(PROJECT_PROGRESS)) throw new Error("Fonte de progresso inválida.");
