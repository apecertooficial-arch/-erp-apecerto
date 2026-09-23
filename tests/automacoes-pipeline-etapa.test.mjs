import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20260923180000_automacoes_exigem_pipeline_etapa_validos.sql");
const builder = read("../app/features/automations/automationBuilderRuntime.js");

test("construtor exige funil e etapa antes de publicar ação de negócio", () => {
  assert.match(builder, /\['create-business-action','move-business-action'\]\.includes\(a\.name\)/);
  assert.match(builder, /Ação de negócio precisa de funil e etapa/);
});

test("runtime falha se a etapa não existir ou não pertencer ao funil", () => {
  assert.match(migration, /act_name in \('create-business-action','move-business-action'\)/);
  assert.match(migration, /join public\.pipeline_stages s on s\.pipeline_id = p\.id/);
  assert.match(migration, /where p\.id = v_pipe[\s\S]*s\.id = v_stage/);
  assert.match(migration, /'acao','erro'/);
  assert.match(migration, /AUTOMATION_PIPELINE_STAGE_UNAVAILABLE/);
  assert.match(migration, /continue;/);
});

