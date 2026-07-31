/* DEPOIS DA VISITA — as decisoes de negocio, travadas em teste.
 *
 * A gravacao ainda depende de migration (a tabela `visitas` so tem status).
 * Estas regras vem antes do SQL de proposito: quando a migration for escrita,
 * ela implementa uma especificacao que ja esta acordada e verificada, em vez
 * de reabrir a discussao dentro do banco.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  RESULTADOS_VISITA, definicaoResultado, destinoDoResultado, exigeProximaAcao,
  prazoDoResultado, cobrancaDoResultado, resultadoAtrasado,
} from "../app/features/crm-nova-era-3/lib/posVisita.ts";

test("os sete resultados possiveis da visita", () => {
  assert.equal(RESULTADOS_VISITA.length, 7);
  assert.deepEqual(RESULTADOS_VISITA.map((r) => r.chave).sort(), [
    "fara_proposta", "interessado", "nao_compareceu", "nao_gostou",
    "precisa_conversar", "quer_outra_opcao", "remarcar",
  ]);
});

test("NENHUM resultado deixa o cliente parado", () => {
  // Esta e a regra. Cliente sem destino e cliente que some do dia do corretor.
  for (const r of RESULTADOS_VISITA) {
    assert.ok(destinoDoResultado(r.chave), `${r.chave} nao leva a lugar nenhum`);
  }
});

test("quem fez proposta vai para a Esteira; quem nao gostou, para o descarte", () => {
  assert.equal(destinoDoResultado("fara_proposta"), "esteira_vendas");
  assert.equal(destinoDoResultado("nao_gostou"), "descarte");
});

test("o resto volta para Em acompanhamento, com compromisso", () => {
  for (const chave of ["interessado", "quer_outra_opcao", "precisa_conversar", "nao_compareceu"]) {
    assert.equal(destinoDoResultado(chave), "funil_acompanhamento", `${chave} deveria voltar ao funil`);
    assert.equal(exigeProximaAcao(chave), true);
    assert.ok(definicaoResultado(chave).proximaAcaoTipo, `${chave} sem proxima acao sugerida`);
  }
});

test("remarcar so sai do Pipe quando a nova visita existir", () => {
  assert.equal(destinoDoResultado("remarcar"), "nova_visita");
  assert.equal(definicaoResultado("remarcar").proximaAcaoTipo, "agendar_visita");
});

test("so o descarte pode terminar sem proxima acao", () => {
  const semAcao = RESULTADOS_VISITA.filter((r) => !exigeProximaAcao(r.chave));
  assert.deepEqual(semAcao.map((r) => r.chave), ["nao_gostou"]);
});

test("nao compareceu e o mais urgente: quatro horas, nao um dia", () => {
  const base = new Date("2026-08-03T14:00:00.000Z");
  assert.equal(prazoDoResultado("nao_compareceu", base), "2026-08-03T18:00:00.000Z");
  assert.equal(prazoDoResultado("interessado", base), "2026-08-04T14:00:00.000Z");
  assert.equal(prazoDoResultado("precisa_conversar", base), "2026-08-06T14:00:00.000Z");
  assert.equal(prazoDoResultado("nao_gostou", base), null);
});

test("a cobranca do resultado cai na manha seguinte, 9h de Brasilia", () => {
  // Cobrar logo apos o horario marcado pegaria o corretor ainda com o cliente.
  assert.equal(cobrancaDoResultado(new Date("2026-08-03T18:00:00.000Z")), "2026-08-04T12:00:00.000Z");
  assert.equal(cobrancaDoResultado(new Date("2026-08-03T13:00:00.000Z")), "2026-08-04T12:00:00.000Z");
});

test("visita com resultado registrado nunca aparece como atrasada", () => {
  const visita = new Date("2026-08-03T18:00:00.000Z");
  const depois = new Date("2026-08-05T10:00:00.000Z");
  assert.equal(resultadoAtrasado(visita, "interessado", depois), false);
  assert.equal(resultadoAtrasado(visita, null, depois), true);
  assert.equal(resultadoAtrasado(visita, null, new Date("2026-08-03T20:00:00.000Z")), false);
});

test("resultado desconhecido nao inventa destino", () => {
  assert.equal(definicaoResultado("gostou_muito"), null);
  assert.equal(destinoDoResultado("gostou_muito"), null);
  assert.equal(exigeProximaAcao("gostou_muito"), false);
});
