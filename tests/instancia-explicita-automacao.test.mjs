import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL(
  '../supabase/migrations/20260824152416_instancia_explicita_no_bloco_abordagem.sql',
  import.meta.url,
), 'utf8');
const builder = readFileSync(new URL(
  '../app/features/automations/automationBuilderRuntime.js',
  import.meta.url,
), 'utf8');
const relogio = readFileSync(new URL(
  '../supabase/migrations/20260824153625_relogio_sem_regra_negocio_sara.sql',
  import.meta.url,
), 'utf8');

test('instância de campanha é publicada no bloco e não em cron oculto', () => {
  assert.match(migration, /instanciaPorCorretor/);
  assert.match(migration, /bloco sem instancia explicita publicada/);
  assert.match(migration, /i\.id=v_inst_explicita/);
  assert.match(migration, /Claudia Normal Iphone/);
  assert.match(migration, /like '%3785'/);
  assert.doesNotMatch(migration, /cron\.schedule|create\s+trigger|pg_cron/i);
});

test('construtor mostra e valida uma instância exata para cada corretor', () => {
  assert.match(builder, /Instância exata por corretor/);
  assert.match(builder, /data-sapinst/);
  assert.match(builder, /instanciaPorCorretor/);
  assert.match(builder, /não existe troca automática/);
  assert.match(builder, /Escolha a instância exata de/);
});

test('restauração não desvincula a instância do iPhone do sistema', () => {
  assert.match(migration, /set corretor_id=v_corretor_id,\s*ativa=true/s);
  assert.match(migration, /values \(v_corretor_id,v_iphone_id\),\(v_corretor_id,v_3785_id\)/);
  assert.doesNotMatch(migration, /delete from public\.corretor_instancias/);
});

test('relógio apenas acorda a Sara e não escolhe o lote', () => {
  assert.match(relogio, /sara_checagem_diaria\(null\)/);
  assert.match(relogio, /checagem-diaria-trigger/);
  assert.match(relogio, /replace\([\s\S]*sara_checagem_diaria\(12\)[\s\S]*sara_checagem_diaria\(null\)/);
  assert.doesNotMatch(relogio, /cron\.schedule/i);
});
