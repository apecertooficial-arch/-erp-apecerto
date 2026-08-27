import type { ActivityV3, CrmV3State, DealV3, HistoryV3, LeadV3, PipelineV3, VisitV3 } from "./types";

export const CRM_V3_PIPELINES: PipelineV3[] = [
  {
    id: "comercial-moema",
    label: "Comercial · Moema",
    description: "Prontos para morar, mobiliados",
    stages: [
      { id: "novo", label: "Novo", color: "orange" },
      { id: "tentando_contato", label: "Tentando contato", color: "amber" },
      { id: "em_atendimento", label: "Em atendimento", color: "purple" },
      { id: "visita", label: "Visita", color: "blue", requiresActivity: true },
      { id: "proposta", label: "Proposta", color: "green" },
      { id: "fechamento", label: "Fechamento", color: "slate" },
    ],
  },
  {
    id: "locacao-moema",
    label: "Locação · Moema",
    description: "Carteira de locação",
    stages: [
      { id: "novo", label: "Novo", color: "orange" },
      { id: "qualificacao", label: "Qualificação", color: "amber" },
      { id: "visita", label: "Visita", color: "blue", requiresActivity: true },
      { id: "documentacao", label: "Documentação", color: "purple" },
      { id: "contrato", label: "Contrato", color: "green" },
    ],
  },
  {
    id: "triagem",
    label: "Triagem e legado",
    description: "Aquário e carteira preservada",
    stages: [
      { id: "atualizar_manual", label: "Atualizar manualmente", color: "amber" },
      { id: "pescado", label: "Pescado do Aquário", color: "purple" },
      { id: "legado", label: "Carteira legado", color: "slate" },
    ],
  },
];

const leads: LeadV3[] = [
  ["lead-rodrigo", "Rodrigo Alencar", "(11) 90000-0001", "rodrigo@fixture.invalid", "***.***.***-**", "Instagram", "Bianca Rodrigues", "Moema, São Paulo — SP", "Studio pronto para morar", ["Indicação", "studio"]],
  ["lead-camila", "Camila Ferraz", "(11) 90000-0002", "camila@fixture.invalid", "***.***.***-**", "Campanha inverno", "Bianca Rodrigues", "Vila Mariana, São Paulo — SP", "2 dormitórios mobiliado", ["Moema", "2 dorms"]],
  ["lead-juliana", "Juliana Bastos", "(11) 90000-0003", "juliana@fixture.invalid", "***.***.***-**", "Site", "Diego Martins", "Moema, São Paulo — SP", "3 dormitórios", ["Campanha inverno", "3 dorms"]],
  ["lead-vanessa", "Vanessa Kubo", "(11) 90000-0004", "vanessa@fixture.invalid", "***.***.***-**", "Portais", "Diego Martins", "Vila Mariana, São Paulo — SP", "1 dormitório", ["Sem resposta"]],
  ["lead-patricia", "Patrícia Lemos", "(11) 90000-0005", "patricia@fixture.invalid", "***.***.***-**", "Indicação", "Lívia Prado", "Vila Mariana, São Paulo — SP", "1 dormitório", ["Vila Mariana", "1 dorm"]],
  ["lead-thiago", "Thiago Nunes", "(11) 90000-0006", "thiago@fixture.invalid", "***.***.***-**", "Reengajamento", "Bianca Rodrigues", "Moema, São Paulo — SP", "2 dormitórios", ["Reengajamento"]],
  ["lead-eduardo", "Eduardo Braga", "(11) 90000-0007", "eduardo@fixture.invalid", "***.***.***-**", "Indicação", "Bianca Rodrigues", "Moema, São Paulo — SP", "Mudança em 30 dias", ["Chave na mão", "mudança 30 dias"]],
  ["lead-aline", "Aline Correia", "(11) 90000-0008", "aline@fixture.invalid", "***.***.***-**", "Site", "Diego Martins", "Moema, São Paulo — SP", "Mobiliado", ["Respondeu hoje"]],
  ["lead-renata", "Renata Salles", "(11) 90000-0009", "renata@fixture.invalid", "***.***.***-**", "Financiamento", "Lívia Prado", "Moema, São Paulo — SP", "Financiamento aprovado", ["Financiamento aprovado"]],
  ["lead-felipe", "Felipe Amaral", "(11) 90000-0010", "felipe@fixture.invalid", "***.***.***-**", "Portais", "Bianca Rodrigues", "Moema, São Paulo — SP", "Pet friendly", ["Pet friendly"]],
  ["lead-leticia", "Letícia Prado", "(11) 90000-0011", "leticia@fixture.invalid", "***.***.***-**", "Indicação", "Bianca Rodrigues", "Moema, São Paulo — SP", "Visita amanhã", ["Visita amanhã"]],
  ["lead-caio", "Caio Duarte", "(11) 90000-0012", "caio@fixture.invalid", "***.***.***-**", "Aquário", "Bianca Rodrigues", "Moema, São Paulo — SP", "Ainda não identificado", ["Aquário"]],
  ["lead-mariana", "Mariana Rocha", "(11) 90000-0013", "mariana@fixture.invalid", "***.***.***-**", "Aquário", "Bianca Rodrigues", "Moema, São Paulo — SP", "Ainda não identificado", ["Aquário", "chamado"]],
].map(([id, name, phone, email, document, source, owner, address, interest, tags]) => ({
  id: id as string,
  name: name as string,
  phone: phone as string,
  email: email as string,
  document: document as string,
  source: source as string,
  owner: owner as string,
  address: address as string,
  interest: interest as string,
  tags: tags as string[],
  createdAt: "2026-08-25T09:00:00-03:00",
}));

