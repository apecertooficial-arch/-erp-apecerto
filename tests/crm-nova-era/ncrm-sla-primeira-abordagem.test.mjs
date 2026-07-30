// PR B1 — SLA de cinco minutos. Puro: 'agora' entra como parametro.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularSla, minutosEntre, LIMITE_ATRASO_MIN } from "../../app/features/crm-nova-era/lib/slaPrimeiraAbordagem.ts";

const T0 = new Date("2026-07-30T12:00:00-03:00");
const maisMin = (m) => new Date(T0.getTime() + m * 60000);

test("duracao nunca e negativa", () => {
  assert.equal(minutosEntre(maisMin(10), T0), 0);
  assert.equal(minutosEntre(T0, maisMin(7)), 7);
});

test("ate 3 minutos pede para chamar agora", () => {
  for (const m of [0, 1, 2]) {
    const r = calcularSla({ distribuidoEm: T0, agora: maisMin(m) });
    assert.equal(r.estado, "chame_agora");
    assert.equal(r.rotulo, "Chame agora");
  }
});

test("entre 3 e 5 minutos avisa que o prazo esta terminando", () => {
  for (const m of [3, 4, 5]) {
    assert.equal(calcularSla({ distribuidoEm: T0, agora: maisMin(m) }).estado, "prazo_terminando");
  }
});

test("depois de 5 minutos fica atrasado e diz ha quanto tempo", () => {
  const r = calcularSla({ distribuidoEm: T0, agora: maisMin(9) });
  assert.equal(r.estado, "atrasado");
  assert.equal(r.urgencia, 3);
  assert.match(r.rotulo, /Atrasado ha 4 minutos/);
});

test("outbound confirmado encerra o SLA com o tempo real", () => {
  const r = calcularSla({ distribuidoEm: T0, confirmadoEm: maisMin(4), agora: maisMin(30) });
  assert.equal(r.estado, "confirmado");
  assert.equal(r.minutos, 4);
  assert.match(r.rotulo, /Abordado em 4 minutos/);
});

test("abrir o WhatsApp nao confirma: fica aguardando o D-API", () => {
  const r = calcularSla({ distribuidoEm: T0, whatsappAbertoEm: maisMin(1), agora: maisMin(2) });
  assert.equal(r.estado, "aguardando_confirmacao");
  assert.match(r.rotulo, /Aguardando confirmacao/);
});

test("aguardando confirmacao sobe de urgencia depois do prazo", () => {
  const dentro = calcularSla({ distribuidoEm: T0, whatsappAbertoEm: maisMin(1), agora: maisMin(3) });
  const fora = calcularSla({ distribuidoEm: T0, whatsappAbertoEm: maisMin(1), agora: maisMin(LIMITE_ATRASO_MIN + 2) });
  assert.equal(dentro.urgencia, 1);
  assert.equal(fora.urgencia, 2);
});

test("motivos legitimos suspendem a cobranca", () => {
  for (const motivo of ["telefone_invalido", "negocio_cancelado", "corretor_substituido", "falha_distribuicao", "canal_indisponivel", "fora_da_janela"]) {
    const r = calcularSla({ distribuidoEm: T0, agora: maisMin(60), motivoNaoSeAplica: motivo });
    assert.equal(r.estado, "nao_se_aplica");
    assert.equal(r.urgencia, 0);
    assert.ok(r.rotulo.length > 0);
  }
});

test("sem data de distribuicao nao cobra ninguem", () => {
  assert.equal(calcularSla({ distribuidoEm: null, agora: T0 }).estado, "nao_se_aplica");
});
