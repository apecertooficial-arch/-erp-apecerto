import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const tela = ler("../app/features/team/PerformanceWorkspace.tsx");
const funil = ler("../app/features/funil-2/Funil2Workspace.tsx");
const shell = ler("../app/features/system/ErpShell.tsx");
const atividade = ler("../app/features/performance/PerformanceActivityHeartbeat.tsx");
const api = ler("../app/api/performance/route.ts");
const migration = ler("../supabase/migrations/20260815180316_performance_canonica_corretor.sql");
const remocao = ler("../supabase/migrations/20260815182228_remover_performance_legada.sql");

test("existe uma unica Central de Performance e o Funil 2 fica operacional", () => {
  assert.match(tela, /Central de Gestão de Corretores/);
  assert.match(tela, /Trabalho e disciplina/);
  assert.match(tela, /Cobertura dos dados/);
  assert.doesNotMatch(funil, /Performance de Atendimento|PerformanceFunil2|id: "performance"/);
});

test("painel usa somente a RPC canônica", () => {
  assert.match(api, /rpc\("performance_painel"/);
  assert.doesNotMatch(api, /performance_corretores|performance_operacional|performance_extra/);
});

test("atividade mede uso real, visível e sem duplicar abas", () => {
  assert.match(shell, /PerformanceActivityHeartbeat/);
  assert.match(atividade, /document\.visibilityState !== "visible"/);
  assert.match(atividade, /OCIOSO_APOS_MS/);
  assert.match(migration, /primary key \(corretor_id, bloco_em\)/);
  assert.match(migration, /date_bin\(interval '5 minutes'/);
  assert.doesNotMatch(tela, /onlineH|tempo online/i);
});

test("fonte sensível é fechada e as RPCs conferem identidade", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.performance_atividade_app from public, anon, authenticated/);
  assert.match(migration, /v_uid uuid := auth\.uid\(\)/);
  assert.match(migration, /public\.can_manage_all\(\) or c\.id = public\.current_broker_id\(\)/);
});

test("nota não transforma ausência de fonte em zero", () => {
  assert.match(tela, /Sem amostra/);
  assert.match(tela, /Sem captura/);
  assert.match(tela, /Não cadastrada/);
  assert.match(migration, /cobertura_peso/);
  assert.match(migration, /case when b\.ia_avaliacoes >= 5/);
});

test("estrutura antiga é removida sem cascade e derivação útil permanece", () => {
  assert.match(remocao, /cron\.unschedule/);
  assert.match(remocao, /drop table if exists public\.perf_snapshots/);
  assert.match(remocao, /drop function if exists public\.performance_corretores/);
  assert.doesNotMatch(remocao, /cascade/i);
  assert.doesNotMatch(remocao, /perf_derivar_eventos/);
});