const deal = (value: Partial<DealV3> & Pick<DealV3, "id" | "leadId" | "title" | "property" | "value" | "stageId">): DealV3 => ({
  pipelineId: "comercial-moema",
  status: "open",
  temperature: null,
  momentCode: "PRIMEIRA_ABORDAGEM",
  momentLabel: "Primeira abordagem",
  nextAction: "WhatsApp · Primeira abordagem",
  dueLabel: "Vence em 4 min",
  dueTone: "warning",
  owner: "Bianca Rodrigues",
  tags: [],
  ...value,
});

const deals: DealV3[] = [
  deal({ id: "deal-rodrigo", leadId: "lead-rodrigo", title: "Studio Colibri", property: "Ed. Colibri 12 · unid. 61", value: 490000, stageId: "novo", tags: ["Indicação", "studio"] }),
  deal({ id: "deal-camila", leadId: "lead-camila", title: "Pavão 84", property: "Ed. Pavão 1120 · unid. 84", value: 810000, stageId: "novo", temperature: "quente", dueLabel: "Atrasado 37 min", dueTone: "danger", tags: ["Moema", "2 dorms"] }),
  deal({ id: "deal-juliana", leadId: "lead-juliana", title: "Sabiá 92", property: "Ed. Sabiá 410 · unid. 92", value: 1290000, stageId: "novo", nextAction: "Tarefa interna · Separar 3 opções", dueLabel: "Vence em 1h", tags: ["Campanha inverno", "3 dorms"] }),
  deal({ id: "deal-vanessa", leadId: "lead-vanessa", title: "Pavão 84", property: "Ed. Pavão 1120 · unid. 84", value: 640000, stageId: "tentando_contato", temperature: "frio", momentCode: "CADENCIA_SEM_RESPOSTA", momentLabel: "Cadência sem resposta", nextAction: null, dueLabel: "Definir", dueTone: "neutral", tags: ["Sem resposta"] }),
  deal({ id: "deal-patricia", leadId: "lead-patricia", title: "Canário 51", property: "Ed. Canário 77 · unid. 51", value: 545000, stageId: "tentando_contato", temperature: "frio", momentCode: "CADENCIA_SEM_RESPOSTA", momentLabel: "Cadência sem resposta", nextAction: "WhatsApp · Tentativa 5 de 6", dueLabel: "Vence em 42 min", tags: ["Vila Mariana", "1 dorm"] }),
  deal({ id: "deal-thiago", leadId: "lead-thiago", title: "Tuim 22", property: "Ed. Tuim 55 · unid. 22", value: 745000, stageId: "tentando_contato", momentCode: "CADENCIA_SEM_RESPOSTA", momentLabel: "Cadência sem resposta", nextAction: null, dueLabel: "Definir", dueTone: "neutral", tags: ["Reengajamento"] }),
  deal({ id: "deal-eduardo", leadId: "lead-eduardo", title: "Pavão 84", property: "Ed. Pavão 1120 · unid. 84", value: 830000, stageId: "em_atendimento", temperature: "quente", momentCode: "CONVERSANDO_QUALIFICANDO", momentLabel: "Conversando e qualificando", nextAction: "Ligação · Confirmar perfil", dueLabel: "Atrasado 22 min", dueTone: "danger", tags: ["Chave na mão", "mudança 30 dias"] }),
  deal({ id: "deal-aline", leadId: "lead-aline", title: "Colibri 61", property: "Ed. Colibri 12 · unid. 61", value: 490000, stageId: "em_atendimento", momentCode: "CONVERSANDO_QUALIFICANDO", momentLabel: "Conversando e qualificando", nextAction: "WhatsApp · Ler resposta e classificar", dueLabel: "Vence em 20 min", tags: ["Respondeu hoje"] }),
  deal({ id: "deal-renata", leadId: "lead-renata", title: "Sabiá 92", property: "Ed. Sabiá 410 · unid. 92", value: 1290000, stageId: "em_atendimento", temperature: "negociando", momentCode: "CONVERSANDO_QUALIFICANDO", momentLabel: "Conversando e qualificando", nextAction: "Retorno · Retornar com simulação", dueLabel: "Vence em 1h", tags: ["Financiamento aprovado"] }),
  deal({ id: "deal-felipe", leadId: "lead-felipe", title: "Jacutinga 32", property: "Ed. Jacutinga 245 · unid. 32", value: 760000, stageId: "em_atendimento", temperature: "morno", momentCode: "CONVERSANDO_QUALIFICANDO", momentLabel: "Conversando e qualificando", nextAction: null, dueLabel: "Definir", dueTone: "neutral", tags: ["Pet friendly"] }),
  deal({ id: "deal-leticia", leadId: "lead-leticia", title: "Pavão 84", property: "Ed. Pavão 1120 · unid. 84", value: 810000, stageId: "visita", temperature: "quente", momentCode: "VISITA_AGENDADA", momentLabel: "Visita agendada", nextAction: "Visita · Visita Ed. Pavão 1120", dueLabel: "Vence em 55 min", tags: ["Visita amanhã"] }),
  deal({ id: "deal-caio", leadId: "lead-caio", title: "Colibri 61", property: "Ed. Colibri 12 · unid. 61", value: 0, pipelineId: "triagem", stageId: "pescado", momentCode: "PESCADO_AQUARIO", momentLabel: "Pescado do Aquário", nextAction: "Ligação · Primeira chamada do Aquário", dueLabel: "Sem prazo", dueTone: "neutral", tags: ["Aquário"] }),
  deal({ id: "deal-mariana", leadId: "lead-mariana", title: "Canário 51", property: "Ed. Canário 77 · unid. 51", value: 0, pipelineId: "triagem", stageId: "pescado", momentCode: "PESCADO_AQUARIO", momentLabel: "Pescado do Aquário", nextAction: null, dueLabel: "Definir", dueTone: "neutral", tags: ["Aquário", "chamado"] }),
].map((item) => ({
  ...item,
  owner: leads.find((lead) => lead.id === item.leadId)?.owner ?? item.owner,
}));

