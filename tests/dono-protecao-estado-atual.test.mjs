import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime = readFileSync(new URL("../app/features/automations/automationBuilderRuntime.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260923162000_dono_protegido_so_estado_atual.sql", import.meta.url), "utf8");
const resolver = migration.split("do $patch_motor_roleta$")[0];

test("construtor grava somente visita e negociação como proteção fixa", () => {
  assert.match(runtime, /dd\.protecao=\['negociacao','visita_agendada'\]/);
  assert.match(runtime, /Histórico encerrado não bloqueia uma redistribuição autorizada/);
  assert.doesNotMatch(runtime, /\['visita_realizada','Visita realizada'\]/);
  assert.doesNotMatch(runtime, /Sempre manter o dono \(nunca redistribui\)/);
});

test("banco centraliza a proteção no estado comercial atual", () => {
  assert.match(migration, /create or replace function public\.motor_resolver_dono_ativo/);
  assert.match(migration, /in \('agendada','confirmada'\)/i);
  assert.match(migration, /f2_negociacao/);
  assert.match(migration, /motor_resolver_dono_ativo\(p_lead_id,p_lead\)/);
  assert.match(migration, /motor_dono_tem_estado_protegido\(n\.lead_id\)/);
  assert.doesNotMatch(resolver, /vi\.status[^\n]*realizada/i);
  assert.doesNotMatch(resolver, /fv\.status[^\n]*realizada/i);
});

test("funções novas e alteradas continuam fechadas para clientes", () => {
  assert.match(migration, /revoke all on function public\.motor_resolver_dono_ativo[\s\S]*from public,anon,authenticated/i);
  assert.match(migration, /grant execute on function public\.motor_resolver_dono_ativo[\s\S]*to service_role/i);
  assert.match(migration, /revoke all on function public\.motor_dono_tem_estado_protegido[\s\S]*from public,anon,authenticated/i);
  assert.match(migration, /revoke all on function public\.motor_roleta[\s\S]*from public,anon,authenticated/i);
  assert.match(migration, /revoke all on function ncrm_private\.sla_redistribuir[\s\S]*from public,anon,authenticated/i);
});
