import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260828165000_alertas_fila_destino_e_diagnostico_presenca.sql", import.meta.url),
  "utf8",
);
const route = readFileSync(new URL("../app/api/presenca/route.ts", import.meta.url), "utf8");
const heartbeat = readFileSync(new URL("../app/features/presence/PresenceHeartbeat.tsx", import.meta.url), "utf8");

test("fila envelhecida com zero elegiveis cria um unico alerta ligado a execution_id", () => {
  assert.match(migration, /motor_alertar_fila_sem_elegiveis/);
  assert.match(migration, /p_execution_id bigint/);
  assert.match(migration, /criado_em\s*>\s*p_agora\s*-\s*interval '5 minutes'/);
  assert.match(migration, /coalesce\(p_tentativas,0\)\s*<\s*3/);
  assert.match(migration, /execution_id\s*\)\s*values[\s\S]*p_execution_id/);
  assert.match(migration, /not exists\([\s\S]*n\.execution_id=p_execution_id/);
  assert.match(migration, /'central:zero-elegiveis:'\|\|p_execution_id::text/);
});

test("retry continua ativo e o alerta e resolvido quando a execucao volta a ter sucesso", () => {
  assert.match(migration, /WAITING_FOR_ELIGIBLE_BROKER/);
  assert.match(migration, /due_at=now\(\)\+make_interval\(secs=>v_delay\)/);
  assert.match(migration, /perform public\.motor_alertar_fila_sem_elegiveis/);
  assert.match(migration, /perform public\.motor_resolver_alerta_fila\(r\.id,'fila_retomada'\)/);
  assert.match(migration, /perform public\.motor_resolver_alerta_fila\(r\.id,'automacao_inativa'\)/);
  assert.match(migration, /perform public\.motor_resolver_alerta_fila\(r\.id,'fila_encerrada_com_erro'\)/);
  assert.doesNotMatch(migration, /status='erro'[\s\S]{0,180}DISTRIBUTION_UNAVAILABLE/);
});

test("telefone ausente bloqueia antes de preflight, partes e transporte externo", () => {
  assert.match(migration, /if v_tel='' then/);
  assert.match(migration, /if v_exec!~'\^\[1-9\]\[0-9\]\*\$' then/);
  assert.match(migration, /perform public\.motor_alertar_destino_ausente/);
  assert.match(migration, /'Abordagem bloqueada: destino ausente; nenhuma chamada externa realizada'/);
  assert.match(migration, /position\('if v_tel='''' then' in v_new\)/);
  assert.match(migration, /position\('v_preflight:=' in v_new\)/);
  assert.match(migration, /position\('if v_tel='''' then' in v_new\)\s*>\s*position\('v_preflight:=' in v_new\)/);
  assert.match(migration, /not exists\([\s\S]*n\.execution_id=p_execution_id[\s\S]*n\.tipo='qualidade_dados'/);
  assert.doesNotMatch(migration, /AUTOMATION_RETRY:[^\n]*destino/i);
  assert.equal((migration.match(/perform public\.motor_alertar_destino_ausente\(/g) ?? []).length, 1);
});

test("funcoes operacionais permanecem fechadas e a migracao nao publica automacao", () => {
  for (const signature of [
    "motor_alertar_fila_sem_elegiveis",
    "motor_resolver_alerta_fila",
    "motor_alertar_destino_ausente",
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature}`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature}[\\s\\S]*to service_role`));
  }
  assert.doesNotMatch(migration, /update public\.automacoes|insert into public\.automacao_versoes/i);
  assert.doesNotMatch(migration, /cron\.schedule|net\.http|http_post/i);
});

test("diagnostico de presenca e somente leitura, mascarado e orienta a confirmacao", () => {
  assert.match(route, /diagnostico_ip/);
  assert.match(route, /criarDiagnosticoPresenca/);
  assert.doesNotMatch(route, /diagnostico_ip[\s\S]{0,120}\bip\s*:/);
  assert.match(heartbeat, /diagnostico_ip/);
  assert.match(heartbeat, /ip_mascarado/);
  assert.match(heartbeat, /observado_em/);
  assert.match(heartbeat, /orientacao/);
});
