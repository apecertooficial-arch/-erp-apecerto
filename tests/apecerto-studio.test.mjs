import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateGeneratedPackage, validateTemplateManifest } from "../app/features/studio/domain.ts";
import { moduloDoPath, pathDoModulo, podeVer } from "../app/features/system/erp-routes.ts";

const migration = readFileSync(new URL("../supabase/migrations/20260826210311_apecerto_studio_operacional.sql", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/studio/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/features/studio/StudioModule.tsx", import.meta.url), "utf8");
const render = readFileSync(new URL("../workers/studio-renderer/render-engine.mjs", import.meta.url), "utf8");
const renderWorker = readFileSync(new URL("../workers/studio-renderer/index.mjs", import.meta.url), "utf8");
const publisher = readFileSync(new URL("../supabase/functions/social-publisher/index.ts", import.meta.url), "utf8");
const metaOAuth = readFileSync(new URL("../supabase/functions/social-meta-oauth/index.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/styles/apecerto-studio.css", import.meta.url), "utf8");
const catalogMigration = readFileSync(new URL("../supabase/migrations/20260827170000_studio_template_catalog_20.sql", import.meta.url), "utf8");
const collaborationMigration = readFileSync(new URL("../supabase/migrations/20260827180000_studio_collaboration_metrics.sql", import.meta.url), "utf8");

test("Studio é um módulo nativo, roteável e fail-closed", () => {
  assert.equal(pathDoModulo("apêcerto Studio"), "/studio");
  assert.equal(moduloDoPath("/studio/campanha/123"), "apêcerto Studio");
  assert.equal(podeVer("apêcerto Studio", { role: "corretor", permissoes: {}, carregado: true }), false);
  assert.equal(podeVer("apêcerto Studio", { role: "corretor", permissoes: { studio_social: ["ver"] }, carregado: true }), true);
});

test("modelo operacional cobre escopo, snapshots, assets, versões, jobs, agenda, publicação e auditoria", () => {
  for (const table of [
    "social_organizations", "social_memberships", "social_campaigns", "social_briefs",
    "social_product_snapshots", "social_assets", "social_asset_derivatives", "social_templates",
    "social_template_versions", "social_template_slots", "social_pieces", "social_piece_versions",
    "social_generation_jobs", "social_approvals", "social_schedules", "social_publications", "social_audit_events",
    "social_meta_oauth_states",
  ]) assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.%I from anon/);
  assert.match(migration, /social_has_permission\('ver', organization_id\)/);
  const jobs = migration.match(/create table if not exists public\.social_generation_jobs \([\s\S]*?\n\);/)?.[0] ?? "";
  const publications = migration.match(/create table if not exists public\.social_publications \([\s\S]*?\n\);/)?.[0] ?? "";
  assert.equal(jobs.match(/proxima_tentativa_em/g)?.length, 1);
  assert.equal(publications.match(/proxima_tentativa_em/g)?.length, 1);
});

test("produto por código gera snapshot factual sem campos privados", () => {
  assert.match(migration, /lower\(u\.codigo\) = lower\(btrim\(p_product_code\)\)/);
  assert.match(migration, /lower\(e\.codigo\) = lower\(btrim\(p_product_code\)\)/);
  const factBlock = migration.match(/select jsonb_build_object\([\s\S]*?\) into v_facts;/)?.[0] ?? "";
  assert.ok(factBlock.length > 300);
  assert.doesNotMatch(factBlock, /proprietario|contato|acesso_codigo|acesso_instrucoes/i);
  assert.doesNotMatch(migration, /AP0261|setembro de 2026/i);
});

test("originais e históricos são protegidos; planejamento não usa exclusão destrutiva", () => {
  assert.match(migration, /social_snapshots_immutable before update or delete/);
  assert.match(migration, /social_piece_versions_immutable before update or delete/);
  assert.match(migration, /social_approvals_immutable before update or delete/);
  assert.match(migration, /\(storage\.foldername\(name\)\)\[2\] = 'derivados'/);
  assert.doesNotMatch(api, /method:\s*["']DELETE["']/);
});

test("idempotência e aprovação exata são garantidas no banco", () => {
  assert.match(migration, /unique \(organization_id, idempotency_key\)/);
  assert.match(migration, /version_checksum text not null/);
  assert.match(migration, /a\.version_checksum = v\.checksum/);
  assert.match(migration, /p\.current_version_id = v\.id/);
  assert.match(migration, /on conflict \(organization_id, idempotency_key\) do update/);
});

test("publicação exige aprovação humana, integração configurada e confirmação remota", () => {
  const publication = migration.match(/create or replace function public\.social_prepare_publication[\s\S]*?\$\$;/)?.[0] ?? "";
  assert.match(publication, /social_current_piece_approved/);
  assert.match(publication, /provider = 'instagram' and i\.status = 'configurada'/);
  assert.match(migration, /status = 'publicado' and remote_media_id is not null and jsonb_array_length\(remote_media_ids\) > 0 and confirmado_em is not null/);
  assert.match(api, /body\.confirm !== true/);
});

test("custos externos começam bloqueados e IA passa somente pelo ia-router", () => {
  assert.match(migration, /limite_usd numeric\(12,4\) not null default 0/);
  assert.match(migration, /from unnest\(array\['openai','renderer','instagram'\]/);
  assert.match(api, /functions\/v1\/ia-router/);
  assert.doesNotMatch(api, /api\.openai\.com|OPENAI_API_KEY/);
});

test("schema de conteúdo aceita pacote completo e rejeita formato ausente", () => {
  const piece = (formato) => ({ formato, titulo: `Peça ${formato}`, headline: "Mude com leveza", legenda: "Conteúdo factual do imóvel.", cta: "Agende sua visita", alertas_factuais: [], ...(formato === "carousel" ? { slides: [] } : {}), ...(formato === "story" ? { stories: [] } : {}), ...(formato === "reel" ? { cenas: [] } : {}) });
  const valid = validateGeneratedPackage({ estrategia: { objetivo: "Visitas", publico: "Compradores", etapa_funil: "Consideração", angulo_editorial: "Praticidade", pilares: ["Localização"] }, pecas: [piece("feed"), piece("carousel"), piece("story"), piece("reel")], alertas_factuais: [] });
  assert.equal(valid.pecas.length, 4);
  assert.throws(() => validateGeneratedPackage({ estrategia: {}, pecas: [piece("feed")], alertas_factuais: [] }), /formato obrigatório/);
});

test("manifesto Figma é validado e versionado, sem fingir conexão", () => {
  const manifest = validateTemplateManifest({ schema_version: 1, slug: "feed-moema", nome: "Feed Moema", formato: "feed", width: 1080, height: 1350, source: { type: "figma", file_key: "test", node_id: "1:2" }, fonts: ["Quicksand"], slots: [{ key: "imagem_principal", type: "imagem", required: true }, { key: "headline", type: "texto", required: true, limits: { max_chars: 72 } }, { key: "cta", type: "texto", required: true }, { key: "logo", type: "logo", required: true }] });
  assert.equal(manifest.width, 1080);
  assert.match(migration, /'figma'.*'nao_configurada'/s);
  assert.doesNotMatch(ui, /plugin_ready|Figma conectado/i);
});

test("interface é um construtor responsivo e usa apenas tokens oficiais", () => {
  assert.match(ui, /studio-builder-left/);
  assert.match(ui, /studio-canvas-area/);
  assert.match(ui, /studio-inspector/);
  assert.match(css, /@media\(max-width:420px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.match(css, /var\(--ape-orange\)/);
  assert.match(css, /var\(--ape-purple\)/);
});

test("edição humana, renderer backend JPEG/MP4 e aprovação em lote preservam versões", () => {
  assert.match(api, /action === "createVersion"/);
  assert.match(api, /parent_version_id: source\.id/);
  assert.match(api, /action === "enqueueRender"/);
  assert.doesNotMatch(api, /action === "registerRender"/);
  assert.match(ui, /action: "bulkApprove"/);
  assert.match(ui, /Gerar Reel MP4 final/);
  assert.match(render, /"-c:v", "libx264"/);
  assert.match(render, /"yuv420p"/);
  assert.match(render, /Assinatura JPEG inválida/);
  assert.match(render, /Assinatura MP4 inválida/);
  assert.match(renderWorker, /social_service_claim_render_job/);
  assert.match(renderWorker, /social_service_complete_render_job/);
  assert.match(migration, /ffmpeg-worker-v1/);
  assert.doesNotMatch(ui, /storage\.from\("social-studio"\)\.upload/);
});

test("adapter Meta usa token por organização no Vault, publica imagens e Reels e confirma remotamente", () => {
  assert.match(publisher, /x-studio-worker-secret/);
  assert.doesNotMatch(publisher, /META_ACCESS_TOKEN|META_IG_USER_ID/);
  assert.match(publisher, /social_service_read_meta_token/);
  assert.match(publisher, /eq\("organization_id", organizationId\)/);
  assert.match(publisher, /media_publish/);
  assert.match(publisher, /media_type: "REELS"/);
  assert.match(publisher, /fields: "id,media_type,permalink,timestamp"/);
  assert.match(publisher, /partial_story_publish/);
  assert.match(publisher, /proxima_tentativa_em/);
  assert.doesNotMatch(ui, /META_ACCESS_TOKEN|STUDIO_PUBLISHER_SECRET/);
  assert.match(migration, /A versão ainda não possui arquivo final publicável/);
});

test("OAuth Meta é fail-closed, usa state de uso único e nunca devolve token ao cliente", () => {
  assert.match(metaOAuth, /META_OAUTH_ENABLED/);
  assert.match(metaOAuth, /state_hash/);
  assert.match(metaOAuth, /is\("consumed_at", null\)/);
  assert.match(metaOAuth, /gt\("expires_at"/);
  assert.match(metaOAuth, /social_has_permission/);
  assert.match(metaOAuth, /social_service_store_meta_token/);
  assert.match(metaOAuth, /Permissões Meta ausentes/);
  assert.match(metaOAuth, /method: "POST"/);
  assert.match(metaOAuth, /body: new URLSearchParams\(params\)/);
  assert.doesNotMatch(metaOAuth, /searchParams\.set\(["']client_secret/);
  assert.doesNotMatch(metaOAuth, /Response\.json\([^\n]*access_token/);
  assert.match(migration, /vault\.create_secret/);
  assert.match(migration, /revoke all on function public\.social_service_read_meta_token\(uuid\) from public, anon, authenticated/);
});

test("security definer qualifica pgcrypto e workers são exclusivos da service role", () => {
  assert.doesNotMatch(migration, /(?<!extensions\.)digest\(/);
  assert.match(migration, /grant execute on function public\.social_service_claim_render_job\(text,uuid\) to service_role/);
  assert.match(migration, /grant execute on function public\.social_service_complete_render_job\(uuid,text,jsonb\) to service_role/);
  assert.match(migration, /social_template_versions_update/);
});

test("mudança no produto alerta, invalida aprovação e permite novo snapshot", () => {
  assert.match(migration, /create trigger social_product_changed/);
  assert.match(migration, /c\.produto_alterado_em is null/);
  assert.match(migration, /social_refresh_campaign_snapshot/);
  assert.match(ui, /O produto mudou no ERP/);
  assert.match(api, /action === "refreshSnapshot"/);
});

test("fat ia vertical do Studio persiste briefing, variações e deep links", () => {
  assert.match(api, /social_briefs\?\$\{org\}/);
  assert.match(api, /action === "saveBrief"/);
  assert.match(api, /action === "createVariant"/);
  assert.match(api, /parent_version_id/);
  assert.match(api, /social_piece_versions/);
  assert.match(ui, /URLSearchParams\(window\.location\.search\)/);
  assert.match(ui, /window\.history\.replaceState/);
  assert.match(ui, /BriefingEditor/);
  assert.match(ui, /Salvar briefing/);
  assert.match(ui, /Salvar no histórico/);
  assert.match(ui, /Gerar variação/);
  assert.match(ui, /5 modelos editoriais/);
});

test("catálogo visual tem vinte templates versionados e workspace com mídia/histórico", () => {
  assert.match(catalogMigration, /v_format \|\| '-oficial-' /);
  assert.match(catalogMigration, /array\['feed','carousel','story','reel'\]/);
  assert.match(catalogMigration, /for v_variant in 1\.\.5 loop/);
  assert.match(catalogMigration, /layout_variant/);
  assert.match(ui, /TemplateLibrary/);
  assert.match(ui, /Mídias do ERP/);
  assert.match(ui, /Salvar mídia nesta versão/);
  assert.match(ui, /VersionHistory/);
  assert.match(ui, /Comparar/);
  assert.match(ui, /Desfazer/);
  assert.match(ui, /Exportar pacote para Canva/);
  assert.match(ui, /Modelos importados do Figma/);
});

test("copiloto, colaboração, board e métricas têm contratos honestos e RLS", () => {
  for (const table of ["social_piece_tasks", "social_piece_comments", "social_metrics_snapshots"]) assert.match(collaborationMigration, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(collaborationMigration, /enable row level security/g);
  assert.match(collaborationMigration, /social_has_permission\('revisar', organization_id\)/);
  assert.match(api, /action === "addComment"/);
  assert.match(api, /action === "saveTask"/);
  assert.match(ui, /StudioCopilot contextual/);
  assert.match(ui, /preview\/diff/);
  assert.match(ui, /Colaboração e governança/);
  assert.match(ui, /Visão do gestor/);
  assert.match(ui, /Meta não conectada/);
  assert.match(ui, /Sem responsável/);
  assert.match(ui, /Novo horário ISO/);
  assert.match(ui, /moveSchedule/);
  assert.match(ui, /viewMode/);
  assert.match(api, /schedule_conflict/);
  assert.match(ui, /Importar retorno JSON/);
  assert.match(ui, /assets: data\.snapshots/);
  assert.match(api, /importCanvaPackage/);
  assert.match(ui, /StudioManagerBoard/);
  assert.match(ui, /StudioMetricsDashboard/);
  assert.match(ui, /Todas as campanhas/);
  assert.match(ui, /draggable/);
});
