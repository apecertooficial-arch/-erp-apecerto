import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const api = readFileSync(new URL("../app/api/agenda/route.ts", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/migrations/20260923144200_visita_local_canonico.sql", import.meta.url), "utf8");
const sqlEdicao = readFileSync(new URL("../supabase/migrations/20260923144511_visita_local_edicao.sql", import.meta.url), "utf8");

test("agendamento grava o Local junto com a visita canonica", () => {
  assert.match(api, /rpc\("f2_salvar_visita_local"/);
  assert.match(api, /p_local:\s*local/);
  assert.match(sql, /add column if not exists local text/);
  assert.match(sql, /coalesce\(nullif\(btrim\(v\.local\),'?'\),v_local,v\.imovel\)/);
  assert.match(sql, /update public\.f2_visita set local=v_local/);
  assert.match(sql, /and funil_lead_id=p_lead_id/);
  assert.match(sql, /raise exception 'F2_VISITA_LOCAL_NAO_PERSISTIDO'/);
  assert.match(sql, /revoke all on function public\.f2_salvar_visita_local/);
});

test("edicao preserva ou limpa o Local na mesma transacao", () => {
  assert.match(api, /select\("id,negocio_id,data,hora_inicio,hora_fim,produto,empreendimento_id,unidade,local,observacoes/);
  assert.match(api, /p_gerente_id: merged\.gerente_id, p_local: patch\.local !== undefined \? patch\.local : canonical\?\.local \?\? null/);
  assert.match(sqlEdicao, /if coalesce\(v_result->>'ok','false'\) <> 'true' then/);
  assert.match(sqlEdicao, /update public\.f2_visita set local=v_local/);
  assert.doesNotMatch(sqlEdicao, /or v_local is null/);
});
