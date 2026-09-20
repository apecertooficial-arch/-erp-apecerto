import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const harness = read("./crm-visual-harness/main.tsx");
const fixtures = read("./crm-visual-harness/fixtures.ts");
const vite = read("./crm-visual-harness/vite.config.mjs");
const workspace = read("../app/features/funil-2/Funil2Workspace.tsx");
const mobile = read("../app/features/funil-2/Funil2Mobile.tsx");
const funilCss = read("../app/styles/funil.css");
const conceitoCss = read("./crm-visual-harness/concept.css");
const premium = read("./crm-visual-harness/CrmPremiumConcept.tsx");
const premiumCss = read("./crm-visual-harness/premium-concept.css");
const reimaginado = read("./crm-visual-harness/CrmReimaginedConcept.tsx");
const reimaginadoCss = read("./crm-visual-harness/reimagined-concept.css");
const kanbanReimaginado = read("./crm-visual-harness/CrmKanbanReimagined.tsx");
const kanbanReimaginadoCss = read("./crm-visual-harness/kanban-reimagined.css");

test("harness renderiza a rota e o shell reais sem segunda interface", () => {
  assert.match(harness, /import PaginaCrm from "\.\.\/\.\.\/app\/\(erp\)\/crm\/page"/);
  assert.match(harness, /import \{ InicioApp \} from "\.\.\/\.\.\/app\/features\/home\/InicioApp"/);
  assert.match(harness, /import \{ ErpShell \} from "\.\.\/\.\.\/app\/features\/system\/ErpShell"/);
  assert.match(harness, /tela === "mobile-day"/);
  assert.match(harness, /<InicioApp accessToken="harness-test-only" nome=\{perfil\.name \?\? "Corretor teste"\}/);
  assert.match(harness, /<PaginaCrm \/>/);
  assert.doesNotMatch(harness, /crm-v3|iframe|dangerouslySetInnerHTML/);
  assert.match(vite, /root: aqui/);
});

test("harness exercita a cobrança real da Agenda sem dados pessoais nem mutações", () => {
  assert.match(harness, /import \{ CalendarWorkspace \}/);
  assert.match(harness, /import \{ TelaAgendaMobile \}/);
  assert.match(harness, /tela === "agenda-manager"/);
  assert.match(harness, /tela === "agenda-mobile"/);
  assert.match(harness, /url\.pathname === "\/api\/agenda"/);
  assert.match(harness, /Cliente sanitizado 1/);
  assert.doesNotMatch(harness, /@gmail\.|@hotmail\.|\+55 1[1-9]/);
});

test("harness exercita cobertura parcial e reincidência na tela real de Avisos", () => {
  assert.match(harness, /import \{ NotificationsWorkspace \}/);
  assert.match(harness, /tela === "notifications"/);
  assert.match(harness, /url\.pathname === "\/api\/notificacoes"/);
  assert.match(harness, /cobertura: \{ status: "parcial", exibidos: 7, total: 148 \}/);
  assert.match(harness, /reaberturas: 37/);
  assert.match(harness, /tipo: "canal_indisponivel", prioridade: 1/);
  assert.match(harness, /tipo: "lead_em_atendimento", prioridade: 2/);
  assert.match(harness, /tipo: "lead_quente", prioridade: 1/);
  assert.match(harness, /tipo: "visita_feedback_pendente", prioridade: 2/);
  assert.match(harness, /tipo: "presenca_pendente", prioridade: 1/);
  assert.match(harness, /dataset\.lastNotificationNavigation = href/);
});

