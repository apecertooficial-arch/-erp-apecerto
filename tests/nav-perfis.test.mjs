// Navegacao por perfil — corretor vs gestor/admin.
//
// A regra que decide barra inferior e folha "Mais" foi extraida do componente
// para uma funcao pura (itensDaNavegacao), justamente para poder ser provada
// sem navegador. Testes de fim aqui garantem que ErpShell e AppShell continuam
// consumindo essa funcao, em vez de reimplementar a decisao.
//
// CONTRATO ATUAL: o app nao e o ERP inteiro. Modulo com mobile:false nao
// aparece na barra nem na folha "Mais" (a rota continua existindo no
// computador). Por isso o universo comparavel aqui e "os modulos com tela de
// celular", nao "todos os modulos do ERP".
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { itensDaNavegacao, podeVer, rotasModulo, pathDoModulo } from "../app/features/system/erp-routes.ts";

const modulosDoApp = Object.entries(rotasModulo).filter(([, rota]) => rota.mobile).map(([nome]) => nome);

const CORRETOR = {
  role: "corretor", carregado: true, isManager: false,
  permissoes: { dashboard: ["ver"], crm: ["ver"], calendario: ["ver"], notificacoes: ["ver"], produtos: ["ver"], projetos: ["ver"] },
};
const GESTOR = { ...CORRETOR, isManager: true };
const ADMIN = { role: "admin", carregado: true, permissoes: null };

test("app do corretor tem Inicio, CRM, Agenda e Avisos", () => {
  const { barra } = itensDaNavegacao(CORRETOR);
  assert.deepEqual(barra, ["Início", "CRM", "Calendário", "Notificações"]);
  assert.deepEqual(barra.map(pathDoModulo), ["/inicio", "/crm", "/agenda", "/notificacoes"]);
});

test("o que nao cabe na barra vai para Mais, sem sumir nem repetir", () => {
  const { barra, mais } = itensDaNavegacao(ADMIN);
  assert.equal(barra.length + mais.length, modulosDoApp.length, "admin precisa alcancar todo modulo com tela de celular");
  assert.equal(new Set([...barra, ...mais]).size, modulosDoApp.length, "nenhum modulo pode aparecer duas vezes");
  for (const m of barra) assert.ok(!mais.includes(m), `${m} nao pode estar na barra e em Mais`);
});

test("CORRETOR nao alcanca modulo administrativo por nenhum caminho", () => {
  const { barra, mais } = itensDaNavegacao(CORRETOR);
  const alcancaveis = new Set([...barra, ...mais]);
  for (const m of ["Usuários", "Perfis e Permissões", "Auditoria", "Financeiro", "Minha Equipe"]) {
    assert.ok(!alcancaveis.has(m), `corretor nao deveria alcancar ${m}`);
  }
});

test("ADMIN pode ver todo modulo administrativo, e o app so oferece os que tem tela de celular", () => {
  // Permissao e oferta no app sao duas coisas: o admin PODE ver Financeiro,
  // mas o app nao abre uma tela de escritorio comprimida em 390px.
  for (const m of ["Usuários", "Perfis e Permissões", "Auditoria", "Financeiro", "Minha Equipe"]) {
    assert.equal(podeVer(m, ADMIN), true, `admin deveria poder ver ${m}`);
  }
  const { barra, mais } = itensDaNavegacao(ADMIN);
  const alcancaveis = new Set([...barra, ...mais]);
  for (const m of ["Usuários", "Perfis e Permissões", "Auditoria", "Financeiro", "Minha Equipe"]) {
    assert.ok(!alcancaveis.has(m), `${m} e mobile:false: o app nao pode oferecer o caminho`);
  }
});

test("gestor tem Inicio, Produtos, Agenda e Gestao na barra", () => {
  assert.ok(!itensDaNavegacao(CORRETOR).mais.includes("Minha Equipe"));
  // "Minha Equipe" saiu da barra do gestor enquanto a relacao perf_snapshots
  // nao existir no banco (a tela abria so com erro). O lugar dela e a barra
  // completa do computador; no celular o gestor tem Inicio, Produtos, Agenda e
  // Gestao. Ver a nota em rotasModulo["Minha Equipe"].
  assert.deepEqual(itensDaNavegacao(GESTOR).barra, ["Início", "Produtos", "Calendário", "Configurações"]);
  assert.ok(!itensDaNavegacao(GESTOR).mais.includes("Minha Equipe"), "modulo sem tela de celular nao pode cair na folha Mais");
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
