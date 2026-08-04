/* Regra de estoque ofertável: unidade pendente de aprovação não é estoque.
 *
 * Contexto: o catálogo filtrava só por `disponivel`, então uma indicação recém
 * cadastrada (aprovacao='pendente', disponivel=true) já contava como estoque e
 * podia virar o "a partir de" do produto — antes de qualquer validação.
 * Nada aqui toca banco.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ehOfertavel, estaPendente } from "../app/lib/estoque.ts";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const catalogo = ler("../app/api/catalog/route.ts");
const produto = ler("../app/api/product/route.ts");

/* ---------------- 1. A REGRA ---------------- */

test("unidade da construtora disponivel e aprovada é ofertável", () => {
  assert.equal(ehOfertavel({ disponivel: true, aprovacao: "aprovado" }), true);
});

test("indicação pendente NÃO é ofertável mesmo com disponivel=true", () => {
  assert.equal(ehOfertavel({ disponivel: true, aprovacao: "pendente" }), false);
});

test("indicação reprovada NÃO é ofertável", () => {
  assert.equal(ehOfertavel({ disponivel: true, aprovacao: "reprovado" }), false);
});

test("unidade vendida/indisponível nunca é ofertável", () => {
  assert.equal(ehOfertavel({ disponivel: false, aprovacao: "aprovado" }), false);
});

test("aprovacao ausente é tratada como aprovada (linhas antigas de construtora)", () => {
  assert.equal(ehOfertavel({ disponivel: true }), true);
  assert.equal(ehOfertavel({ disponivel: true, aprovacao: null }), true);
});

test("estaPendente só marca o que aguarda validação", () => {
  assert.equal(estaPendente({ disponivel: true, aprovacao: "pendente" }), true);
  assert.equal(estaPendente({ disponivel: true, aprovacao: "aprovado" }), false);
  assert.equal(estaPendente({ disponivel: false }), false);
});

/* ---------------- 2. OS DOIS CONSUMIDORES ---------------- */

test("o catálogo usa a regra em vez de filtrar só por disponivel", () => {
  assert.ok(/availableUnits = units\.filter\(ehOfertavel\)/.test(catalogo),
    "catalog/route.ts precisa filtrar o estoque por ehOfertavel");
  assert.ok(!/units\.filter\(\(unit\) => unit\.disponivel\)/.test(catalogo),
    "o filtro antigo por disponivel voltou ao catálogo");
  assert.ok(/aprovacao/.test(catalogo.slice(catalogo.indexOf("unidades ("), catalogo.indexOf("unidades (") + 200)),
    "o select das unidades precisa trazer aprovacao, senão a regra roda sem o campo");
});

test("o resumo do produto usa a mesma regra", () => {
  assert.ok(/availableUnits = units\.filter\(ehOfertavel\)/.test(produto),
    "product/route.ts precisa usar a mesma regra do catálogo");
  assert.ok(!/units\.filter\(\(item\) => item\.disponivel\)/.test(produto),
    "o filtro antigo por disponivel voltou ao resumo do produto");
});

test("o catálogo devolve a contagem de pendentes para o aprovador", () => {
  assert.ok(/pendingUnits: pendingUnitCount/.test(catalogo),
    "sem pendingUnits o front não consegue mostrar quantas aguardam validação");
});

test("indicação criada pelo editor do produto também entra na fila", () => {
  assert.ok(/deTerceiros \? \{ aprovacao: "pendente" \} : \{\}/.test(produto),
    "insert de unidade de terceiros pelo editor precisa forçar aprovacao pendente; o default da coluna é 'aprovado'");
});
