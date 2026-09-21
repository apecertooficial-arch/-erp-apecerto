import assert from "node:assert/strict";
import test from "node:test";
import {
  dataHoraLocalSaoPaulo,
  dataOperacao,
  deDatetimeLocal,
  fimDoMes,
  hojeOperacao,
  paraDatetimeLocal,
  somarDias,
  instanteSaoPaulo,
  normalizarInstanteSaoPaulo,
} from "../app/lib/timezone.ts";
import { venceHoje } from "../app/features/funil-2/modelo.ts";

test("09:00 de São Paulo é persistido como o instante UTC correto", () => {
  const instante = instanteSaoPaulo("2026-08-22", "09:00:00");
  assert.equal(instante, "2026-08-22T12:00:00.000Z");
  assert.equal(dataHoraLocalSaoPaulo(instante), "2026-08-22T09:00");
});

test("datetime-local não depende do fuso do servidor e ISO explícito não converte duas vezes", () => {
  assert.equal(normalizarInstanteSaoPaulo("2026-08-22T09:00"), "2026-08-22T12:00:00.000Z");
  assert.equal(normalizarInstanteSaoPaulo("2026-08-22T12:00:00.000Z"), "2026-08-22T12:00:00.000Z");
});

test("datas e horários inexistentes são rejeitados", () => {
  assert.equal(instanteSaoPaulo("2026-02-30", "09:00"), null);
  assert.equal(instanteSaoPaulo("2026-08-22", "25:00"), null);
});

test("23:30 de São Paulo já é o dia seguinte em UTC, mas a data de negócio continua no dia", () => {
  const instante = new Date("2026-09-18T02:30:00.000Z"); // 17/09 23:30 em SP
  assert.equal(instante.toISOString().slice(0, 10), "2026-09-18"); // o bug antigo
  assert.equal(hojeOperacao(instante), "2026-09-17");
  assert.equal(dataOperacao(instante), "2026-09-17");
  // 21:00 em SP é o primeiro minuto em que o UTC vira o dia.
  assert.equal(dataOperacao(new Date("2026-09-18T00:00:00.000Z")), "2026-09-17");
  assert.equal(dataOperacao(new Date("2026-09-18T03:00:00.000Z")), "2026-09-18");
});

test("virada de mês e de ano no fuso da operação", () => {
  assert.equal(dataOperacao(new Date("2026-10-01T02:59:59.000Z")), "2026-09-30");
  assert.equal(dataOperacao(new Date("2027-01-01T02:30:00.000Z")), "2026-12-31");
  assert.equal(dataOperacao(new Date("2027-01-01T03:00:00.000Z")), "2027-01-01");
  assert.equal(hojeOperacao(new Date("2026-03-01T01:00:00.000Z")), "2026-02-28");
});

test("Meu Dia usa a data de São Paulo mesmo quando o aparelho está em UTC", () => {
  const fusoAnterior = process.env.TZ;
  process.env.TZ = "UTC";
  try {
    const agora = Date.parse("2026-09-22T01:00:00.000Z"); // 21/09 22:00 em São Paulo
    assert.equal(venceHoje({ proxima_acao_em: "2026-09-22T02:30:00.000Z" }, agora), true);
    assert.equal(venceHoje({ proxima_acao_em: "2026-09-22T12:00:00.000Z" }, agora), false);
  } finally {
    if (fusoAnterior === undefined) delete process.env.TZ;
    else process.env.TZ = fusoAnterior;
  }
});

test("somarDias opera só no calendário, inclusive em virada de mês, ano e bissexto", () => {
  assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(somarDias("2027-01-01", -1), "2026-12-31");
  assert.equal(somarDias("2026-01-31", 1), "2026-02-01");
  assert.equal(somarDias("2028-02-28", 1), "2028-02-29");
  assert.equal(somarDias("2026-02-28", 1), "2026-03-01");
  assert.equal(somarDias("2026-09-17", -5), "2026-09-12");
  assert.equal(somarDias("2026-09-17", 0), "2026-09-17");
  assert.equal(somarDias("17/09/2026", 1), "");
  assert.equal(fimDoMes("2028-02-10"), "2028-02-29");
  assert.equal(fimDoMes("2026-12-01"), "2026-12-31");
});

test("datetime-local mostra e interpreta a hora de parede de São Paulo", () => {
  const instante = new Date("2027-01-01T02:30:00.000Z");
  assert.equal(paraDatetimeLocal(instante), "2026-12-31T23:30");
  assert.equal(instante.toISOString().slice(0, 16), "2027-01-01T02:30"); // 3h à frente: o bug antigo
  assert.equal(deDatetimeLocal("2026-12-31T23:30").toISOString(), "2027-01-01T02:30:00.000Z");
  assert.equal(deDatetimeLocal(paraDatetimeLocal(new Date("2026-09-17T15:45:00.000Z"))).toISOString(), "2026-09-17T15:45:00.000Z");
  assert.equal(deDatetimeLocal("2026-02-30T10:00").getTime(), Number.NaN);
  assert.ok(Number.isNaN(deDatetimeLocal("").getTime()));
});

test("helpers não dependem do fuso do processo", () => {
  // O resultado é o mesmo com TZ=UTC (servidor) ou TZ=America/Sao_Paulo (navegador).
  const instante = new Date("2026-09-18T02:30:00.000Z");
  assert.equal(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(instante), hojeOperacao(instante));
});
