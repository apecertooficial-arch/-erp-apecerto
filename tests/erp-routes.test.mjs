// Navegacao do ERP — regras puras de rota e exposicao de menu.
// Executar: node --test tests/erp-routes.test.mjs
// Sem rede, sem banco, sem DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { podeVer, modulosVisiveis, moduloDoPath, pathDoModulo, rotasModulo, destinoEntradaLegada } from "../app/features/system/erp-routes.ts";

const corretor = (permissoes, carregado = true, isManager = false) => ({ role: "corretor", permissoes, carregado, isManager });

test("admin enxerga todos os modulos", () => {
  const todos = Object.keys(rotasModulo);
  const vistos = modulosVisiveis({ role: "admin", permissoes: null, carregado: true });
  assert.equal(vistos.length, todos.length);
});

test("REGRESSAO fail-open: permissoes {} nao libera modulo controlado", () => {
  // Comportamento antigo do AppShell: objeto vazio caia no `return true` e
  // liberava Financeiro/Auditoria/Usuarios para corretor.
  assert.equal(podeVer("Financeiro", corretor({})), false);
  assert.equal(podeVer("Auditoria", corretor({})), false);
  assert.equal(podeVer("Usuários", corretor({})), false);
});

test("REGRESSAO fail-open: permissoes null nao libera modulo controlado", () => {
  assert.equal(podeVer("Financeiro", corretor(null)), false);
});

test("carregado=false fecha (nao pisca menu cheio durante o carregamento)", () => {
  assert.equal(podeVer("CRM", corretor({ crm: ["ver"] }, false)), false);
});

test("slug com 'ver' libera; sem 'ver' nao libera", () => {
  assert.equal(podeVer("Início", corretor({ dashboard: ["ver"] })), true);
  assert.equal(podeVer("Início", corretor({ dashboard: ["editar"] })), false);
});

test("basta UM slug da lista ter 'ver'", () => {
  // CRM aceita crm, leads ou pipeline -- sao tres nomes para a mesma area.
  // (Este teste usava Financeiro + comissoes. Estava errado: comissoes existe
  // em TODOS os perfis, entao aceitar comissoes abria o Financeiro para o
  // corretor. Descoberto na homologacao em producao.)
  assert.equal(podeVer("CRM", corretor({ leads: ["ver"] })), true);
  assert.equal(podeVer("CRM", corretor({ pipeline: ["ver"] })), true);
});

test("ver a propria comissao NAO abre o modulo Financeiro", () => {
  assert.equal(podeVer("Financeiro", corretor({ comissoes: ["ver"] })), false);
  assert.equal(podeVer("Financeiro", corretor({ vendas: ["ver"] })), false);
  assert.equal(podeVer("Financeiro", corretor({ financeiro: ["ver"] })), true);
});

test("modulo sem slug de controle fica sempre visivel", () => {
  assert.equal(podeVer("Ajuda", corretor({})), true);
  assert.equal(podeVer("Financiamento", corretor(null, false)), true);
});

test("Minha Equipe depende do papel real, nao de slug", () => {
  assert.equal(podeVer("Minha Equipe", corretor({}, true, false)), false);
  assert.equal(podeVer("Minha Equipe", corretor({}, true, true)), true);
});

test("cada modulo tem um path unico", () => {
  const paths = Object.values(rotasModulo).map((r) => r.path);
  assert.equal(new Set(paths).size, paths.length);
});

test("moduloDoPath resolve rota aninhada para o modulo base", () => {
  assert.equal(moduloDoPath("/crm"), "CRM");
  assert.equal(moduloDoPath("/crm/lead/912"), "CRM");
  assert.equal(moduloDoPath("/notificacoes"), "Notificações");
  assert.equal(moduloDoPath("/rota-que-nao-existe"), null);
});

test("pathDoModulo e moduloDoPath sao inversos", () => {
  for (const nome of Object.keys(rotasModulo)) {
    assert.equal(moduloDoPath(pathDoModulo(nome)), nome);
  }
});

// --- Guarda de fonte unica: impede o AppShell de voltar a ter tabela propria ---
test("AppShell consome podeVer e nao mantem tabela de slugs paralela", () => {
  const src = readFileSync(new URL("../app/components/AppShell.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("podeVer"), "AppShell precisa importar podeVer de erp-routes");
  assert.ok(!src.includes("permSlugs"), "AppShell nao pode ter tabela de slugs propria");
  assert.ok(!/return true; *\/\/|Object\.keys\(modulePermissions\)/.test(src), "AppShell nao pode reintroduzir o fail-open");
});

test("ErpShell e AppShell leem a MESMA fonte de rotas", () => {
  const shell = readFileSync(new URL("../app/features/system/ErpShell.tsx", import.meta.url), "utf8");
  assert.ok(shell.includes("erp-routes"), "ErpShell precisa ler erp-routes");
  assert.ok(shell.includes("itensDaNavegacao"), "barra inferior precisa usar a mesma regra do menu");
});

// --- Entrada legada "/" ---
test("entrada legada: / vai para /inicio", () => {
  assert.equal(destinoEntradaLegada("", ""), "/inicio");
});

test("entrada legada: start_url antigo do PWA vai para /crm", () => {
  assert.equal(destinoEntradaLegada("?crm=nova-era&origem=pwa", ""), "/crm?origem=pwa");
});

test("entrada legada PRESERVA o hash de recuperacao de senha", () => {
  const hash = "#access_token=abc123&type=recovery&expires_in=3600";
  assert.equal(destinoEntradaLegada("", hash), `/inicio${hash}`);
  assert.equal(destinoEntradaLegada("?crm=nova-era", hash), `/crm${hash}`);
});

test("entrada legada preserva demais query params", () => {
  assert.equal(destinoEntradaLegada("?utm_source=wpp&lead=9", ""), "/inicio?utm_source=wpp&lead=9");
});
