import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  page: await readFile(new URL("../app/(erp)/tracking/page.tsx", import.meta.url), "utf8"),
  api: await readFile(new URL("../app/api/tracking-360/route.ts", import.meta.url), "utf8"),
  ui: await readFile(new URL("../app/features/tracking/Tracking360Workspace.tsx", import.meta.url), "utf8"),
  journey: await readFile(new URL("../app/features/tracking/TrackingLeadJourney.tsx", import.meta.url), "utf8"),
  links: await readFile(new URL("../app/features/tracking/TrackingLinkBuilder.tsx", import.meta.url), "utf8"),
  migration: await readFile(new URL("../supabase/migrations/20260822170000_tracking_360_jornada_lead.sql", import.meta.url), "utf8"),
  routes: await readFile(new URL("../app/features/system/erp-routes.ts", import.meta.url), "utf8"),
};

test("Tracking 360 é uma rota gerencial real e protegida", () => {
  assert.match(files.page, /GuardaModulo modulo="Tracking 360"/);
  assert.match(files.routes, /"Tracking 360": \{ path: "\/tracking", slugs: \["auditoria"\]/);
  assert.match(files.api, /tracking_360_dashboard/);
  assert.match(files.api, /tracking_360_attribution_scope/);
  assert.match(files.api, /Cache-Control.*no-store/);
});

test("painel mostra agregados e não solicita PII", () => {
  assert.doesNotMatch(files.api, /select\([^)]*(telefone|email|nome)/i);
  assert.match(files.ui, /Visão executiva/);
  assert.match(files.ui, /Site e intenção/);
  assert.match(files.ui, /CRM e Meta/);
  assert.match(files.ui, /Saúde técnica/);
});

test("jornada por lead é gerencial, determinística e somente leitura", () => {
  assert.match(files.api, /tracking_360_lead_search/);
  assert.match(files.api, /tracking_360_lead_journey/);
  assert.match(files.ui, /Jornada do lead/);
  assert.match(files.journey, /Site sem vínculo determinístico/);
  assert.match(files.migration, /private\.site_events_anon/);
  assert.match(files.migration, /private\.tracking_delivery_logs/);
  assert.doesNotMatch(files.migration, /(?:insert\s+into|update|delete\s+from)\s+private\.lead_attribution/i);
  assert.doesNotMatch(files.migration, /create\s+(?:constraint\s+)?trigger|cron\.schedule/i);
  assert.match(files.migration, /revoke all.*from public, anon/i);
});

test("gerador cria referências diferentes por origem e mantém IDs de mídia", () => {
  assert.match(files.ui, /Links rastreáveis/);
  assert.match(files.links, /utm_source/);
  assert.match(files.links, /utm_medium/);
  assert.match(files.links, /utm_campaign/);
  assert.match(files.links, /campaign_id/);
  assert.match(files.links, /adset_id/);
  assert.match(files.links, /ad_id/);
  assert.match(files.links, /form_id/);
  assert.match(files.links, /tracking_ref/);
});
