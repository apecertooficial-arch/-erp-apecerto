import { test } from "node:test";
import assert from "node:assert/strict";
import { LICOES, progressoTreinamento, proximaLicao } from "../../app/features/crm-nova-era/lib/treinamento.ts";
import { contemTermoTecnico } from "../../app/features/crm-nova-era/lib/linguagem.ts";

test("todas as lições têm id válido para o checklist (2..60) e são únicas", () => {
  const ids = new Set();
  for (const l of LICOES) {
    assert.ok(l.id.trim().length >= 2 && l.id.trim().length <= 60, `id inválido: ${l.id}`);
    assert.equal(ids.has(l.id), false, `id duplicado: ${l.id}`);
    ids.add(l.id);
    assert.ok(l.titulo.length > 0 && l.resumo.length > 0);
    assert.ok(l.passos.length >= 2, `poucos passos em ${l.id}`);
  }
  assert.ok(LICOES.length >= 12, "o guia precisa cobrir o fluxo inteiro");
});

test("o conteúdo não usa nome técnico interno", () => {
  for (const l of LICOES) {
    const texto = [l.titulo, l.resumo, ...l.passos, l.exemplo ?? ""].join(" ");
    assert.equal(contemTermoTecnico(texto), false, `termo técnico em ${l.id}: ${texto}`);
  }
});

test("nenhum exemplo carrega dado pessoal ou valor de negócio", () => {
  const telefone = /\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/;
  const dinheiro = /R\$\s?\d/;
  const email = /[\w.]+@[\w.]+/;
  for (const l of LICOES) {
    const t = [l.resumo, ...l.passos, l.exemplo ?? ""].join(" ");
    assert.equal(telefone.test(t), false, `telefone em ${l.id}`);
    assert.equal(dinheiro.test(t), false, `valor em ${l.id}`);
    assert.equal(email.test(t), false, `email em ${l.id}`);
  }
});

test("progresso: 0%, parcial e 100%", () => {
  assert.equal(progressoTreinamento([]), 0);
  assert.equal(progressoTreinamento(LICOES.map((l) => l.id)), 100);
  const metade = LICOES.slice(0, Math.floor(LICOES.length / 2)).map((l) => l.id);
  const p = progressoTreinamento(metade);
  assert.ok(p > 0 && p < 100);
});

test("progresso ignora itens desconhecidos e duplicados", () => {
  const id = LICOES[0].id;
  assert.equal(progressoTreinamento([id, id, "item-que-nao-existe"]), progressoTreinamento([id]));
});

test("próxima lição retoma de onde parou e some ao concluir tudo", () => {
  assert.equal(proximaLicao([])?.id, LICOES[0].id);
  assert.equal(proximaLicao([LICOES[0].id])?.id, LICOES[1].id);
  assert.equal(proximaLicao(LICOES.map((l) => l.id)), null);
});
