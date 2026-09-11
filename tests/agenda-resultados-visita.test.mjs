import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { RESULTADOS_VISITA, resultadoPermitido, validarResultadoVisita } from "../app/features/calendar/resultadoVisita.ts";

const apiAgenda = await readFile(new URL("../app/api/agenda/route.ts", import.meta.url), "utf8");
const apiFunil = await readFile(new URL("../app/api/funil2/route.ts", import.meta.url), "utf8");
const agendaWeb = await readFile(new URL("../app/features/calendar/CalendarWorkspace.tsx", import.meta.url), "utf8");
const agendaApp = await readFile(new URL("../app/features/calendar/TelaAgendaMobile.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260911163500_resultado_obrigatorio_visitas.sql", import.meta.url), "utf8");

test("cada desfecho oferece somente motivos compatíveis", () => {
  assert.equal(resultadoPermitido("realizada", "interessado"), true);
  assert.equal(resultadoPermitido("realizada", "cliente_cancelou"), false);
  assert.equal(resultadoPermitido("cancelada", "cliente_cancelou"), true);
  assert.equal(resultadoPermitido("nao_compareceu", "nao_compareceu"), true);
  assert.equal(RESULTADOS_VISITA.nao_compareceu.length, 1);
});

test("resultado exige justificativa útil", () => {
  assert.match(validarResultadoVisita("realizada", "interessado", "curto") ?? "", /pelo menos 10/);
  assert.equal(validarResultadoVisita("realizada", "interessado", "Cliente gostou e pediu retorno amanhã."), null);
});

test("web, app e Funil usam a mesma RPC estruturada", () => {
  assert.match(apiAgenda, /action === "registerVisitResult"/);
  assert.match(apiAgenda, /f2_registrar_resultado_visita/);
  assert.match(apiFunil, /f2_registrar_resultado_visita/);
  assert.match(agendaWeb, /action: "registerVisitResult"/);
  assert.match(agendaApp, /action: "registerVisitResult"/);
  assert.doesNotMatch(agendaWeb, /action: "updateVisitStatus"/);
  assert.doesNotMatch(agendaApp, /action: "updateVisitStatus"/);
});

test("fila mensal considera visita passada e qualquer encerramento incompleto", () => {
  assert.match(migration, /f2_visitas_resultado_pendente/);
  assert.match(migration, /status IN \('agendada','confirmada'\)[\s\S]*fim_em/);
  assert.match(migration, /status IN \('realizada','cancelada','nao_compareceu'\)[\s\S]*resultado_em IS NULL/);
  assert.match(migration, /public\.f2_admin\(\) IS TRUE OR c\.usuario_id=v_uid/);
});

test("histórico separa agendamento da justificativa do resultado", () => {
  assert.match(migration, /resultado_justificativa/);
  assert.match(migration, /resultado_detalhe_codigo/);
  assert.match(migration, /'visita_atualizada'/);
  assert.match(migration, /'justificativa',v_justificativa/);
});
