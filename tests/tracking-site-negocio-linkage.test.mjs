import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260908183500_tracking_site_negocio_linkage.sql', import.meta.url),
  'utf8',
);

test('negocio criado ou reutilizado completa o vinculo do lead do site', () => {
  assert.match(migration, /after insert or update of ultima_movimentacao on public\.negocios/i);
  assert.match(migration, /l\.extras->>'site_lead_id'/);
  assert.match(migration, /crm_negocio_id = new\.id/);
  assert.match(migration, /s\.crm_negocio_id is null/);
  assert.match(migration, /s\.crm_lead_id is null or s\.crm_lead_id = new\.lead_id/);
});

test('backfill altera somente correspondencias inequivocas', () => {
  assert.match(migration, /negocios_abertos = 1 then negocio_aberto_id/);
  assert.match(migration, /total_negocios = 1 then negocio_unico_id/);
  assert.match(migration, /SITE_NEGOCIO_LINKAGE_BACKFILL_INCOMPLETE/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.site_leads/i);
});
