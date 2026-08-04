import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20260812020000_funil_2_notificacao_lead_novo.sql", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/features/funil-2/Funil2Workspace.tsx", import.meta.url), "utf8");

test("lead novo do Funil 2 gera notificacao urgente sem dado pessoal no push", () => {
  assert.match(migration, /'primeira_abordagem_pendente','corretor',1/);
  assert.match(migration, /'\/negocio\/'\|\|NEW\.origem_negocio_id/);
  assert.match(migration, /PERFORM ncrm_private\.push_enfileirar\(200\)/);
  assert.match(migration, /EXCEPTION WHEN OTHERS/);
  assert.doesNotMatch(migration, /NEW\.nome|NEW\.telefone/);
});

test("notificacao resolve quando primeira abordagem deixa de estar pendente", () => {
  assert.match(migration, /NEW\.etapa <> 'novo'/);
  assert.match(migration, /NEW\.ultima_acao_confirmada_em IS NOT NULL/);
  assert.match(migration, /resolvida_em=COALESCE\(resolvida_em,now\(\)\)/);
});

test("trigger nao fica executavel pelo navegador", () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC,anon,authenticated/);
  assert.match(migration, /has_function_privilege\('authenticated'/);
});

test("toque no push abre automaticamente a ficha F2 do negocio", () => {
  assert.match(workspace, /url\.searchParams\.get\("lead"\)/);
  assert.match(workspace, /item\.origem_negocio_id === negocioId/);
  assert.match(workspace, /setSelecionado\(destino\.id\)/);
});
