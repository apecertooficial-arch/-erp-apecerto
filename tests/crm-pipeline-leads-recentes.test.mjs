import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20261002183649_pipeline_leads_recentes_10_dias.sql", import.meta.url),
  "utf8",
);
const ampliacao = await readFile(
  new URL("../supabase/migrations/20261002190621_ampliar_pipeline_leads_recentes_18_dias.sql", import.meta.url),
  "utf8",
);
const workspace = await readFile(
  new URL("../app/features/funil-2/Funil2Workspace.tsx", import.meta.url),
  "utf8",
);

test("corte inclui todo lead dos últimos 10 dias sem filtrar campanha", () => {
  assert.match(migration, /statement_timestamp\(\) - interval '10 days'/i);
  assert.match(migration, /from public\.leads[\s\S]*criado_em >= v_desde[\s\S]*criado_em <= v_agora/i);
  assert.doesNotMatch(migration, /where[^;]*(campanha|origem)\s*=/i);
});

test("funil novo preserva etapas e move lead e negócio na mesma transação", () => {
  assert.match(migration, /Leads recentes — últimos 10 dias/);
  assert.match(migration, /from public\.pipeline_stages[\s\S]*pipeline_id = v_pipeline_origem_id/i);
  assert.match(migration, /update public\.negocios[\s\S]*pipeline_id = v_pipeline_destino_id[\s\S]*stage_id = etapa_destino\.id/i);
  assert.match(migration, /update public\.leads[\s\S]*pipeline_id = v_pipeline_destino_id/i);
});

test("operação falha fechada em conflito, divergência ou etapa sem mapa e deixa auditoria", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /CRM_PIPE_010_DESTINO_EXISTENTE/);
  assert.match(migration, /CRM_PIPE_010_ETAPA_SEM_MAPA/);
  assert.match(migration, /CRM_PIPE_010_CONTAGEM_DIVERGENTE/);
  assert.match(migration, /migrar_leads_recentes_pipeline/);
  assert.match(migration, /filtro_campanha', false/);
});

test("CRM expõe o novo pipeline e limita quadro, carteira e resultados ao recorte escolhido", () => {
  assert.match(workspace, /PIPELINE_LEADS_RECENTES = "Leads recentes — últimos 18 dias"/);
  assert.match(workspace, /negocio\.pipeline === PIPELINE_LEADS_RECENTES/);
  assert.match(workspace, /funilAtivo === "recentes_18_dias"[\s\S]*idsLeadsRecentes\.has/);
  assert.match(workspace, /const leadsDoPeriodo = leadsDoFunil\.filter/);
  assert.match(workspace, /Últimos 18 dias · \{idsLeadsRecentes\.size\}/);
});

test("ampliação move somente o delta dos últimos 18 dias sem filtro de campanha", () => {
  assert.match(ampliacao, /statement_timestamp\(\) - interval '18 days'/i);
  assert.match(ampliacao, /pipeline_id is distinct from v_pipeline_destino_id/i);
  assert.match(ampliacao, /update public\.negocios[\s\S]*stage_id = etapa_destino\.id/i);
  assert.match(ampliacao, /update public\.leads[\s\S]*pipeline_id = v_pipeline_destino_id/i);
  assert.doesNotMatch(ampliacao, /where[^;]*(campanha|origem)\s*=/i);
});

test("ampliação preserva integridade, renomeia a visão e registra auditoria", () => {
  assert.match(ampliacao, /CRM_PIPE_011_NEGOCIO_AMBIGUO/);
  assert.match(ampliacao, /CRM_PIPE_011_ETAPA_SEM_MAPA/);
  assert.match(ampliacao, /CRM_PIPE_011_CONTAGEM_DIVERGENTE/);
  assert.match(ampliacao, /set nome = 'Leads recentes — últimos 18 dias'/);
  assert.match(ampliacao, /ampliar_pipeline_leads_recentes_18_dias/);
  assert.match(ampliacao, /'filtro_campanha', false/);
});
