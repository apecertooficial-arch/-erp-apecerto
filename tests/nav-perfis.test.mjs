// Navegacao por perfil — corretor vs gestor/admin.
//
// A regra que decide barra inferior e folha "Mais" foi extraida do componente
// para uma funcao pura (itensDaNavegacao), justamente para poder ser provada
// sem navegador. Testes de fim aqui garantem que ErpShell e AppShell continuam
// consumindo essa funcao, em vez de reimplementar a decisao.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { itensDaNavegacao, rotasModulo, pathDoModulo } from "../app/features/system/erp-routes.ts";

const CORRETOR = {
  role: "corretor", carregado: true, isManager: false,
  permissoes: { dashboard: ["ver"], crm: ["ver"], calendario: ["ver"], notificacoes: ["ver"], produtos: ["ver"], projetos: ["ver"] },
};
const GESTOR = { ...CORRETOR, isManager: true };
const ADMIN = { role: "admin", carregado: true, permissoes: null };

test("app operacional tem exatamente Inicio, CRM e Agenda", () => {
  const { barra } = itensDaNavegacao(CORRETOR);
  assert.deepEqual(barra, ["Início", "CRM", "Calendário"]);
  assert.deepEqual(barra.map(pathDoModulo), ["/inicio", "/crm", "/agenda"]);
});

test("o que nao cabe na barra vai para Mais, sem sumir nem repetir", () => {
  const { barra, mais } = itensDaNavegacao(ADMIN);
  const todos = Object.keys(rotasModulo);
  assert.equal(barra.length + mais.length, todos.length, "admin precisa alcancar todos os modulos");
  assert.equal(new Set([...barra, ...mais]).size, todos.length, "nenhum modulo pode aparecer duas vezes");
  for (const m of barra) assert.ok(!mais.includes(m), `${m} nao pode estar na barra e em Mais`);
});

test("CORRETOR nao alcanca modulo administrativo por nenhum caminho", () => {
  const { barra, mais } = itensDaNavegacao(CORRETOR);
  const alcancaveis = new Set([...barra, ...mais]);
  for (const m of ["Usuários", "Perfis e Permissões", "Auditoria", "Financeiro", "Performance", "Minha Equipe"]) {
    assert.ok(!alcancaveis.has(m), `corretor nao deveria alcancar ${m}`);
  }
});

test("ADMIN alcanca os modulos administrativos", () => {
  const { barra, mais } = itensDaNavegacao(ADMIN);
  const alcancaveis = new Set([...barra, ...mais]);
  for (const m of ["Usuários", "Perfis e Permissões", "Auditoria", "Financeiro", "Performance", "Minha Equipe"]) {
    assert.ok(alcancaveis.has(m), `admin deveria alcancar ${m}`);
  }
});

test("Minha Equipe aparece para gestor e nao para corretor comum", () => {
  assert.ok(!itensDaNavegacao(CORRETOR).mais.includes("Minha Equipe"));
  assert.ok(itensDaNavegacao(GESTOR).mais.includes("Minha Equipe"));
});

test("FAIL-CLOSED: perfil ainda carregando nao expoe modulo controlado", () => {
  const { barra, mais } = itensDaNavegacao({ role: "corretor", permissoes: null, carregado: false });
  const alcancaveis = new Set([...barra, ...mais]);
  assert.ok(!alcancaveis.has("CRM"));
  assert.ok(!alcancaveis.has("Financeiro"));
  // Modulos sem slug de controle continuam de pe, porque nunca dependeram de permissao.
  assert.ok(alcancaveis.has("Ajuda"));
});

test("FAIL-CLOSED: permissoes vazias nao liberam nada controlado", () => {
  const { barra, mais } = itensDaNavegacao({ role: "corretor", permissoes: {}, carregado: true });
  const alcancaveis = new Set([...barra, ...mais]);
  for (const m of ["CRM", "Financeiro", "Auditoria", "Usuários", "Produtos"]) {
    assert.ok(!alcancaveis.has(m), `${m} nao pode vazar com permissoes vazias`);
  }
});

// --- Fonte unica: os dois menus precisam continuar lendo a mesma regra ---

test("ErpShell usa itensDaNavegacao em vez de reimplementar o filtro", () => {
  const src = readFileSync(new URL("../app/features/system/ErpShell.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("itensDaNavegacao"), "a casca precisa consumir a funcao pura");
  assert.ok(!/barraInferior\.filter/.test(src), "filtro duplicado no componente divergiria da regra");
});

test("AppShell continua consumindo podeVer, sem tabela de slugs propria", () => {
  const src = readFileSync(new URL("../app/components/AppShell.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("podeVer"), "sidebar precisa usar a mesma regra da barra inferior");
  assert.ok(!src.includes("permSlugs"), "tabela paralela de slugs nao pode voltar");
});

test("shell monta o botao de perfil (logout alcancavel no celular)", () => {
  const src = readFileSync(new URL("../app/features/system/ErpShell.tsx", import.meta.url), "utf8");
  assert.ok(/onOpenProfile=\{\(\) => setPerfilAberto\(true\)\}/.test(src), "sem isso o logout fica inalcancavel");
  assert.ok(src.includes("ProfilePanel"), "o painel de perfil precisa estar montado");
});
