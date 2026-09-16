// Fase 2 — Papéis canônicos: matriz papel × ação, fail-closed e espelho SQL.
// Executar: node --test tests/papeis.test.mjs
// Sem rede, sem banco, sem DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PAPEIS, GRUPOS, normalizarPapel, papelNoGrupo, papelDeSessao } from "../app/lib/papeis.ts";
import { canDo } from "../app/lib/permissions.ts";
import { statusPublicacao } from "../app/features/automations/statusPublicacao.ts";

const ler = (caminho) => readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// Matriz esperada: cada ponto de decisão do sistema e QUEM passa nele.
// Mudar um grupo em app/lib/papeis.ts sem mudar esta tabela quebra o teste —
// de propósito: toda mudança de acesso precisa ser uma decisão explícita.
// ---------------------------------------------------------------------------
const MATRIZ = [
  // [ponto de decisão, grupo, papéis que passam]
  ["ignora mapa de permissões (canDo / has_perm)", "acesso_total", ["admin", "executivo"]],
  ["/api/permissions (tela Perfis e Permissões)", "acesso_total", ["admin", "executivo"]],
  ["sessão = gestor (Central, Minha Equipe no menu)", "gestao", ["admin", "executivo", "diretor", "gerente"]],
  ["/api/central-comando", "gestao", ["admin", "executivo", "diretor", "gerente"]],
  ["marketing-ads-read (Edge)", "gestao", ["admin", "executivo", "diretor", "gerente"]],
  ["/api/funil2/clientes escolhe corretor", "gestao", ["admin", "executivo", "diretor", "gerente"]],
  ["/api/finance categorias, apagar venda, comissões", "financeiro", ["admin", "executivo"]],
  ["/api/metas PATCH", "metas", ["admin", "executivo"]],
  ["/api/dashboard", "dashboard_gerencial", ["admin", "executivo"]],
  ["/api/crm/sales etapas e venda já aprovada", "esteira_config", ["admin", "executivo"]],
  ["excluir venda da esteira", "excluir_venda", ["admin", "diretor"]],
  ["Produtos (is_product_manager)", "produtos", ["admin", "executivo", "gerente"]],
  ["superior hierárquico (Minha Equipe)", "hierarquia", ["admin", "diretor", "gerente"]],
  ["ia-testes / visão geral da Sara", "supervisao_ia", ["admin", "gerente"]],
  ["só administrador (is_admin)", "admin", ["admin"]],
  ["usuário do sistema (is_equipe)", "todos", ["admin", "executivo", "diretor", "gerente", "corretor"]],
];

test("enum real: exatamente os 5 papéis de public.user_role", () => {
  assert.deepEqual([...PAPEIS].sort(), ["admin", "corretor", "diretor", "executivo", "gerente"]);
  const tipos = ler("app/lib/supabase/database.types.ts");
  assert.match(tipos, /user_role: "admin" \| "corretor" \| "executivo" \| "gerente" \| "diretor"/);
});

for (const [ponto, grupo, esperado] of MATRIZ) {
  test(`matriz: ${ponto}`, () => {
    for (const papel of PAPEIS) {
      assert.equal(papelNoGrupo(papel, grupo), esperado.includes(papel), `${papel} em ${grupo}`);
    }
  });
}

test("matriz cobre todos os grupos definidos", () => {
  const cobertos = new Set(MATRIZ.map(([, grupo]) => grupo));
  assert.deepEqual([...cobertos].sort(), Object.keys(GRUPOS).sort());
});

test("papéis inexistentes nunca entram em grupo nenhum", () => {
  for (const falso of ["gestor", "gestor_comercial", "gestor_equipe", "auditor", "financeiro", "", null, undefined, 42]) {
    assert.equal(normalizarPapel(falso), null);
    for (const grupo of Object.keys(GRUPOS)) assert.equal(papelNoGrupo(falso, grupo), false, `${String(falso)} em ${grupo}`);
  }
});

test("grupo desconhecido nega (fail-closed)", () => {
  assert.equal(papelNoGrupo("admin", "nao_existe"), false);
});

test("normalização tolera caixa e espaço do banco", () => {
  assert.equal(normalizarPapel(" Gerente "), "gerente");
  assert.equal(papelNoGrupo("ADMIN", "admin"), true);
});

test("classe de sessão: admin / gestor / corretor", () => {
  assert.equal(papelDeSessao("admin"), "admin");
  assert.equal(papelDeSessao("executivo"), "gestor");
  assert.equal(papelDeSessao("diretor"), "gestor");
  assert.equal(papelDeSessao("gerente"), "gestor");
  assert.equal(papelDeSessao("corretor"), "corretor");
  assert.equal(papelDeSessao("gestor_comercial"), "corretor");
  assert.equal(papelDeSessao(null), "corretor");
});

// ---------------------------------------------------------------------------
// canDo — fail-closed
// ---------------------------------------------------------------------------
const MAPA_CORRETOR = { crm: ["ver", "criar"], leads: ["ver", "criar"], produtos: ["ver", "criar", "editar"], dashboard: ["ver"] };
const MAPAS = { nulo: null, vazio: {}, corretor: MAPA_CORRETOR };
const ACOES = [["crm", "ver"], ["crm", "excluir"], ["financeiro", "ver"], ["usuarios", "gerenciar_permissoes"], ["produtos", "editar"]];

test("canDo: acesso_total pode tudo, com ou sem mapa", () => {
  for (const papel of ["admin", "executivo"]) {
    for (const mapa of Object.values(MAPAS)) {
      for (const [modulo, acao] of ACOES) assert.equal(canDo(papel, mapa, modulo, acao), true, `${papel} ${modulo}.${acao}`);
    }
  }
});

