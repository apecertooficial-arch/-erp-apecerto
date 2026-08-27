/* Regressoes encontradas na homologacao funcional em producao (31/07/2026).
 *
 * Cada teste aqui existe porque a falha ACONTECEU em producao, nao porque
 * parecia possivel. Os dados de permissao abaixo foram lidos de
 * /api/permissions do ambiente real.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { podeVer, itensDaNavegacao, rotasModulo } from "../app/features/system/erp-routes.ts";

/* Perfis reais, exatamente como o banco devolve. O ponto central: TODOS os
   perfis, inclusive corretor, tem "comissoes: ver". */
const CORRETOR = {
  crm: ["ver"], chat: ["ver"], leads: ["ver"], vendas: ["ver"], disparos: ["ver"],
  pipeline: ["ver"], produtos: ["ver"], comissoes: ["ver"], dashboard: ["ver"],
  abordagens: ["ver"], calendario: ["ver"],
  notificacoes: ["ver"], configuracoes: ["ver"],
};
const DIRETOR = { ...CORRETOR, metas: ["ver"], usuarios: ["ver"], financeiro: ["ver"], agentes_ia: ["ver"], automacoes: ["ver"] };

const comoCorretor = { role: "corretor", permissoes: CORRETOR, carregado: true, isManager: false };
const comoDiretor = { role: "corretor", permissoes: DIRETOR, carregado: true, isManager: true };

test("corretor NAO ve Financeiro so por ter comissoes", () => {
  // Falha real: .some() sobre [financeiro, comissoes, vendas, fluxo_caixa]
  // abria o modulo inteiro para quem so podia ver a propria comissao.
  assert.equal(podeVer("Financeiro", comoCorretor), false);
  assert.equal(podeVer("Financeiro", comoDiretor), true);
});

test("corretor nao ve Usuarios, Permissoes nem Auditoria", () => {
  for (const m of ["Usuários", "Perfis e Permissões", "Auditoria"]) {
    assert.equal(podeVer(m, comoCorretor), false, `${m} vazou para o corretor`);
  }
});

test("corretor ve os modulos do dia a dia, incluindo Tarefas", () => {
  // Falha real: o slug "projetos" nao existe no banco. Com podeVer fail-closed,
  // um slug inexistente escondia Tarefas de todo mundo que nao fosse admin.
  for (const m of ["Início", "CRM", "Calendário", "Notificações", "Produtos", "Projetos e Tarefas"]) {
    assert.equal(podeVer(m, comoCorretor), true, `${m} sumiu para o corretor`);
  }
});

test("todo slug usado existe no catalogo real de permissoes", () => {
  const doBanco = new Set(["abordagens","agentes_ia","auditoria","automacoes","calendario","chat",
    "comissoes","configuracoes","crm","dashboard","disparos","financeiro","fluxo_caixa","leads",
    "metas","notificacoes","pipeline","produtos","studio_social","usuarios","vendas"]);
  for (const [modulo, rota] of Object.entries(rotasModulo)) {
    for (const slug of rota.slugs) {
      assert.ok(doBanco.has(slug), `${modulo} usa slug inexistente "${slug}" -- fail-closed esconderia o modulo de todos`);
    }
  }
});

test("a folha Mais do corretor nao contem modulo proibido", () => {
  const { barra, mais } = itensDaNavegacao(comoCorretor);
  const todos = [...barra, ...mais];
  for (const m of ["Financeiro", "Usuários", "Perfis e Permissões", "Auditoria"]) {
    assert.ok(!todos.includes(m), `${m} apareceu na navegacao do corretor`);
  }
});

/* ---- logout ---- */
test("logout cobre os prefixos que producao realmente grava", () => {
  const src = readFileSync(new URL("../app/components/RegistroPwa.tsx", import.meta.url), "utf8");
  const linha = src.match(/const PREFIXOS_APECERTO[^;]+;/)[0];
  const prefixos = [...linha.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  // Chaves observadas no navegador em producao, com a sessao aberta.
  const reais = [
    "apecerto-notif-read",
    "apecerto_os_v1",
    "ncrm_onboarding_v1_4dfdffae-0009-41de-8d6f-2365a06dc066",
    "ncrm:variante:4dfdffae-0009-41de-8d6f-2365a06dc066",
    "sb-diaegvfveqezispcthwk-auth-token",
  ];
  for (const k of reais) {
    assert.ok(prefixos.some((p) => k.startsWith(p)), `logout deixaria "${k}" para o proximo usuario`);
  }
});

test("logout nao apaga chave de terceiro", () => {
  const src = readFileSync(new URL("../app/components/RegistroPwa.tsx", import.meta.url), "utf8");
  const linha = src.match(/const PREFIXOS_APECERTO[^;]+;/)[0];
  const prefixos = [...linha.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  for (const k of ["theme", "outro-app:estado", "intercom.session", "ga_client_id"]) {
    assert.ok(!prefixos.some((p) => k.startsWith(p)), `logout apagaria "${k}", que nao e nosso`);
  }
});
