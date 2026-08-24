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
