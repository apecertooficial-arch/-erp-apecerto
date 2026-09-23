import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../supabase/migrations/20260923150353_gerente_conflitos_escopo.sql", import.meta.url), "utf8");

test("corretor consulta somente seu gerente, sem nomes de carteiras alheias", () => {
  assert.match(sql, /if auth\.uid\(\) is null then/);
  assert.match(sql, /errcode = '42501', message = 'sem_permissao'/);
  assert.match(sql, /public\.papel_no_grupo\('gestao'\)/);
  assert.match(sql, /c\.usuario_id = auth\.uid\(\)/);
  assert.match(sql, /p_gerente is distinct from public\.corretor_gerente\(v_corretor_id\)/);
  assert.match(sql, /case when v_gestao or v\.corretor_id = v_corretor_id then v\.cliente_nome else null end/);
  assert.match(sql, /case when v_gestao or v\.corretor_id = v_corretor_id then v\.id else null end/);
  assert.match(sql, /case when v_gestao or v\.corretor_id = v_corretor_id then v\.corretor_id else null end/);
  assert.match(sql, /revoke all on function public\.gerente_conflitos/);
});
