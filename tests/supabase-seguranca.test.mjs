import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20260814210000_views_respeitam_rls.sql", import.meta.url), "utf8");
const datacrazyCronMigration = readFileSync(
  new URL("../supabase/migrations/20260814220000_neutralizar_crons_datacrazy_desativados.sql", import.meta.url),
  "utf8",
);

const views = [
  "vw_sla_leads",
  "f2_cards_sem_historico",
  "vw_ranking_vgv",
  "leads_duplicados",
  "telefones_sem_whatsapp",
  "f2_carga_resumo",
  "f2_sara_pontos_cegos",
  "site_produtos",
];

test("views sinalizadas executam com RLS do chamador", () => {
  for (const view of views) {
    assert.match(migration, new RegExp(`alter view public\\.${view} set \\(security_invoker = true\\)`));
  }
});

test("catálogo anônimo continua limitado a produto publicado e aprovado", () => {
  assert.match(migration, /create policy empreendimentos_select_publicados[\s\S]*to anon[\s\S]*publicado and not rascunho and aprovacao = 'aprovado'/);
  assert.match(migration, /create policy midias_select_produto_publicado/);
  assert.match(migration, /create policy unidades_select_produto_publicado/);
});

test("migration de segurança não remove tabelas nem dados", () => {
  const sql = migration.replace(/^\s*--.*$/gm, "");
  assert.doesNotMatch(sql, /\b(?:drop|delete|truncate)\b/i);
});

test("crons DataCrazy aposentados são neutralizados pela API do pg_cron", () => {
  const jobs = [
    "datacrazy_sync_atividades",
    "datacrazy_sync_leads",
    "datacrazy_sync_negocios",
    "datacrazy_sync_stages",
  ];

  for (const job of jobs) assert.match(datacrazyCronMigration, new RegExp(`'${job}'`));
  assert.match(datacrazyCronMigration, /cron\.alter_job\([\s\S]*active := false/);
  assert.doesNotMatch(datacrazyCronMigration, /update\s+cron\.job/i);
  assert.doesNotMatch(datacrazyCronMigration, /x-sync-token|authorization['"]?\s*[:,]/i);
});
