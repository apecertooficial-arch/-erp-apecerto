import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260923182000_metricas_feedback_eventos_confirmados.sql", import.meta.url), "utf8");
const agendaWeb = await readFile(new URL("../app/features/calendar/CalendarWorkspace.tsx", import.meta.url), "utf8");
const agendaApp = await readFile(new URL("../app/features/calendar/TelaAgendaMobile.tsx", import.meta.url), "utf8");

test("desempenho parte de um resultado confirmado por visita, não do estado mutável", () => {
  assert.match(migration, /from public\.f2_evento e/i);
  assert.match(migration, /e\.tipo='visita_atualizada'/i);
  assert.match(migration, /e\.payload->>'status'='realizada'/i);
  assert.match(migration, /distinct on \(e\.payload->>'visita_id'\)/i);
  assert.match(migration, /e\.criado_em at time zone 'America\/Sao_Paulo'/i);
  assert.doesNotMatch(migration, /where v\.status='realizada'/i);
});

test("payload expõe recorte, fonte e denominadores absolutos", () => {
  assert.match(migration, /'inicio',v_inicio/);
  assert.match(migration, /'fim',v_fim/);
  assert.match(migration, /'fonte','eventos_confirmados'/);
  assert.match(migration, /'historico_total',v_historico_total/);
  assert.match(migration, /'estruturados_total',v_estruturados_total/);
  assert.match(migration, /'dentro_prazo_total',dentro_prazo_total/);
  assert.match(migration, /revoke all on function public\.f2_feedback_visita_performance\(date,date\)/);
});

test("mobile e desktop mostram período, base avaliada e fração no prazo", () => {
  for (const source of [agendaWeb, agendaApp]) {
    assert.match(source, /formatarRecorteFeedback/);
    assert.match(source, /resultados confirmados/);
    assert.match(source, /dentro_prazo_total/);
    assert.match(source, /no prazo/);
  }
});
