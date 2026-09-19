import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../docs/erp-reestruturacao/P0_ANON_SECURITY_DEFINER_DRAFT.sql", import.meta.url),
  "utf8",
);

const signatures = [...sql.matchAll(/'public\.([^']+)'::regprocedure/g)].map((match) => match[1]);

test("draft cobre exatamente as 47 RPCs SECURITY DEFINER expostas a anon", () => {
  assert.equal(signatures.length, 47);
  assert.equal(new Set(signatures).size, 47);
});

test("contrato remove o grant implícito de PUBLIC e anon das operações internas", () => {
  assert.match(sql, /revoke execute on function %s from public, anon/);
  assert.match(sql, /grant execute on function %s to authenticated, service_role/);
  assert.match(sql, /has_function_privilege\('anon', v_fn, 'execute'\)/);
});

test("somente três endpoints legados por token permanecem públicos temporariamente", () => {
  for (const signature of [
    "agenda_publica(text,date,date)",
    "ficha_publica_enviar(text,jsonb)",
    "ficha_publica_obter(text)",
  ]) {
    const escaped = signature.replace(/[()[\]]/g, "\\$&");
    assert.match(sql, new RegExp(`'public\\.${escaped}'::regprocedure`));
  }
  const publicBlock = sql.match(/v_public_legacy_token[\s\S]*?v_service_only/)?.[0] ?? "";
  assert.equal((publicBlock.match(/::regprocedure/g) ?? []).length, 3);
  assert.match(sql, /Exceções LEGADAS/);
  assert.match(sql, /sem expiração\/rate limit comprovados/);
});

test("DataCrazy e função de trigger ficam apenas no service_role", () => {
  assert.match(sql, /dc_registrar_movimentacao\(jsonb,text\)/);
  assert.match(sql, /trg_corretor_desativado_avisa_carteira\(\)/);
  assert.match(sql, /revoke execute on function %s from public, anon, authenticated/);
  assert.match(sql, /grant execute on function %s to service_role/);
});

test("draft continua fora da pasta de migrations e exige ensaio isolado", () => {
  assert.match(sql, /DRAFT NÃO APLICADO/);
  assert.match(sql, /Supabase\/Postgres isolado/);
  assert.match(sql, /Não existe rollback genérico seguro para PUBLIC/);
});
