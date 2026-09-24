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
  overallPercent: 87,
  fronts: [
    { name: "CRM / Kanban", percent: 99 },
    { name: "Identidade visual (fase final)", percent: 0 },
    { name: "Meu Dia", percent: 86 },
    { name: "Agenda / visitas", percent: 96 },
    { name: "Aplicativo móvel", percent: 82 },
  ],
  weeklyUsagePercent: 86,
  weeklyUsageCeilingPercent: 90,
  currentTask: "Concluir os aceites humanos restantes das 30 decisões, sem fabricar operação nem reconciliar legado automaticamente",
  lastCheckpoint: "PR #302 entregue no build cff6f6a7: a API Financeira deixou de transformar parcelas pendentes em recebidas somente na resposta. Produção mostra os 2 recebimentos persistidos como pendentes, com ação de baixa disponível para conferência humana; mobile e desktop passaram sem erro ou overflow e nenhum dado foi alterado.",
  lastCheckpointAt: "2026-09-24T13:48:09-03:00",
  lastCommitSent: "cff6f6a7",
  productionCommit: "cff6f6a7b5bbb6237b0769dfeb1e7b9fa8780eca",
  latestDeliveries: [
    "PR #302 publicada: o Financeiro preserva o estado persistido dos recebimentos e voltou a expor 2 parcelas pendentes de vendas pagas para conferência humana.",
    "PRs #299/#300 publicadas: tabela com RLS, bucket privado, RPCs, cron e Edge v2 do feedback em áudio estão em produção, vazios e desligados até consentimento específico para transcrição pela OpenAI.",
    "PR #297 publicada: o aviso de push não cobre mais o botão da Sara no celular; painel abriu em produção sem overflow.",
    "PRs #285–#295 publicadas: triagem, anexos, observações, decisões e exclusão da Esteira passaram a usar transações idempotentes, auditadas e retomáveis.",
    "PR #284 publicada: criar etapa passou a reservar slug e ordem e registrar auditoria numa transação idempotente; o formulário foi aceito sem criar etapa real.",
    "PR #283 publicada: reordenar etapas passou a trocar a sequência completa em uma transação auditada e idempotente; os controles foram aceitos sem mover etapa real.",
    "PR #282 publicada: revisar status de documento e registrar a trilha agora é uma transação idempotente; a aba foi aceita sem alterar o anexo real.",
    "PR #281 publicada: salvar, adicionar e remover partes da Esteira sincronizam pessoa, flag de cônjuge e auditoria numa transação idempotente; a aba foi aceita sem mutação real.",
    "PR #280 publicada: cabeçalho e parcelas da comissão da Esteira passaram a ser salvos juntos, com auditoria, retry idempotente e ordem única; a aba foi aceita sem mutação real.",
    "PR #279 publicada: devolver uma venda ao atendimento agora atualiza negócio, processo e auditoria juntos; retry é idempotente e o modal foi aceito sem executar devolução real.",
    "PR #278 publicada: criação, edição e exclusão de metas passaram a ser atômicas e auditadas, com request estável e replay seguro mesmo após apagar.",
    "PR #277 publicada: venda, negócio, processo aprovado e auditoria passaram a nascer juntos, com request idempotente e unicidade do negócio na Esteira.",
    "PR #276 publicada: categorias do caixa passaram a usar mutação atômica e auditada; Comissão Paga e Comissão Recebida são únicas e não podem ser removidas ou convertidas.",
    "PR #275 publicada: cabeçalho, linhas e auditoria do extrato passaram a entrar juntos, com fingerprint SHA-256, retry idempotente e bloqueio de sobreposição parcial.",
    "PR #274 publicada: decisão individual e aceite em lote do extrato passaram a conciliar linha, caixa e auditoria em transações idempotentes, sem estado parcial.",
    "PR #273 publicada: agenda de repasses passou a vincular comissão canônica, limitar valor e ordem, deduplicar retry e congelar os campos de linhas pagas.",
    "PR #272 publicada: comissão avulsa passou a usar RPCs atômicas e auditadas, respeita o teto da venda, deduplica retry e bloqueia qualquer linha ligada a repasse ou caixa.",
    "PR #271 publicada: criação, edição e exclusão de recebimentos pendentes passaram a ser atômicas, auditadas e idempotentes; parcela baixada exige reabertura e mantém o caixa conciliado.",
    "PR #270 publicada: exclusão de repasse valida e remove agenda e caixa numa transação auditada; retry é idempotente e vínculo divergente fica bloqueado para conferência humana.",
    "PR #269 publicada: edição de venda passou a ser transacional e idempotente, preserva o trigger canônico e recusa status ou valores incompatíveis com recebimentos, repasses e comissões.",
    "PR #268 publicada: baixa e reabertura direta de recebimento passaram a sincronizar parcela, caixa e auditoria, com retry idempotente e sem backfill do legado.",
    "PR #267 publicada: edição e exclusão de caixa passaram a ser atômicas e auditadas, sincronizam ou reabrem a parcela e bloqueiam alteração lateral de caixa derivado de repasse.",
    "PR #266 publicada: criação de caixa, baixa opcional e auditoria agora são uma transação idempotente; recebimento aceita no máximo um lançamento reconciliado.",
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
    "O Financeiro preserva 1 repasse pago com vínculo divergente, 1 total de repasses acima da comissão, 2 vendas acima da comissão bruta e 2 recebimentos pendentes de vendas pagas; a conferência exige decisão humana e nenhum valor ou vínculo foi corrigido automaticamente.",
    "Produção possui 12 unidades captadas sem vínculo privado de proprietário; todas estão aprovadas e 11 publicadas. A correção depende de identificação humana do proprietário e não pode ser inferida automaticamente.",
    "Feedback em áudio está fail-closed: a infraestrutura privada existe e está vazia, mas o envio de gravações à OpenAI exige consentimento específico antes de habilitar o cutover.",
    "Transferências voluntária, gerencial e por fit e a configuração de pipeline ainda precisam de uma operação humana real; produção não possui transferência e a única auditoria de configuração alterou somente timestamp.",
    "O aceite completo do aplicativo do corretor exige uma sessão real desse papel; nenhuma conta será personificada para fabricar a prova.",
  ],
  nextStep: "Obter consentimento específico antes de enviar áudio privado à OpenAI e coletar operações reais para os aceites de transferência, configuração e aplicativo do corretor. A gestão deve conferir o legado financeiro visível antes de qualquer baixa ou correção. Identidade visual fica por último e exige nova conversa.",
};

if (!isProjectProgressState(PROJECT_PROGRESS)) throw new Error("Fonte de progresso inválida.");
