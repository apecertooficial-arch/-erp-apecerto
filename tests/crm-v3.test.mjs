import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const route = read("../app/(erp)/crm/page.tsx");
const entry = read("../app/features/funil-2/FunilEntry.tsx");
const workspace = read("../app/features/funil-2/Funil2Workspace.tsx");
const mobile = read("../app/features/funil-2/Funil2Mobile.tsx");
const api = read("../app/api/funil2/route.ts");
const layout = read("../app/layout.tsx");
const erpLayout = read("../app/(erp)/layout.tsx");
const shell = read("../app/features/system/ErpShell.tsx");
const routes = read("../app/features/system/erp-routes.ts");
const render = read("../render.yaml");
const css = read("../app/styles/funil.css");

test("/crm possui uma única entrada oficial chamada Funil", () => {
  assert.doesNotMatch(route, /"use client"/);
  assert.match(route, /<FunilEntry/);
  assert.doesNotMatch(`${route}\n${entry}`, /CRM_V3_EXPERIENCE|CrmEntry|experience=|legacy|CrmV3Route|fixture|localValidation/);
  assert.doesNotMatch(render, /CRM_V3_EXPERIENCE/);
  assert.match(routes, /CRM: \{[^\n]+rotuloCurto: "Funil"/);
});

test("o Funil oficial reutiliza sessão, autorização e motor canônico", () => {
  assert.match(entry, /GuardaModulo modulo="CRM"/);
  assert.match(entry, /useErpSession/);
  assert.match(entry, /<Funil2Workspace/);
  assert.match(entry, /<Funil2Mobile/);
  assert.match(workspace, /fetch\("\/api\/funil2"/);
  assert.match(mobile, /fetch\("\/api\/funil2"/);
  assert.doesNotMatch(`${workspace}\n${mobile}`, /localStorage|sessionStorage|fixture|validationAdapter|mock/i);
});

test("autenticação, RLS e mutações continuam na API canônica", () => {
  assert.match(api, /supabase\.auth\.getUser\(token\)/);
  assert.match(api, /f2_atualizar_momento/);
  assert.match(api, /f2_confirmar_acao/);
  assert.match(api, /f2_salvar_visita/);
  assert.match(api, /select\("id,lead_id,valor"\)/);
  assert.match(workspace, /Feedback pendente/);
  assert.match(workspace, /Registrar resultado/);
  assert.doesNotMatch(api, /CRM_V3|fixture|validationAdapter/);
});

test("laboratório e rota paralela não fazem parte da produção", () => {
  assert.equal(existsSync(new URL("../app/(erp)/crm-v3/page.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/features/funil-2-v3/fixtures.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/features/funil-2-v3/validationAdapter.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/features/system/ErpRuntime.tsx", import.meta.url)), false);
  assert.doesNotMatch(layout, /funil-2-v3|crm-v3-official/);
  assert.doesNotMatch(erpLayout, /ErpRuntime/);
  assert.doesNotMatch(shell, /crmV3Validation|\/crm-v3/);
});

test("a apresentação do Funil é uma folha única, sem camada visual antiga", () => {
  assert.match(layout, /styles\/funil\.css/);
  assert.equal(existsSync(new URL("../app/styles/funil-2.css", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/styles/crm-v3-official.css", import.meta.url)), false);
  assert.match(css, /\.funil-oficial/);
  assert.doesNotMatch(css, /\.crm-v3-official|CRM_V3_EXPERIENCE/);
  assert.doesNotMatch(css, /!important/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
});

test("o shell antigo não é montado junto com o Funil", () => {
  assert.match(shell, /if \(moduloAtual === "CRM"\)/);
  assert.match(shell, /return <div className="funil-product-shell">\{children\}<\/div>/);
  assert.match(workspace, /className="f2-root funil-oficial"/);
  assert.match(mobile, /modo-\$\{modo\} funil-oficial/);
});

test("ficha preserva foco, prende teclado e navega sete abas", () => {
  const sete = ["Atendimento", "Histórico", "Atividades", "Negócios", "Imóveis", "Arquivos", "Dados do lead"];
  for (const source of [workspace, mobile]) {
    assert.match(source, /focoOrigemRef/);
    assert.match(source, /requestAnimationFrame/);
    assert.match(source, /evento\.key === "Tab"/);
    assert.match(source, /"ArrowLeft", "ArrowRight", "Home", "End"/);
    assert.match(source, /focoOrigemRef\.current\?\.focus\(\)/);
    for (const label of sete) assert.match(source, new RegExp(`"${label}"`));
    assert.doesNotMatch(source, /experience ===|\["notas", "Notas"\]/);
  }
});

test("navegação aprovada existe em desktop e mobile", () => {
  for (const label of ["Meu Dia", "Negócios", "Leads", "Atividades", "Visitas", "Esteira", "Painel", "Configurações"]) {
    assert.match(workspace, new RegExp(`>${label}<|\\/> ${label}(?: |<)`));
  }
  assert.match(mobile, /aria-label="Navegação do Funil"/);
  for (const label of ["Meu Dia", "Funil", "Leads", "Agenda", "Visitas"]) assert.match(mobile, new RegExp(`>${label}<`));
});

test("menu, arrasto e massa convergem no mesmo motor canônico", () => {
  assert.match(workspace, /async function movimentar\(ids: string\[\], etapaCodigo: string\)/);
  assert.match(workspace, /action: "atualizarMomento"/);
  assert.match(workspace, /onDrop=.*movimentar\(\[id\], etapa\.codigo\)/s);
  assert.match(workspace, /movimentar\(selecionados, destinoMassa\)[^>]*>Mover selecionados/);
  assert.match(workspace, /movimentar\(\[item\.id\], destino\)[^>]*>[\s\S]*Escolha a etapa/);
  assert.doesNotMatch(workspace, /setLeads\([^)]*etapa/);
});

test("perfis, filtros e Design System permanecem explícitos", () => {
  assert.match(workspace, /sessionRole=\{profile\.role\}/);
  assert.match(workspace, /const podeGerir = \["admin", "gestor"\]\.includes/);
  assert.match(workspace, /type="search" value=\{buscaQuadro\}/);
  assert.match(workspace, /temperaturaQuadro === "todas"/);
  assert.match(workspace, /Nenhum sucesso foi presumido/);
  assert.match(css, /flex:0 0 240px/);
  assert.match(css, /background:var\(--ape-orange\)/);
  assert.match(css, /font-family:var\(--font-body\)/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /body:has\(\.funil-oficial\.modo-crm\) #sara-fab\{bottom:calc\(134px/);
});
