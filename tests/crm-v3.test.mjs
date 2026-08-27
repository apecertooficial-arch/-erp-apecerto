import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const route = read("../app/(erp)/crm/page.tsx");
const workspace = read("../app/features/funil-2/Funil2Workspace.tsx");
const mobile = read("../app/features/funil-2/Funil2Mobile.tsx");
const api = read("../app/api/funil2/route.ts");
const layout = read("../app/layout.tsx");
const erpLayout = read("../app/(erp)/layout.tsx");
const shell = read("../app/features/system/ErpShell.tsx");

test("/crm promove V3 por padrão e possui rollback servidor para o legado", () => {
  assert.doesNotMatch(route, /"use client"/);
  assert.match(route, /process\.env\.CRM_V3_EXPERIENCE === "legacy"/);
  assert.match(route, /<CrmEntry experience=\{experience\}/);
  assert.doesNotMatch(route, /CrmV3Route|fixture|localValidation/);
});

test("V3 oficial é uma apresentação do motor canônico, não um segundo CRM", () => {
  assert.match(workspace, /experience = "legacy"/);
  assert.match(workspace, /crm-v3-official/);
  assert.match(workspace, /fetch\("\/api\/funil2"/);
  assert.match(mobile, /experience = "legacy"/);
  assert.match(mobile, /crm-v3-official/);
  assert.match(mobile, /fetch\("\/api\/funil2"/);
});

test("autenticação, RLS e mutações continuam na API Funil 2.0", () => {
  assert.match(api, /supabase\.auth\.getUser\(token\)/);
  assert.match(api, /f2_atualizar_momento/);
  assert.match(api, /f2_confirmar_acao/);
  assert.match(api, /f2_salvar_visita/);
  assert.match(workspace, /Feedback pendente/);
  assert.match(workspace, /Registrar resultado/);
  assert.doesNotMatch(api, /CRM_V3|fixture|validationAdapter/);
});

test("laboratório local não faz parte do caminho compilado de produção", () => {
  assert.equal(existsSync(new URL("../app/(erp)/crm-v3/page.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/features/funil-2-v3/fixtures.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/features/funil-2-v3/validationAdapter.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/features/system/ErpRuntime.tsx", import.meta.url)), false);
  assert.doesNotMatch(layout, /funil-2-v3\.css/);
  assert.doesNotMatch(erpLayout, /ErpRuntime/);
  assert.doesNotMatch(shell, /crmV3Validation|\/crm-v3/);
});

test("folha oficial é isolada e o legado permanece intacto sem a classe V3", () => {
  assert.match(layout, /crm-v3-official\.css/);
  const css = read("../app/styles/crm-v3-official.css");
  assert.match(css, /^\.crm-v3-official/m);
  assert.doesNotMatch(css, /^(html|body|:root|\*)[\s,{]/m);
  assert.doesNotMatch(css, /!important/);
  assert.match(css, /@media\(max-width:720px\)/);
});

test("ficha preserva foco, prende teclado e navega abas no desktop e celular", () => {
  for (const source of [workspace, mobile]) {
    assert.match(source, /focoOrigemRef/);
    assert.match(source, /requestAnimationFrame/);
    assert.match(source, /evento\.key === "Tab"/);
    assert.match(source, /"ArrowLeft", "ArrowRight", "Home", "End"/);
    assert.match(source, /focoOrigemRef\.current\?\.focus\(\)/);
  }
});

test("V3 entrega a navegação aprovada e mantém a navegação legada separada", () => {
  assert.match(workspace, /experience === "v3" && <nav className="f2-nav f2-v3-modulos"/);
  for (const label of ["Meu Dia", "Negócios", "Leads", "Atividades", "Visitas", "Esteira", "Painel", "Configurações"]) {
    assert.match(workspace, new RegExp(`>${label}<|\\/?> ${label}(?: |<)`));
  }
  assert.match(workspace, /experience === "legacy" && <nav className="f2-nav"/);
  assert.match(workspace, /Todos os Leads/);
  assert.match(workspace, /Regras do CRM/);
});

test("menu, arrasto e massa convergem no mesmo motor canônico de movimento", () => {
  assert.match(workspace, /async function movimentar\(ids: string\[\], etapaCodigo: string\)/);
  assert.match(workspace, /action: "atualizarMomento"/);
  assert.match(workspace, /onDrop=.*movimentar\(\[id\], etapa\.codigo\)/s);
  assert.match(workspace, /movimentar\(selecionados, destinoMassa\)[^>]*>Mover selecionados/);
  assert.match(workspace, /movimentar\(\[item\.id\], destino\)[^>]*>[\s\S]*Mover para…/);
  assert.doesNotMatch(workspace, /setLeads\([^)]*etapa/);
});

test("ficha V3 possui sete áreas reais no desktop e no celular sem remover as três legadas", () => {
  const sete = ["Atendimento", "Histórico", "Atividades", "Negócios", "Imóveis", "Arquivos", "Dados do lead"];
  for (const label of sete) {
    assert.match(workspace, new RegExp(`"${label}"`));
    assert.match(mobile, new RegExp(`"${label}"`));
  }
  for (const source of [workspace, mobile]) {
    assert.match(source, /experience === "legacy"/);
    assert.match(source, /\["notas", "Notas"\]/);
  }
  assert.match(workspace, /visitas=\{visitas\.filter/);
  assert.match(mobile, /visitas=\{\(dados\?\.visitas/);
});

test("permissão real chega à Esteira e gestão não aparece para Corretor", () => {
  assert.match(workspace, /sessionRole=\{profile\.role\}/);
  assert.doesNotMatch(workspace, /sessionRole="admin"/);
  assert.match(workspace, /const podeGerir = \["admin", "gestor"\]\.includes/);
  assert.match(workspace, /\{podeGerir && <a href="\/inteligencia"/);
  assert.match(workspace, /\{podeGerir && <button[^>]+aba === "config"/);
});

test("busca, seleção e filtros V3 não simulam persistência nem sucesso", () => {
  assert.match(workspace, /type="search" value=\{buscaQuadro\}/);
  assert.match(workspace, /temperaturaQuadro === "todas"/);
  assert.match(workspace, /setSelecionados\(\[\]\); setModoSelecao\(false\)/);
  assert.match(workspace, /Nenhum sucesso foi presumido/);
  assert.doesNotMatch(workspace, /localStorage|sessionStorage|fixture|mock/i);
});

test("Design System do V3 usa tokens, colunas compactas e alvos móveis", () => {
  const css = read("../app/styles/crm-v3-official.css");
  assert.match(css, /flex:0 0 240px/);
  assert.match(css, /border:1px solid var\(--border-soft\)/);
  assert.match(css, /background:var\(--ape-orange\)/);
  assert.match(css, /font-family:var\(--font-body\)/);
  assert.match(css, /min-height:44px/);
  assert.doesNotMatch(css, /border:[2-9]px/);
});