const activities: ActivityV3[] = [
  { id: "activity-rodrigo", leadId: "lead-rodrigo", dealId: "deal-rodrigo", kind: "WhatsApp", title: "Primeira abordagem", dueAt: "2026-08-27T12:00:00-03:00", durationMinutes: 10, owner: "Bianca Rodrigues", status: "pending" },
  { id: "activity-leticia", leadId: "lead-leticia", dealId: "deal-leticia", kind: "Visita", title: "Visita Ed. Pavão 1120", dueAt: "2026-08-27T15:00:00-03:00", durationMinutes: 60, owner: "Bianca Rodrigues", status: "pending" },
  { id: "activity-eduardo", leadId: "lead-eduardo", dealId: "deal-eduardo", kind: "Ligação", title: "Confirmar perfil", dueAt: "2026-08-27T10:30:00-03:00", durationMinutes: 15, owner: "Bianca Rodrigues", status: "pending" },
];

const visits: VisitV3[] = [
  { id: "visit-leticia", leadId: "lead-leticia", dealId: "deal-leticia", property: "Ed. Pavão 1120 · unid. 84", owner: "Bianca Rodrigues", manager: "Diego Martins", startsAt: "2026-08-27T15:00:00-03:00", durationMinutes: 60, meetingPoint: "Portaria", notes: "Cliente chega de táxi", status: "confirmed", feedback: null },
  { id: "visit-eduardo", leadId: "lead-eduardo", dealId: "deal-eduardo", property: "Ed. Pavão 1120 · unid. 84", owner: "Bianca Rodrigues", manager: null, startsAt: "2026-08-26T11:00:00-03:00", durationMinutes: 45, meetingPoint: "Hall", notes: "Mostrar área comum", status: "completed", feedback: null },
];

const history: HistoryV3[] = [
  { id: "history-1", leadId: "lead-rodrigo", title: "Negócio criado", detail: "Studio Colibri · Comercial · Moema", actor: "human", createdAt: "2026-08-27T09:00:00-03:00" },
  { id: "history-2", leadId: "lead-rodrigo", title: "Reavaliação da Sara", detail: "Momento sugerido: conversando e qualificando.", actor: "sara", createdAt: "2026-08-27T10:45:00-03:00" },
  { id: "history-3", leadId: "lead-rodrigo", title: "Confirmação do D-API", detail: "Outbound de primeira abordagem confirmado.", actor: "dapi", createdAt: "2026-08-27T09:12:00-03:00" },
];

export function createCrmV3Fixture(): CrmV3State {
  return structuredClone({ pipelines: CRM_V3_PIPELINES, leads, deals, activities, visits, history });
}
