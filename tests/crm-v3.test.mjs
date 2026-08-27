import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createCrmV3Fixture } from "../app/features/funil-2-v3/fixtures.ts";
import { completeActivity, completeVisit, confirmDapiAction, createDeal, createLead, feedbackPending, markLost, markWon, moveDeals, restoreDeal, saveActivity, saveVisit, saveVisitFeedback, stageSummary, summaries } from "../app/features/funil-2-v3/engine.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const route = read("../app/(erp)/crm-v3/page.tsx");
const currentRoute = read("../app/(erp)/crm/page.tsx");
const runtime = read("../app/features/system/ErpRuntime.tsx");
const shell = read("../app/features/system/ErpShell.tsx");
const routes = read("../app/features/system/erp-routes.ts");
const crmRoute = read("../app/features/funil-2-v3/CrmV3Route.tsx");
const workspace = read("../app/features/funil-2-v3/CrmV3Workspace.tsx");
const drawer = read("../app/features/funil-2-v3/CrmV3LeadDrawer.tsx");
const adapter = read("../app/features/funil-2-v3/validationAdapter.ts");
const undo = read("../app/features/funil-2-v3/useCrmV3Undo.ts");
const fixtures = read("../app/features/funil-2-v3/fixtures.ts");
const css = read("../app/styles/funil-2-v3.css");

test("CRM V3 mora em rota paralela local e /crm continua no Funil 2.0", () => {
  assert.match(route, /CRM_V3_LOCAL_VALIDATION/);
  assert.match(route, /notFound\(\)/);
  assert.match(currentRoute, /Funil2Workspace/);
  assert.match(currentRoute, /Funil2Mobile/);
  assert.doesNotMatch(currentRoute, /CrmV3/);
});

test("sessão local e remoção do shell reconhecem somente a rota exata /crm-v3", () => {
  assert.match(runtime, /pathname === "\/crm-v3"/);
  assert.doesNotMatch(runtime, /startsWith\("\/crm-v3\/"\)/);
  assert.doesNotMatch(shell, /startsWith\("\/crm-v3\/"\)/);
  assert.doesNotMatch(routes, /startsWith\("\/crm-v3\/"\)/);
  assert.match(runtime, /function CrmV3LocalRuntime/);
  assert.doesNotMatch(runtime, /CRM_V3_LOCAL_VALIDATION|searchParams|localStorage|sessionStorage|cookie|headers/);
  assert.doesNotMatch(crmRoute, /CRM_V3_LOCAL_VALIDATION|searchParams|localStorage|sessionStorage|cookie|headers/);
});

test("simulador de perfil e estado existe somente em desenvolvimento local", () => {
  assert.match(crmRoute, /localValidation=\{process\.env\.NODE_ENV === "development"\}/);
  assert.match(workspace, /localValidation && <ValidationBar/);
});

