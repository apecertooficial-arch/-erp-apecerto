import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/capture/route.ts", import.meta.url), "utf8");
const wizard = readFileSync(new URL("../app/features/products/CaptureWizard.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/features/products/ProductDetail.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("../app/features/products/capture-client.ts", import.meta.url), "utf8");

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

test("leituras de duplicidade, condomínio, mídia e ownership não viram decisão falsa", () => {
  for (const operacao of [
    "carregar_produto_aprovacao",
    "carregar_captacao",
    "carregar_midias_captacao",
    "buscar_produto_duplicado",
    "buscar_condominio_existente",
  ]) assert.match(route, new RegExp(`falhaCaptacao\\([^\\n]+, "${operacao}"\\)`));
});

test("gravações comprovam o efeito e parcialidade exige reconciliação", () => {
  assert.match(route, /function falhaCaptacaoParcial\(/);
  assert.match(route, /code:\s*"RECONCILIATION_REQUIRED"/);
  assert.match(route, /finalizar_empreendimento/);
  assert.match(route, /reparar_captador_unidades/);
  assert.match(route, /criar_empreendimento/);
  assert.match(route, /criar_unidades/);
  assert.match(route, /\.select\("id"\)/);
  assert.match(route, /if \(!development\?\.id\)/);
  assert.match(route, /createdUnits\?\.length !== unitRows\.length/);
});

test("interface da captação trata resposta inválida e não exibe falha técnica arbitrária", () => {
  assert.match(client, /export async function captureResponse\(/);
  assert.match(client, /CAPTURE_SAFE_CODES/);
  assert.doesNotMatch(wizard, /mediaError\.message/);
  assert.doesNotMatch(wizard, /arquivosComFalha\.push\([^\n]*reason\.message/);
  assert.match(wizard, /captureFailureMessage\(reason/);
  assert.match(detail, /captureResponse\(response/);
});
