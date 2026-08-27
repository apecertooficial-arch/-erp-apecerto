import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixture = JSON.parse(await readFile(new URL('./fixtures/meta-lead-ads-aratans.sanitized.json', import.meta.url), 'utf8'));
const dryRun = await readFile(new URL('../supabase/verificacao/20260827_aratans_enriquecimento_dry_run.sql', import.meta.url), 'utf8');
const makePlan = await readFile(new URL('../docs/ciclo3-make-aratans.md', import.meta.url), 'utf8');
const mirunaMonitor = await readFile(new URL('../supabase/verificacao/20260827_miruna_distribution_monitor.sql', import.meta.url), 'utf8');
const mirunaEngine = await readFile(new URL('../supabase/migrations/20260825103724_central_dia_operacional_e_sara_interna.sql', import.meta.url), 'utf8');

test('fixture sanitizado cobre a hierarquia Meta completa sem PII', () => {
  for (const key of ['meta_lead_id', 'meta_form_id', 'meta_page_id', 'meta_campaign_id', 'meta_adset_id', 'meta_ad_id']) {
    assert.match(fixture[key], /^\d+$/);
  }
  for (const forbidden of ['nome', 'name', 'email', 'telefone', 'phone']) {
    assert.equal(Object.hasOwn(fixture, forbidden), false);
  }
});

test('dry-run exige seis linhas e hierarquia 1:1, trava linhas e sempre reverte', () => {
  assert.match(dryRun, /^begin;/m);
  assert.match(dryRun, /v_missing <> 6/);
  assert.match(dryRun, /v_campaign_count[\s\S]*<> 1/);
  assert.match(dryRun, /v_adset_count[\s\S]*<> 1/);
  assert.match(dryRun, /for update/);
  assert.match(dryRun, /rollback;/);
  assert.doesNotMatch(dryRun, /\bcommit\s*;/i);
  assert.doesNotMatch(dryRun, /select[\s\S]{0,80}(?:email|telefone|meta_lead_id)/i);
});

test('plano do Make mapeia IDs do mesmo bundle e não autoriza publicação', () => {
  assert.match(makePlan, /"meta_campaign_id": "\{\{4\.campaignId\}\}"/);
  assert.match(makePlan, /"meta_adset_id": "\{\{4\.adsetId\}\}"/);
  assert.match(makePlan, /"meta_ad_id": "\{\{4\.adId\}\}"/);
  assert.match(makePlan, /não publicado/i);
});

test('motor mantém indisponibilidade visível e limitada, sem loop silencioso', () => {
  assert.match(mirunaEngine, /AUTOMATION_RETRY: DISTRIBUTION_UNAVAILABLE/);
  assert.match(mirunaEngine, /WAITING_FOR_ELIGIBLE_BROKER/);
  assert.match(mirunaEngine, /v_delay:=least\(300/);
  assert.match(mirunaEngine, /r\.tentativas=0 or mod\(r\.tentativas\+1,30\)=0/);
});

test('monitor Miruna é somente leitura e classifica alertas de 15 e 60 minutos', () => {
  assert.match(mirunaMonitor, /ALERTA_15_MIN/);
  assert.match(mirunaMonitor, /CRITICO_60_MIN/);
  assert.match(mirunaMonitor, /DISTRIBUTION_UNAVAILABLE/);
  assert.doesNotMatch(mirunaMonitor, /\b(?:insert|update|delete|merge|call)\b\s+(?:into\s+)?(?:public|private)\./i);
});