test("adaptador local é a única fronteira e não executa rede", () => {
  assert.match(adapter, /runLocalValidationMutation/);
  assert.match(adapter, /CRM_V3_EXTERNAL_MUTATIONS_BLOCKED = true/);
  assert.doesNotMatch(adapter, /fetch\(|supabase|\/api\//);
  assert.doesNotMatch(workspace, /fetch\(|supabase|Authorization|Bearer/);
});

test("mutações concorrentes usam estado atual e não atravessam contexto de validação", () => {
  assert.match(workspace, /stateRef/);
  assert.match(workspace, /mutationInFlight/);
  assert.match(workspace, /clearTimeout/);
  assert.match(workspace, /undo\.clear\(\)/);
  assert.match(workspace, /pipelineId/);
  assert.match(workspace, /selectionMode/);
});

test("fixtures não contêm contatos plausíveis ou domínios de e-mail reais", () => {
  assert.doesNotMatch(fixtures, /@email\.com/);
  assert.match(fixtures, /@fixture\.invalid/);
  assert.doesNotMatch(fixtures, /\(11\) 9[1-9]\d{3}-\d{4}/);
});

test("menu, arrasto e massa usam o mesmo motor de movimento e atualizam totais", () => {
  const base = createCrmV3Fixture();
  for (const source of ["menu", "drag", "bulk"]) {
    const before = stageSummary(base, "comercial-moema", "novo");
    const result = moveDeals(base, ["deal-rodrigo"], "comercial-moema", "em_atendimento", source);
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(stageSummary(result.state, "comercial-moema", "novo").count, before.count - 1);
    assert.equal(stageSummary(result.state, "comercial-moema", "em_atendimento").count, stageSummary(base, "comercial-moema", "em_atendimento").count + 1);
    assert.equal(summaries(result.state, "comercial-moema").value, summaries(base, "comercial-moema").value);
  }
});

test("etapa que exige atividade bloqueia e libera após criar atividade", () => {
  const base = createCrmV3Fixture();
  const blocked = moveDeals(base, ["deal-felipe"], "comercial-moema", "visita", "menu");
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "activity_required");
  const withActivity = saveActivity(base, { leadId: "lead-felipe", dealId: "deal-felipe", kind: "Ligação", title: "Confirmar visita", dueAt: "2026-08-28T10:00:00-03:00", durationMinutes: 15, owner: "Bianca Rodrigues" });
  assert.equal(moveDeals(withActivity, ["deal-felipe"], "comercial-moema", "visita", "menu").ok, true);
});

test("ganhar, perder e restaurar preservam a última posição válida", () => {
  const base = createCrmV3Fixture();
  const won = markWon(base, ["deal-rodrigo"]);
  assert.equal(won.ok, true);
  if (!won.ok) return;
  assert.equal(summaries(won.state, "comercial-moema").won, summaries(base, "comercial-moema").won + 1);
  const lost = markLost(base, ["deal-rodrigo"], "Preço acima do orçamento");
  assert.equal(lost.ok, true);
  if (!lost.ok) return;
  const restored = restoreDeal(lost.state, "deal-rodrigo");
  assert.equal(restored.ok, true);
  if (restored.ok) {
    const deal = restored.state.deals.find((item) => item.id === "deal-rodrigo");
    assert.equal(deal?.status, "open");
    assert.equal(deal?.stageId, "novo");
  }
});

test("lead e negócio são criados por fluxos separados", () => {
  const base = createCrmV3Fixture();
  const withLead = createLead(base, { name: "Lead de teste", phone: "(11) 90000-0000", email: "teste@fixture.invalid", document: "***", source: "Fixture", owner: "Bianca Rodrigues", address: "Moema", interest: "Studio", tags: [] });
  assert.equal(withLead.leads.length, base.leads.length + 1);
  assert.equal(withLead.deals.length, base.deals.length);
  const lead = withLead.leads[0];
  const withDeal = createDeal(withLead, { leadId: lead.id, title: "Negócio de teste", property: "Unidade sanitizada", value: 500000, pipelineId: "comercial-moema", stageId: "novo", temperature: null, momentCode: "PRIMEIRA_ABORDAGEM", momentLabel: "Primeira abordagem", nextAction: "WhatsApp · Primeira abordagem", dueLabel: "Vence em 5 min", dueTone: "warning", owner: lead.owner, tags: [] });
  assert.equal(withDeal.deals.length, withLead.deals.length + 1);
});

test("atividade completa e visita vinculada têm mutações reversíveis por fotografia", () => {
  const base = createCrmV3Fixture();
  const done = completeActivity(base, "activity-rodrigo");
  assert.equal(done.activities.find((item) => item.id === "activity-rodrigo")?.status, "done");
  assert.equal(base.activities.find((item) => item.id === "activity-rodrigo")?.status, "pending");
  const visit = saveVisit(base, { leadId: "lead-rodrigo", dealId: "deal-rodrigo", property: "Ed. Colibri 12 · unid. 61", owner: "Bianca Rodrigues", manager: null, startsAt: "2026-08-29T10:00:00-03:00", durationMinutes: 60, meetingPoint: "Portaria", notes: "Fixture" });
  assert.equal(visit.visits.length, base.visits.length + 1);
  assert.equal(visit.activities.length, base.activities.length + 1);
});

test("feedback sai da fila, persiste no estado e volta pela fotografia anterior", () => {
  const base = completeVisit(createCrmV3Fixture(), "visit-eduardo");
  assert.ok(feedbackPending(base).some((visit) => visit.id === "visit-eduardo"));
  const saved = saveVisitFeedback(base, "visit-eduardo", { interest: "high", liked: "Iluminação e planta", objections: "Valor do condomínio", nextStep: "Enviar proposta amanhã" });
  assert.ok(!feedbackPending(saved).some((visit) => visit.id === "visit-eduardo"));
  assert.ok(feedbackPending(base).some((visit) => visit.id === "visit-eduardo"));
});

test("D-API nunca conclui por clique sem retorno confirmado", () => {
  const base = createCrmV3Fixture();
  const result = confirmDapiAction(base, "deal-rodrigo", false);
  assert.equal(result.confirmed, false);
  assert.equal(result.state, base);
  assert.match(result.message, /clique não concluiu/i);
});

test("Desfazer dura 12 segundos ativos e pausa por hover e foco", () => {
  assert.match(undo, /CRM_V3_UNDO_ACTIVE_MS = 12_000/);
  assert.match(undo, /paused/);
  assert.match(workspace, /onMouseEnter=\{undo\.pause\}/);
  assert.match(workspace, /onFocus=\{undo\.pause\}/);
  assert.match(workspace, /onMouseLeave=\{undo\.resume\}/);
  assert.match(workspace, /onBlur=\{undo\.resume\}/);
});

test("ficha é um único diálogo com sete abas acessíveis e teclado", () => {
  for (const label of ["Atendimento", "Histórico", "Atividades", "Negócios", "Imóveis", "Arquivos", "Dados do lead"]) assert.match(drawer, new RegExp(label));
  assert.match(drawer, /role="dialog" aria-modal="true"/);
  assert.match(drawer, /role="tablist"/);
  assert.match(drawer, /ArrowRight/);
  assert.match(drawer, /event\.key === "Escape"/);
});

test("perfis, estados, mobile e identidade visual estão protegidos", () => {
  for (const value of ["normal", "loading", "empty", "error", "offline", "corretor", "gestor", "admin"]) assert.match(workspace, new RegExp(`"${value}"`));
  for (const label of ["Meu Dia", "Funil", "Leads", "Agenda", "Visitas"]) assert.match(workspace, new RegExp(label));
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /min-height:44px/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}/i);
  assert.doesNotMatch(css, /!important/);
  assert.match(css, /var\(--ape-orange\)/);
  assert.match(css, /var\(--ape-purple\)/);
  assert.match(css, /var\(--font-body\)/);
});
