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
  overallPercent: 63,
  fronts: [
    { name: "CRM / Kanban", percent: 84 },
    { name: "Identidade visual (fase final)", percent: 0 },
    { name: "Meu Dia", percent: 70 },
    { name: "Agenda / visitas", percent: 92 },
    { name: "Aplicativo móvel", percent: 72 },
  ],
  weeklyUsagePercent: 73,
  weeklyUsageCeilingPercent: 90,
  currentTask: "Publicar próxima ação explícita nos cards pós-visita",
  lastCheckpoint: "Item 23 reproduzido: 37 cards pós-visita usam uma ação genérica. A correção recupera 4 ações comprovadas, deixa 33 legados explicitamente pendentes de registro e preserva a frase digitada nos novos feedbacks. Prova produtiva revertida, 1.148 testes, TypeScript, lint e build passaram.",
  lastCheckpointAt: "2026-09-23T17:19:16-03:00",
  lastCommitSent: "607766a4",
  productionCommit: "607766a4228f571bc149b2d7088b1f1e86539e59",
  latestDeliveries: [
    "Item 23 preparado: próxima ação pós-visita deixa de ser categoria genérica; dados estruturados são recuperados e histórico sem fonte pede registro humano.",
    "Decisão 22 aceita: cobrança de feedback visível para corretor e gestão, idempotente e encerrada somente por resultado válido do dono; nenhum envio externo foi ativado.",
    "Decisão 21 aceita: formulário real em mobile e desktop, nota 10/10, persistência estruturada, autoria, espelho da Agenda e próxima ação em 24 h.",
    "Feedback textual estruturado provado em produção: campos versionados, nota 10/10, autoria, espelho, auditoria e atualização do card passaram com rollback confirmado.",
    "PR #257 publicada: uma visita só pode ser editada no card original; ciclo agendar, reagendar e cancelar aceito com sincronização e auditoria.",
    "PR #256 publicada: ações de criar ou mover negócio exigem funil e etapa compatíveis; referência inválida falha explicitamente e não cria lead.",
    "PR #255 publicada: todos os perfis veem o responsável nos cards do CRM; desktop e 390×844 aceitos no build 772710a.",
    "PRs #253/#254 publicadas: transferências exigem dono/escopo, aceite do destino e sincronizam negócio, lead e card; mobile mantém o atalho quando a lateral some.",
    "PR #252 publicada: proteção do dono considera somente visita ou negociação ativas; cinco históricos encerrados deixam de bloquear redistribuição autorizada.",
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
  blockers: [
    "Duas tentativas de IA falharam com AI_UNAVAILABLE após a retomada; a API já havia retornado credit_balance_exhausted e seu saldo é separado do teto de uso do Codex.",
    "Feedback em áudio está fail-closed: produção não tem tabela, bucket, RPC, Edge Function, cron nem segredos de transcrição; ativar o rascunho deixaria uploads sem processamento.",
  ],
  nextStep: "Publicar a correção do item 23, aplicar a migration, confirmar os 37 cards e aceitar a ação explícita em mobile antes do desktop. Depois avançar no item 24. Identidade visual fica por último e exige nova conversa.",
};

if (!isProjectProgressState(PROJECT_PROGRESS)) throw new Error("Fonte de progresso inválida.");