test("canDo: sem mapa (null ou {}) NEGA para quem não é acesso_total", () => {
  for (const papel of ["diretor", "gerente", "corretor", "gestor", "", null, undefined]) {
    for (const mapa of [MAPAS.nulo, MAPAS.vazio]) {
      for (const [modulo, acao] of ACOES) assert.equal(canDo(papel, mapa, modulo, acao), false, `${String(papel)} ${modulo}.${acao}`);
    }
  }
});

test("canDo: com mapa, vale exatamente o que está no mapa", () => {
  for (const papel of ["diretor", "gerente", "corretor"]) {
    for (const [modulo, acao] of ACOES) {
      const esperado = (MAPA_CORRETOR[modulo] ?? []).includes(acao);
      assert.equal(canDo(papel, MAPA_CORRETOR, modulo, acao), esperado, `${papel} ${modulo}.${acao}`);
    }
  }
});

test("canDo: papel inexistente não herda o atalho de admin", () => {
  assert.equal(canDo("gestor", MAPA_CORRETOR, "financeiro", "ver"), false);
  assert.equal(canDo("gestor_comercial", null, "crm", "ver"), false);
});

// ---------------------------------------------------------------------------
// Espelhos: SQL e Deno
// ---------------------------------------------------------------------------
test("migration SQL define os mesmos grupos com os mesmos membros", () => {
  const sql = ler("supabase/migrations/20260916120000_fase2_papeis_canonicos.sql");
  const corpo = sql.slice(sql.indexOf("function public.papeis_do_grupo"), sql.indexOf("function public.papel_no_grupo"));
  const doSql = {};
  for (const m of corpo.matchAll(/when '([a-z_]+)'\s+then array\[([^\]]*)\]/g)) {
    doSql[m[1]] = [...m[2].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
  }
  const doTs = Object.fromEntries(Object.entries(GRUPOS).map(([g, membros]) => [g, [...membros].sort()]));
  assert.deepEqual(doSql, doTs);
});

test("migration delega as funções antigas para papel_no_grupo", () => {
  const sql = ler("supabase/migrations/20260916120000_fase2_papeis_canonicos.sql");
  for (const [funcao, grupo] of [["is_admin", "admin"], ["is_admin_exec", "acesso_total"], ["can_manage_all", "acesso_total"], ["is_product_manager", "produtos"], ["is_equipe", "todos"]]) {
    const re = new RegExp(`function public\\.${funcao}\\(\\)[\\s\\S]*?security definer[\\s\\S]*?select public\\.papel_no_grupo\\('${grupo}'\\);`);
    assert.match(sql, re, funcao);
  }
  assert.match(sql, /and u\.ativo/);
  assert.match(sql, /raise exception 'fase2_papeis: acesso mudaria/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /'gestor(_comercial|_equipe)?'/);
});

test("cópia Deno de papeis.ts é idêntica", () => {
  assert.equal(ler("supabase/functions/_shared/papeis.ts"), ler("app/lib/papeis.ts"));
});

// ---------------------------------------------------------------------------
// Nenhum ponto de decisão volta a ter lista própria de papéis
// ---------------------------------------------------------------------------
const CONSUMIDORES = {
  "app/api/session/route.ts": /papelDeSessao\(/,
  "app/features/system/ErpSession.tsx": /papelNoGrupo\(profile\?\.perfil, "acesso_total"\)/,
  "app/api/finance/route.ts": /papelNoGrupo\(me\.role, "financeiro"\)/,
  "app/api/metas/route.ts": /papelNoGrupo\(me\.role, "metas"\)/,
  "app/api/dashboard/route.ts": /papelNoGrupo\(role, "dashboard_gerencial"\)/,
  "app/api/crm/sales/route.ts": /papelNoGrupo\(me\.role, "esteira_config"\)/,
  "app/api/central-comando/route.ts": /papelNoGrupo\(role, "gestao"\)/,
  "app/api/permissions/route.ts": /papelNoGrupo\(role, "acesso_total"\)/,
  "app/api/funil2/clientes/route.ts": /papelNoGrupo\(access\.role, "gestao"\)/,
  "app/features/products/access.ts": /papelNoGrupo\(role, "produtos"\)/,
  "supabase/functions/ia-testes/index.ts": /papelNoGrupo\(usuario\?\.role, "supervisao_ia"\)/,
  "supabase/functions/marketing-ads-read/index.ts": /papelNoGrupo\(me\.role, "gestao"\)/,
};

for (const [arquivo, uso] of Object.entries(CONSUMIDORES)) {
  test(`consumidor usa papeis.ts: ${arquivo}`, () => {
    const src = ler(arquivo);
    assert.match(src, uso);
    const semComentario = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(semComentario, /["'](gestor_comercial|gestor_equipe)["']/, "papel inexistente");
    assert.doesNotMatch(semComentario, /\[\s*["']admin["']\s*,\s*["'](gestor|executivo|gerente|diretor)["']/, "lista local de papéis");
    assert.doesNotMatch(semComentario, /new Set\(\[\s*["']admin["']/, "Set local de papéis");
  });
}

// ---------------------------------------------------------------------------
// Automações: status nulo é rascunho
// ---------------------------------------------------------------------------
test("automação com status nulo ou vazio é rascunho, não publicada", () => {
  assert.equal(statusPublicacao({ status: null }), "rascunho");
  assert.equal(statusPublicacao({ status: "" }), "rascunho");
  assert.equal(statusPublicacao({}), "rascunho");
  assert.equal(statusPublicacao({ status: "publicado" }), "publicado");
  assert.equal(statusPublicacao({ status: "rascunho" }), "rascunho");
  const home = ler("app/features/automations/AutomationsHome.tsx");
  assert.doesNotMatch(home, /status \|\| "publicado"/);
});
