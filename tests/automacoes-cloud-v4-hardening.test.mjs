import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const central = readFileSync(new URL("../app/features/automations/AutomationsCentralCloudV4.tsx", import.meta.url), "utf8");
const builder = readFileSync(new URL("../app/features/automations/AutomationFlowBuilderV4.tsx", import.meta.url), "utf8");
const model = readFileSync(new URL("../app/features/automations/automationFlowModel.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/styles/central-automacoes-cloud-v4.css", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260825183530_central_automacoes_integridade_produto_e_experiencia.sql", import.meta.url), "utf8");

test("construtor preserva integridade, concorrência e histórico", () => {
  assert.match(model, /storedBlocks\.length \? storedBlocks/);
  assert.match(builder, /CONFLICT_DRAFT_CHANGED/);
  assert.match(builder, /atualizada_em=eq/);
  assert.match(builder, /const undo/);
  assert.match(builder, /const redo/);
  assert.match(builder, /Histórico de versões/);
});

test("produto é contexto de primeira classe na criação e na abordagem", () => {
  assert.match(builder, /Entrada de novo produto/);
  assert.match(builder, /produto_id: newProductId/);
  assert.match(builder, /item\.produto_id === approachProductId/);
  assert.match(central, /Produto não vinculado/);
  assert.match(migration, /add column if not exists produto_id bigint/);
  assert.match(migration, /automacoes_produto_fk/);
});

test("modos avançados usam dados e contratos reais", () => {
  assert.match(builder, /simulateFlow/);
  assert.match(builder, /diffFlows/);
  assert.match(builder, /selectedRunId/);
  assert.match(builder, /selectedExceptionId/);
  assert.match(builder, /automacao_versoes/);
  assert.doesNotMatch(model, /lines: \["1  Vídeo", "2  Texto"\]/);
});

test("navegação é persistente e exclusão definitiva só existe na lixeira", () => {
  assert.match(central, /window\.history\.pushState/);
  assert.match(central, /popstate/);
  assert.match(central, /item\.arquivada && <button[^>]+is-danger/);
  assert.match(central, /Restaurar da lixeira/);
});

test("migração fecha permissões e vínculos sem apagar órfãos", () => {
  assert.match(migration, /automacao_versoes_automacao_fk/);
  assert.match(migration, /motor_execucoes_automacao_fk/);
  assert.match(migration, /motor_fila_automacao_fk/);
  assert.match(migration, /not valid/);
  assert.doesNotMatch(migration, /jsonb_object_length/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all on function public\.automacao_explicar/);
  assert.doesNotMatch(migration, /editor_possui_bloco_sem_runtime/);
  assert.match(migration, /legado_sem_produto/);
  assert.match(builder, /Automação legada preservada/);
});

test("mobile mantém validar e publicar visíveis", () => {
  assert.match(css, /\.apf-top-actions \.apf-outline \{ display: inline-flex/);
  assert.match(css, /\.apf-topbar \{ height: 112px/);
});