test("conceito visual e isolado, responsivo e sem recursos externos", () => {
  assert.match(harness, /import "\.\/concept\.css"/);
  assert.match(harness, /dataset\.crmConcept = "apecerto-2026"/);
  assert.match(conceitoCss, /html\[data-crm-concept="apecerto-2026"\]/);
  assert.match(conceitoCss, /@media\s*\(max-width:\s*900px\)/);
  assert.match(conceitoCss, /--concept-orange:/);
  assert.match(conceitoCss, /--concept-purple:/);
  assert.doesNotMatch(conceitoCss, /url\(|@import|https?:\/\//);
});

test("Meu Dia usa uma amostra curta e priorizada sem alterar o quadro desktop", () => {
  assert.match(harness, /const indicesMeuDia = \[0, 1, 18, 19, 36, 37, 54, 55, 72, 90\]/);
  assert.match(harness, /const payloadMeuDia = \{[\s\S]*leads: leadsMeuDia/);
  assert.match(harness, /tela === "mobile-day" \? \{ \.\.\.payloadMeuDia, descarteAprovacao: payloadFunil\.descarteAprovacao \} : payloadFunil/);
});

test("segunda proposta e um CRM premium completo, interativo e isolado", () => {
  assert.match(harness, /import \{ CrmPremiumConcept \} from "\.\/CrmPremiumConcept"/);
  assert.match(harness, /tela === "premium-crm" \? <CrmPremiumConcept \/>/);
  assert.match(premium, /Central comercial/);
  assert.match(premium, /VISITAS SEM FEEDBACK/);
  assert.match(premium, /Leitura da Sara/);
  assert.match(premium, /QUALIDADE DO ATENDIMENTO/);
  assert.match(premium, /setSelecionado/);
  assert.match(premiumCss, /\.premium-crm-shell/);
  assert.match(premiumCss, /grid-template-columns:\s*72px minmax\(0,1fr\) 370px/);
  assert.doesNotMatch(`${premium}\n${premiumCss}`, /https?:\/\/|example\.com|gmail\.com/);
});

test("V3 acrescenta vida com movimento funcional e respeita reducao de animacao", () => {
  assert.match(premium, /useEffect/);
  assert.match(premium, /commandOpen/);
  assert.match(premium, /Operação ao vivo/);
  assert.match(premium, /aria-label="Busca global"/);
  assert.match(premiumCss, /@keyframes premiumPulse/);
  assert.match(premiumCss, /@keyframes premiumSweep/);
  assert.match(premiumCss, /prefers-reduced-motion:\s*reduce/);
});

test("V4 abandona o kanban como centro e cria uma central de foco operacional", () => {
  assert.match(harness, /import \{ CrmReimaginedConcept \} from "\.\/CrmReimaginedConcept"/);
  assert.match(harness, /tela === "reimagined-crm" \? <CrmReimaginedConcept \/>/);
  assert.match(reimaginado, /Central de foco/);
  assert.match(reimaginado, /Pulso da operação/);
  assert.match(reimaginado, /Jornada comercial/);
  assert.match(reimaginado, /Resumo da Sara/);
  assert.match(reimaginado, /setSelecionado/);
  assert.match(reimaginadoCss, /\.reimagined-shell/);
  assert.match(reimaginadoCss, /@keyframes reimaginedPulse/);
  assert.match(reimaginadoCss, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(`${reimaginado}\n${reimaginadoCss}`, /premium-column|premium-detail|grid-template-columns:\s*repeat\(4/);
});

test("Kanban reimaginado preserva a identidade V4 e usa KPIs acionaveis", () => {
  assert.match(harness, /import \{ CrmKanbanReimagined \} from "\.\/CrmKanbanReimagined"/);
  assert.match(harness, /tela === "reimagined-kanban" \? <CrmKanbanReimagined \/>/);
  assert.match(kanbanReimaginado, /Jornada comercial/);
  assert.match(kanbanReimaginado, /PIPELINE ATIVO/);
  assert.match(kanbanReimaginado, /Saúde do funil/);
  assert.match(kanbanReimaginado, /PRÓXIMA AÇÃO/);
  assert.match(kanbanReimaginado, /setSelecionado/);
  assert.match(kanbanReimaginadoCss, /\.kanban-stage-grid/);
  assert.match(kanbanReimaginadoCss, /@keyframes kanbanSpark/);
  assert.match(kanbanReimaginadoCss, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(`${kanbanReimaginado}\n${kanbanReimaginadoCss}`, /https?:\/\/|example\.com|gmail\.com/);
});

test("interceptador sintético permite somente GETs locais inventariados", () => {
  assert.match(harness, /if \(method !== "GET"\)/);
  assert.match(harness, /url\.origin !== window\.location\.origin/);
  for (const rota of ["/api/funil2", "/api/funil2/conversa", "/api/funil2/carteira", "/api/crm/sales", "/api/agenda", "/api/notificacoes"]) {
    assert.match(harness, new RegExp(rota.replaceAll("/", "\\/")));
  }
  assert.match(harness, /Harness visual: mutações são bloqueadas/);
  assert.match(harness, /Harness visual: domínio externo bloqueado/);
});

test("fixtures são sanitizadas, tipadas e exercitam limite incremental", () => {
  assert.match(fixtures, /Array\.from\(\{ length: 18 \}/);
  assert.match(fixtures, /satisfies LeadFunil2/);
  assert.match(fixtures, /example\.invalid/);
  assert.match(fixtures, /Endereço sanitizado/);
  assert.doesNotMatch(fixtures, /@gmail\.|@hotmail\.|\+55 1[1-9]/);
});

test("roles e estados visuais são parametrizados somente no runner", () => {
  assert.match(harness, /type Papel = "admin" \| "gestor" \| "corretor"/);
  assert.match(harness, /type Estado = "normal" \| "loading" \| "vazio" \| "erro" \| "offline" \| "negado"/);
  assert.match(harness, /dataset\.crmHarness = "visual-sintetico"/);
  assert.doesNotMatch(`${workspace}\n${mobile}`, /crmHarness|harness-test-only|visual-sintetico/);
});

test("offline não gera rejeição solta nem mantém mutações disponíveis", () => {
  assert.match(workspace, /try \{[\s\S]*await fetch\("\/api\/funil2"[\s\S]*catch \{/);
  assert.match(workspace, /Sem conexão — nenhum dado em cache está disponível/);
  assert.match(workspace, /!carregando && !erro && aba === "quadro"/);
  // App mobile restaurado para a versão anterior ao CRM V3 (revert 90b5bd8a / 29fc970d): contrato mantido só no desktop.
});

test("Funil móvel remove junto o cabeçalho global oculto e o espaço reservado", () => {
  assert.match(funilCss, /\.app-shell:has\(\.funil-oficial\.modo-crm\) \.app-mobile-top\{display:none\}/);
  assert.match(funilCss, /\.app-shell:has\(\.funil-oficial\.modo-crm\) \.workspace\{padding-top:0\}/);
});
