import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260825103724_central_dia_operacional_e_sara_interna.sql", import.meta.url),
  "utf8",
);
const verification = readFileSync(
  new URL("../supabase/verificacao/20260825_central_dia_operacional_e_sara.sql", import.meta.url),
  "utf8",
);
const builder = readFileSync(new URL("../app/features/automations/automationBuilderRuntime.js", import.meta.url), "utf8");
const sara = readFileSync(new URL("../supabase/functions/f2-sara-reclassificar/index.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("../supabase/functions/ia-router/index.ts", import.meta.url), "utf8");
const config = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");

test("bloco de distribuição publica a regra do dia operacional no próprio snapshot", () => {
  assert.match(builder, /regraElegibilidade/);
  assert.match(builder, /dia-operacional/);
  assert.match(builder, /09:30/);
  assert.match(builder, /18:30/);
  assert.match(builder, /data-dsregra/);
  assert.match(migration, /Entrada Adelmo/);
  assert.match(migration, /Entrada Miruna/);
  assert.match(migration, /regraElegibilidade/);
  assert.match(migration, /automacao_versoes/);
});

test("presença atual tem prioridade e a madrugada usa o comparecimento do dia operacional", () => {
  assert.match(migration, /motor_corretor_elegibilidade_bloco/);
  assert.match(migration, /grupo_com_presenca_atual/);
  assert.match(migration, /corretor_presencas/);
  assert.match(migration, /dia_operacional/);
  assert.match(migration, /compareceu_no_dia_operacional/);
  assert.match(migration, /presenca_atual_prioritaria/);
  assert.match(verification, /2026-08-25 08:00:00-03/);
  assert.match(verification, /2026-08-25 10:00:00-03/);
  assert.match(verification, /2026-08-25 19:00:00-03/);
  const prioridade = migration.indexOf("if v_grupo_com_presenca_atual then");
  const fimDeSemanaOperacional = migration.indexOf("if coalesce((v_periodo->>'dia_operacional_fim_de_semana')");
  const comparecimento = migration.lastIndexOf("select exists(\n    select 1 from public.corretor_presencas");
  assert.ok(prioridade < fimDeSemanaOperacional);
  assert.ok(fimDeSemanaOperacional < comparecimento);
});

test("falta de corretor é espera persistente, não erro terminal", () => {
  assert.match(migration, /WAITING_FOR_ELIGIBLE_BROKER/);
  assert.match(migration, /AUTOMATION_RETRY: DISTRIBUTION_UNAVAILABLE/);
  assert.match(migration, /status='pendente'/);
  assert.match(migration, /make_interval\(secs=>v_delay\)/);
  assert.match(migration, /f\.criado_em>=timestamptz '2026-08-25 00:00:00-03'/);
});

test("Sara usa autenticação de serviço explícita sem fingir sessão humana", () => {
  assert.match(sara, /headers:\{apikey:SERVICE_ROLE_KEY/);
  assert.doesNotMatch(sara, /Authorization:`Bearer \$\{SERVICE_ROLE_KEY\}`/);
  assert.match(router, /chamadaInterna/);
  assert.match(router, /segredoIgual/);
  assert.match(router, /disable_tools!==true/);
  assert.match(router, /agente_slug!=="sara"/);
  assert.match(config, /\[functions\.ia-router\][\s\S]*verify_jwt = false/);
});
