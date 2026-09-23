import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260923171000_feedback_proxima_acao_explicita.sql", import.meta.url),
  "utf8",
);

test("resultado da visita preserva no card a próxima ação informada", () => {
  assert.match(migration, /v_proxima_acao text/);
  assert.match(migration, /split_part\(split_part\([\s\S]{0,80}v_justificativa,' \| Próxima ação: ',2[\s\S]{0,40}\),' \| ',1\)/);
  assert.match(migration, /acao_rotulo=left\(v_proxima_acao,120\)/);
  assert.match(migration, /'proxima_acao_rotulo',v_proxima_acao/);
});

test("backfill usa somente feedback estruturado e mantém legado honesto", () => {
  assert.match(migration, /resultado_justificativa like 'FEEDBACK_VISITA_V1 \|%'/);
  assert.match(migration, /coalesce\(fonte\.proxima_acao,'Registrar a próxima ação pós-visita'\)/);
  assert.match(migration, /normalizar_proxima_acao_pos_visita/);
  assert.match(migration, /f\.acao_rotulo='Definir o próximo avanço'/);
});

test("preflight impede a categoria ambígua de sobreviver", () => {
  assert.match(migration, /F2_ACAO_POS_VISITA_AINDA_AMBIGUA/);
  assert.match(migration, /momento_codigo='ACOMPANHAMENTO_POS_VISITA'/);
});
