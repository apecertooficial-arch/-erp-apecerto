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
  overallPercent: 82,
  fronts: [
    { name: "CRM / Kanban", percent: 96 },
    { name: "Identidade visual (fase final)", percent: 0 },
    { name: "Meu Dia", percent: 86 },
    { name: "Agenda / visitas", percent: 96 },
    { name: "Aplicativo móvel", percent: 82 },
  ],
  weeklyUsagePercent: 77,
  weeklyUsageCeilingPercent: 90,
  currentTask: "Publicar e aceitar criação de caixa + baixa atômica do item 29",
  lastCheckpoint: "Segunda fatia do item 29 em prova: os 16 vínculos caixa/recebimento atuais são únicos, de entrada, da mesma venda e do mesmo valor. Criação de caixa + baixa agora usam uma RPC transacional e auditada, com requestId e unicidade por recebimento. Prova authenticated em rollback confirmou criação, baixa, replay idempotente e recusa de duplicidade. 1.170 testes, TypeScript, lint e build passaram.",
  lastCheckpointAt: "2026-09-23T21:13:28-03:00",
  lastCommitSent: "2ca85eb2",
  productionCommit: "2ca85eb238fd9f6d258372082671f2e667148ef4",
  latestDeliveries: [
    "PR #265 publicada: baixa e reabertura de repasse passaram a ser transacionais, idempotentes e auditadas, sem reconciliar nem alterar valores históricos.",
    "PR #264 publicada: fronteira do portal futuro ficou reproduzível e documentada, com PII fechada e nenhum código especulativo de portal ou autenticação.",
    "PR #263 publicada: só a gestão decide captações pela RPC atômica; reprovação exige motivo, aprovação publica uma vez e retries reutilizam a auditoria canônica.",
    "PR #262 publicada: captação e finalização atômicas vinculam proprietário, autoria e captador; idempotência tolera acentos, anon não executa as RPCs e a prova produtiva terminou sem resíduo.",
    "PR #261 publicada: Esteira só avança uma etapa com papel e pré-condições válidos, exige comprovações aprovadas e recusa movimento em lote; mobile e desktop aceitos sem efeito financeiro.",
    "Itens 13–18 aceitos: Sara classificou evidência sintética, aplicou ação/prazo no Meu Dia, deduplicou evento e reavaliou após ação do corretor sem executar por ele; toda fixture foi removida.",
    "PR #259 publicada: desempenho parte do último evento confirmado por visita e produção expõe período, 5/74 avaliados e fração absoluta no prazo.",
    "PR #258 publicada: os 37 cards pós-visita deixaram a ação ambígua; 4 ações comprovadas foram recuperadas e 33 históricos pedem registro humano.",
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
    "Produção possui 12 unidades captadas sem vínculo privado de proprietário; todas estão aprovadas e 11 publicadas. A correção depende de identificação humana do proprietário e não pode ser inferida automaticamente.",
    "Feedback em áudio está fail-closed: produção não tem tabela, bucket, RPC, Edge Function, cron nem segredos de transcrição; o crédito de IA retomado não substitui essa infraestrutura.",
  ],
  nextStep: "Publicar a segunda fatia do item 29, aplicar a migration e repetir a prova com rollback no build produtivo. Depois diagnosticar edição/exclusão de caixa. Não reconciliar valores nem executar baixa real. Identidade visual fica por último e exige nova conversa.",
};

if (!isProjectProgressState(PROJECT_PROGRESS)) throw new Error("Fonte de progresso inválida.");
