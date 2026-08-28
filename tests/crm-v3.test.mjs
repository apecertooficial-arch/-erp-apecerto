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
const pwa = read("../app/components/RegistroPwa.tsx");
const identityCss = read("../app/styles/redesign-apecerto.css");

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

test("o Funil permanece dentro do shell global do ERP sem shell interno duplicado", () => {
  assert.doesNotMatch(shell, /if \(moduloAtual === "CRM"\)[\s\S]*funil-product-shell/);
  assert.match(shell, /return \([\s\S]*<AppShell/);
  assert.match(workspace, /className="f2-root funil-oficial"/);
  assert.match(mobile, /modo-\$\{modo\} funil-oficial/);
});

test("cartão inteiro abre a ficha correta por mouse e teclado", () => {
  assert.match(workspace, /className=\{`f2-card[\s\S]*onClick=\{\(\) => \{ if \(modoSelecao\) alternarSelecao\(item\.id\); else setSelecionado\(item\.id\); \}\}/);
  assert.match(workspace, /if \(e\.key === "Enter" \|\| e\.key === " "\)[\s\S]*setSelecionado\(item\.id\)/);
  assert.match(workspace, /lead=\{lead\}[\s\S]*onFechar=\{\(\) => \{ setSelecionado\(null\)/);
  assert.match(mobile, /onAbrir=\{\(\) => \{ setAbrirNoChat\(false\); setSelecionado\(lead\.id\); \}\}/);
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

test("ficha desktop replica a arquitetura ampla e compacta aprovada no Claude Design", () => {
  assert.match(workspace, /className="f2-ficha-identidade"/);
  assert.match(workspace, /className="f2-ficha-acoes-topo"/);
  assert.match(workspace, /className="[^"]*f2-ficha-proxima-faixa/);
  assert.match(workspace, /className="f2-ficha-grade"/);
  assert.match(workspace, /className="f2-ficha-contexto"/);
  assert.match(workspace, /className="f2-ficha-painel"/);
  assert.match(workspace, /Classificação do atendimento/);
  assert.match(workspace, /Abrir conversa completa/);
  assert.match(workspace, /Comentários e notas/);
  assert.match(css, /\.funil-oficial \.f2-detalhe\{width:min\(64vw,1040px\);min-width:640px/);
  assert.match(css, /\.funil-oficial \.f2-ficha-grade\{[^}]*grid-template-columns:minmax\(220px,32%\) minmax\(0,1fr\)/);
  assert.match(css, /\.funil-oficial \.f2-detalhe-abas\{[^}]*border-bottom:1px solid/);
  assert.match(pwa, /className="erp-update-toast"/);
  assert.doesNotMatch(pwa, /left: 16, right: 16/);
  assert.match(identityCss, /body:has\(\[aria-label\^="Atendimento de"\]\) \.erp-update-toast/);
});

test("navegação aprovada existe em desktop e mobile", () => {
  for (const label of ["Meu Dia", "Negócios", "Leads", "Atividades", "Visitas", "Esteira", "Painel", "Configurações"]) {
    assert.match(workspace, new RegExp(`>${label}<|\\/> ${label}(?: |<)`));
  }
  assert.match(mobile, /aria-label="Navegação do Funil"/);
  for (const label of ["Meu Dia", "Funil", "Leads", "Agenda", "Visitas"]) assert.match(mobile, new RegExp(`>${label}<`));
  assert.match(workspace, /<Link href="\/agenda"><Icone nome="atividades" \/> Atividades/);
  assert.match(workspace, /href=\{`\/agenda\?lead=/);
  assert.match(mobile, /href=\{`\/agenda\?lead=/);
  assert.doesNotMatch(`${workspace}\n${mobile}`, /href=\{?`?\/tarefas(?:\?|["`])/);
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
  assert.match(workspace, />Ganhos <b>/);
  assert.match(workspace, />Perdidos <b>/);
  assert.match(workspace, />Triagem <b>/);
  assert.match(workspace, /Últimos 30 dias · movimentação/);
  assert.match(workspace, />Novo negócio<\/button>/);
  assert.match(css, /flex:0 0 304px/);
  assert.match(css, /background:var\(--ape-orange\)/);
  assert.match(css, /font-family:var\(--font-body\)/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /body:has\(\.funil-oficial\.modo-crm\) #sara-fab[^}]*display:none/);
  assert.match(css, /body:has\(\.funil-oficial\) #sara-fab[^}]*display:none/);
  assert.match(css, /body:has\(\.funil-oficial\) \.convite-instalar[^}]*display:none/);
  assert.match(css, /body:has\(\.funil-oficial \.f2-overlay\) #sara-fab[^}]*display:none/);
  assert.match(css, /\.funil-oficial\.modo-crm>\.ape-filtros button\.ativo[^}]*background:#FFF3EA[^}]*color:#B84300/);
  assert.match(workspace, />Abrir Sara<\/button>/);
  assert.match(mobile, />Sara<\/button>/);
});
