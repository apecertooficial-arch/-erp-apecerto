export const moduleMap = {
  "Início": {
    description: "Visão geral da operação e dos principais movimentos do ERP.",
    tables: ["leads", "empreendimentos", "wa_conversas", "vendas"],
  },
  CRM: {
    description: "Leads, funis, tarefas, atividades e visitas comerciais.",
    tables: ["leads", "negocios", "pipelines", "pipeline_stages", "crm_atividades", "crm_tarefas", "visitas"],
  },
  Produtos: {
    description: "Catálogo, captação, unidades, proprietários e materiais dos imóveis.",
    tables: ["empreendimentos", "unidades", "midias", "proprietarios", "condominios"],
  },
  Performance: {
    description: "Eventos, indicadores e metas dos corretores.",
    tables: ["perf_eventos", "perf_tipos", "metas_corretor"],
  },
  Financeiro: {
    description: "Lançamentos, recebimentos, vendas e comissões.",
    tables: ["lancamentos_caixa", "recebimentos", "vendas", "comissoes"],
  },
  Abordagens: {
    description: "Modelos de abordagem cadastrados para produtos e campanhas.",
    tables: ["abordagens"],
  },
  Automações: {
    description: "Fluxos, versões e histórico de execuções automáticas.",
    tables: ["automacoes", "automacao_versoes", "automacao_execucoes", "motor_execucoes"],
  },
  Financiamento: {
    description: "Fichas de financiamento vinculadas aos atendimentos.",
    tables: ["financiamento_fichas"],
  },
  "Chat ao Vivo": {
    description: "Contatos, conversas, mensagens e eventos do WhatsApp.",
    tables: ["wa_contatos", "wa_conversas", "wa_mensagens", "wa_eventos"],
  },
  Disparos: {
    description: "Abordagens, filas, agendamentos e cadência de mensagens.",
    tables: ["abordagens", "wa_automacao_fila", "motor_fila", "mensagens_agendadas"],
  },
  Calendário: {
    description: "Tarefas e visitas que alimentam a agenda da equipe.",
    tables: ["crm_tarefas", "visitas"],
  },
  "Agentes de IA": {
    description: "Execuções e sinais registrados pelo motor de automação.",
    tables: ["motor_execucoes", "motor_flags"],
  },
  Usuários: {
    description: "Usuários, corretores, presença e associação de instâncias.",
    tables: ["usuarios", "corretores", "corretor_instancias", "corretor_presencas"],
  },
  Notificações: {
    description: "Mensagens agendadas e eventos que podem gerar alertas.",
    tables: ["mensagens_agendadas", "wa_eventos"],
  },
  "Base de conhecimento": {
    description: "Conteúdo de apoio ainda armazenado localmente no HTML legado.",
    tables: [],
    gap: "Ainda não existe uma tabela correspondente no Supabase. Essa migração precisa ser projetada antes de ativar a função.",
  },
  Auditoria: {
    description: "Rastros operacionais disponíveis para auditoria técnica.",
    tables: ["wa_eventos", "perf_eventos", "motor_execucoes"],
  },
  Configurações: {
    description: "Preferências, regras comerciais e parâmetros da operação.",
    tables: ["escritorio_config", "sla_regras", "config_financeiro"],
  },
  Ajuda: {
    description: "Tutoriais e orientações de uso preservados do ERP original.",
    tables: [],
    gap: "O conteúdo de ajuda continua local, como no HTML final, até a base de conhecimento ser migrada.",
  },
} as const;

export type ModuleName = keyof typeof moduleMap;

export function isModuleName(value: string): value is ModuleName {
  return value in moduleMap;
}

export function humanizeTableName(value: string) {
  return value
    .replace(/^wa_/, "WhatsApp · ")
    .replace(/^crm_/, "CRM · ")
    .replace(/^perf_/, "Performance · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
