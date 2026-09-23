import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/capture/route.ts", import.meta.url), "utf8");
const wizard = readFileSync(new URL("../app/features/products/CaptureWizard.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/features/products/ProductDetail.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("../app/features/products/capture-client.ts", import.meta.url), "utf8");
const atomicMigration = readFileSync(new URL("../supabase/migrations/20260923193000_captacao_proprietario_atomica.sql", import.meta.url), "utf8");

test("Captação não devolve nem registra detalhes brutos de banco, Storage ou RPC", () => {
  assert.match(route, /function falhaCaptacao\(/);
  assert.match(route, /console\.error\("captacao_operacao_falhou", \{\s*operacao,\s*codigo:/);
  assert.doesNotMatch(route, /Response\.json\(\{ error: (?:error|[a-z]+Error)\??\.message/i);
  assert.doesNotMatch(route, /publication:\s*result/);
  assert.doesNotMatch(route, /match\?\.\[2\]\s*\?\?\s*raw/);
});

test("autenticação, papel e vínculo do corretor falham fechados", () => {
  assert.match(route, /if \(authError\) return falhaCaptacao\(authError, "autenticar"\)/);
  assert.match(route, /if \(!authData\.user\).*status: 401/);
  assert.match(route, /data: approver, error: approverError/);
  assert.match(route, /if \(approverError\) return falhaCaptacao\(approverError, "carregar_papel_aprovador"\)/);
  assert.match(route, /if \(brokerError\) return falhaCaptacao\(brokerError, "carregar_corretor"\)/);
});

test("leituras usadas na aprovação não viram decisão falsa", () => {
  for (const operacao of [
    "carregar_produto_aprovacao",
  ]) assert.match(route, new RegExp(`falhaCaptacao\\([^\\n]+, "${operacao}"\\)`));
});

test("criação e finalização da captação usam uma única operação transacional", () => {
  assert.match(route, /rpc\("produto_captacao_criar_atomica"/);
  assert.match(route, /rpc\("produto_captacao_finalizar_atomica"/);
  const createBlock = route.match(/if \(payload\.action !== "create"\)[\s\S]*?return Response\.json\(result\);/)?.[0] ?? "";
  assert.doesNotMatch(createBlock, /from\("(?:condominios|proprietarios|empreendimentos|unidades)"\)\.(?:insert|update)/);
  const finalizeBlock = route.match(/if \(payload\.action === "finalize"\)[\s\S]*?^  \}/m)?.[0] ?? "";
  assert.doesNotMatch(finalizeBlock, /from\("(?:empreendimentos|unidades)"\)\.update/);
});

test("RPC atômica fixa autoria, proprietário e captador antes de devolver sucesso", () => {
  assert.match(atomicMigration, /create or replace function public\.produto_captacao_criar_atomica\(p_payload jsonb\)/i);
  assert.match(atomicMigration, /perform pg_catalog\.pg_advisory_xact_lock/);
  assert.equal((atomicMigration.match(/perform pg_catalog\.pg_advisory_xact_lock/g) ?? []).length, 2);
  assert.match(atomicMigration, /v_lock_a := 'capture-address\|'/);
  assert.match(atomicMigration, /v_lock_b := 'capture-name\|'/);
  assert.match(atomicMigration, /pg_catalog\.translate[\s\S]*áàâãä/);
  assert.match(atomicMigration, /produto_proprietario_captacao_resolver/);
  assert.match(atomicMigration, /captado_por_usuario[\s\S]*v_uid/);
  assert.match(atomicMigration, /captador_corretor_id[\s\S]*v_corretor_id/);
  assert.match(atomicMigration, /create or replace function public\.produto_captacao_finalizar_atomica\(p_empreendimento_id uuid\)/i);
  assert.match(atomicMigration, /CAPTURE_OWNER_REQUIRED/);
  assert.match(atomicMigration, /revoke all on function public\.produto_captacao_criar_atomica\(jsonb\)/i);
  assert.match(atomicMigration, /grant execute on function public\.produto_captacao_criar_atomica\(jsonb\) to authenticated/i);
});

test("interface da captação trata resposta inválida e não exibe falha técnica arbitrária", () => {
  assert.match(client, /export async function captureResponse\(/);
  assert.match(client, /CAPTURE_SAFE_CODES/);
  assert.doesNotMatch(wizard, /mediaError\.message/);
  assert.doesNotMatch(wizard, /arquivosComFalha\.push\([^\n]*reason\.message/);
  assert.match(wizard, /captureFailureMessage\(reason/);
  assert.match(detail, /captureResponse\(response/);
});
