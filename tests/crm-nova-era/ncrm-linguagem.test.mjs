// Fase 5.1 — linguagem do corretor e agrupamento do Meu dia (puros).
import { test } from "node:test";
import assert from "node:assert/strict";
import { termoCorretor, contemTermoTecnico, rotuloIngest, rotuloSara, rotuloRunner, grupoDoItem, GRUPO_ORDEM } from "../../app/features/crm-nova-era/lib/linguagem.ts";

test("jargão vira linguagem comercial", () => {
  assert.equal(termoCorretor("ingest"), "Entrada de novos atendimentos");
  assert.equal(termoCorretor("runner"), "Análise automática da Sara");
  assert.equal(termoCorretor("observer"), "Sara apenas sugerindo");
  assert.equal(termoCorretor("checkpoint"), "última atualização");
  assert.equal(termoCorretor("noop"), "ignorado sem alteração");
});

test("termos proibidos são detectados", () => {
  assert.ok(contemTermoTecnico("context_hash abc"));
  assert.ok(contemTermoTecnico("ncrm_sara_analise"));
  assert.ok(!contemTermoTecnico("Cliente respondeu — aguardando você"));
});

test("rótulos de estado não expõem jargão", () => {
  assert.equal(rotuloIngest(true), "Entrada de novos atendimentos: ligada");
  assert.equal(rotuloIngest(false), "Entrada de novos atendimentos: desligada");
  assert.equal(rotuloSara("observer"), "Sara apenas sugerindo");
  assert.equal(rotuloRunner(true), "Análise automática da Sara: ligada");
  for (const t of [rotuloIngest(true), rotuloSara("observer"), rotuloRunner(false)]) {
    assert.ok(!contemTermoTecnico(t));
  }
});

test("agrupamento do Meu dia em 4 grupos", () => {
  assert.equal(grupoDoItem({ prioridade: 1 }), "atenda_agora");
  assert.equal(grupoDoItem({ prioridade: 2 }), "atenda_agora");
  assert.equal(grupoDoItem({ prioridade: 3 }), "faca_hoje");
  assert.equal(grupoDoItem({ prioridade: 5 }), "faca_hoje");
  assert.equal(grupoDoItem({ prioridade: 6 }), "faca_hoje");
  assert.equal(grupoDoItem({ prioridade: 7, respondeu: true }), "aguardando_cliente");
  assert.equal(grupoDoItem({ prioridade: 7, respondeu: false }), "agendados");
  assert.deepEqual(GRUPO_ORDEM, ["atenda_agora", "faca_hoje", "agendados", "aguardando_cliente"]);
});
