import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const draft = readFileSync(
  new URL(
    '../docs/erp-reestruturacao/P0_REENTRADA_PROTECAO_DONO_DRAFT.sql',
    import.meta.url,
  ),
  'utf8',
);
const builder = readFileSync(
  new URL('../app/features/automations/automationBuilderRuntime.js', import.meta.url),
  'utf8',
);
const moduleHardening = readFileSync(
  new URL(
    '../supabase/migrations/20260820171225_central_automacoes_modulos_atomicos.sql',
    import.meta.url,
  ),
  'utf8',
);

test('entrada usa telefone e e-mail como chaves fortes concorrentes', () => {
  const materialization = draft.match(
    /CREATE OR REPLACE FUNCTION public\.motor_materializar_entrada[\s\S]*?REVOKE ALL ON FUNCTION public\.motor_materializar_entrada/,
  )?.[0] ?? '';

  assert.match(materialization, /motor_ingresso:telefone:/);
  assert.match(materialization, /motor_ingresso:email:/);
  assert.match(materialization, /regexp_replace\([\s\S]*l\.telefone/);
  assert.match(materialization, /lower\(pg_catalog\.btrim\(l\.email\)\)=v_email/);
  assert.match(materialization, /array_agg\(DISTINCT l\.id/);
  assert.match(materialization, /LEAD_IDENTITY_CONFLICT/);
  assert.match(materialization, /LEAD_IDENTITY_DIVERGENCE/);
  assert.doesNotMatch(materialization, /l\.nome\s*=/);
});

test('nome não une homônimos e contato forte ausente falha fechado', () => {
  assert.match(draft, /LEAD_WITHOUT_STRONG_CONTACT/);
  assert.match(draft, /v_nome text/);
  assert.match(draft, /coalesce\(v_nome,'Lead'\)/);
  assert.match(draft, /Não inclui telefone, e-mail ou nome na exceção\/log/);
});

test('proteção consulta Agenda e Esteira canônicas sem tratar negócio aberto como negociação', () => {
  const protection = draft.match(
    /CREATE OR REPLACE FUNCTION private\.motor_motivo_protecao_dono[\s\S]*?REVOKE ALL ON FUNCTION private\.motor_motivo_protecao_dono/,
  )?.[0] ?? '';

  assert.match(protection, /FROM public\.f2_negociacao fn/);
  assert.match(protection, /fn\.etapa<>'perdida'/);
  assert.match(protection, /FROM public\.f2_visita fv/);
  assert.match(protection, /fv\.status IN \('agendada','confirmada'\)/);
  assert.match(protection, /fv\.status='realizada'/);
  assert.doesNotMatch(protection, /n\.status\s*=\s*'aberto'/);
  assert.match(protection, /FROM public\.visitas vi/);
  assert.match(protection, /RETURN NULL/);
});

test('mapas novos protegem negociação e mapas antigos continuam legíveis', () => {
  assert.match(builder, /\['negociacao','visita_agendada','visita_realizada'\]/);
  assert.match(builder, /\['negociacao','Negociação ativa'\]/);
  assert.match(builder, /\['venda','Negociação\/venda \(mapa antigo\)'\]/);
  assert.match(draft, /v_protecao \? 'negociacao' OR v_protecao \? 'venda'/);
});

test('lead protegido continua no próximo bloco em vez de encerrar a automação', () => {
  assert.match(moduleHardening, /elsif tipo='distribution-simple'/);
  assert.match(moduleHardening, /select motor_roleta/);
  assert.match(moduleHardening, /if _dist_cor is null/);
  assert.match(moduleHardening, /cur:=b#>>'\{options,nextBlockId\}'/);
  assert.match(builder, /'send-approach'/);
});

test('draft é transacional, service-only e aborta quando a roleta diverge', () => {
  assert.match(draft, /^-- P0[\s\S]*DRAFT NÃO APLICADO/);
  assert.match(draft, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(draft, /motor_roleta_anchor_divergente/);
  assert.match(draft, /FROM PUBLIC,anon,authenticated/);
  assert.match(draft, /TO service_role/);
});
