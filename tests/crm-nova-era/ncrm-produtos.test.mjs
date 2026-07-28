import { test } from "node:test";
import assert from "node:assert/strict";
import { formatProduto, filtrarProdutos } from "../../app/api/ncrm/produtosFormat.ts";

const UUID = "e0000000-0000-4000-8000-000000000099";

test("formatProduto: escolha pelo NOME; UUID só interno (value=id)", () => {
  const o = formatProduto({ id: UUID, nome: "Residencial Aurora", bairro: "Centro", cidade: "Campinas", preco: 450000 });
  assert.equal(o.id, UUID);                       // id preservado só para uso interno
  assert.equal(o.nome, "Residencial Aurora");
  assert.equal(o.local, "Centro/Campinas");
  assert.equal(o.preco, 450000);
  assert.match(o.rotulo, /Residencial Aurora/);   // usuário vê e busca pelo nome
  assert.match(o.rotulo, /Centro\/Campinas/);
  assert.match(o.rotulo, /R\$\s?450[.\s]?000/);   // preço formatado
  assert.doesNotMatch(o.rotulo, new RegExp(UUID)); // UUID NUNCA aparece para o usuário
});

test("formatProduto: sem bairro/cidade e sem preço válido", () => {
  const o = formatProduto({ id: UUID, nome: "  Torre X  ", bairro: null, cidade: "", preco: 0 });
  assert.equal(o.nome, "Torre X");
  assert.equal(o.local, "");
  assert.equal(o.preco, null);
  assert.equal(o.rotulo, "Torre X");              // só o nome quando não há local/preço
});

test("formatProduto: nome ausente vira placeholder (nunca vazio)", () => {
  const o = formatProduto({ id: UUID, nome: null });
  assert.equal(o.nome, "(sem nome)");
});

test("filtrarProdutos: busca por nome e por local, case-insensitive", () => {
  const ops = [
    formatProduto({ id: "1", nome: "Residencial Aurora", bairro: "Centro", cidade: "Campinas", preco: 400000 }),
    formatProduto({ id: "2", nome: "Edifício Boreal", bairro: "Cambuí", cidade: "Campinas", preco: 700000 }),
  ];
  assert.equal(filtrarProdutos(ops, "aurora").length, 1);
  assert.equal(filtrarProdutos(ops, "CAMBUÍ").length, 1);
  assert.equal(filtrarProdutos(ops, "campinas").length, 2);
  assert.equal(filtrarProdutos(ops, "").length, 2);
});

test("filtrarProdutos: digitar um UUID não seleciona nada (escolha é por nome)", () => {
  const ops = [formatProduto({ id: UUID, nome: "Residencial Aurora", bairro: "Centro", cidade: "Campinas", preco: 400000 })];
  assert.equal(filtrarProdutos(ops, UUID).length, 0);
});
