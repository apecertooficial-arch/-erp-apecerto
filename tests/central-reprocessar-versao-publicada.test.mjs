import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20260824195800_reprocessar_quarentena_na_versao_publicada.sql', import.meta.url),
  'utf8',
);

test('reprocessamento em versao atual e explicito, bloqueado apos qualquer envio e auditado', () => {
  assert.match(migration, /central_reprocessar_fila_versao_publicada/);
  assert.match(migration, /public\.can_manage_all\(\)/);
  assert.match(migration, /status<>'erro'/);
  assert.match(migration, /motor_mensagem_partes[\s\S]*execution_id=p_fila_id::text/);
  assert.match(migration, /versao_original_sem_abordagem/);
  assert.match(migration, /automacao_validar_mapa\(v_auto\.mapa\)/);
  assert.match(migration, /automacao_versao_id=v_auto\.versao_publicada_id/);
  assert.match(migration, /REPROCESSAMENTO_EXPLICITO_NA_VERSAO_PUBLICADA/);
  assert.match(migration, /insert into public\.motor_execucoes/);
});
