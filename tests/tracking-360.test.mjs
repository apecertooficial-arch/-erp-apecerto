import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTrackingLink } from "../app/features/tracking/tracking-link.ts";

const files = {
  page: await readFile(new URL("../app/(erp)/tracking/page.tsx", import.meta.url), "utf8"),
  api: await readFile(new URL("../app/api/tracking-360/route.ts", import.meta.url), "utf8"),
  ui: await readFile(new URL("../app/features/tracking/Tracking360Workspace.tsx", import.meta.url), "utf8"),
  journey: await readFile(new URL("../app/features/tracking/TrackingLeadJourney.tsx", import.meta.url), "utf8"),
  links: await readFile(new URL("../app/features/tracking/TrackingLinkBuilder.tsx", import.meta.url), "utf8"),
  linkUtil: await readFile(new URL("../app/features/tracking/tracking-link.ts", import.meta.url), "utf8"),
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
  assert.match(files.linkUtil, /utm_source/);
  assert.match(files.linkUtil, /utm_medium/);
  assert.match(files.linkUtil, /utm_campaign/);
  assert.match(files.linkUtil, /campaign_id/);
  assert.match(files.linkUtil, /adset_id/);
  assert.match(files.linkUtil, /ad_id/);
  assert.match(files.linkUtil, /form_id/);
  assert.match(files.linkUtil, /tracking_ref/);
});

test("gerador recusa campanha indefinida e UTMs técnicas inválidas", () => {
  const missingCampaign = buildTrackingLink({
    channel: "meta",
    base: "https://apecerto.com/",
    campaign: "",
    trackingRef: "ac-facebook-teste",
  });
  assert.equal(missingCampaign.ok, false);

  const malformedId = buildTrackingLink({
    channel: "google",
    base: "https://apecerto.com/imoveis",
    campaign: "Busca Moema Agosto 2026",
    campaignId: "GTM-524TZP8X",
    trackingRef: "ac-google-teste",
  });
  assert.equal(malformedId.ok, false);
});

test("gerador normaliza campanha e preserva a hierarquia confiável", () => {
  const result = buildTrackingLink({
    channel: "meta",
    base: "https://apecerto.com/imoveis?quartos=2&utm_source=antigo",
    campaign: "Miruna 449 · Form Lead · Ago/26",
    campaignId: "120253551407260616",
    adsetId: "120253551407250616",
    adId: "120253551407240616",
    formId: "1689299132153969",
    trackingRef: "ac-facebook-miruna-449",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const url = new URL(result.link);
  assert.equal(url.searchParams.get("utm_source"), "facebook");
  assert.equal(url.searchParams.get("utm_medium"), "paid_social");
  assert.equal(url.searchParams.get("utm_campaign"), "miruna-449-form-lead-ago-26");
  assert.equal(url.searchParams.get("campaign_id"), "120253551407260616");
  assert.equal(url.searchParams.get("adset_id"), "120253551407250616");
  assert.equal(url.searchParams.get("ad_id"), "120253551407240616");
  assert.equal(url.searchParams.get("form_id"), "1689299132153969");
  assert.equal(url.searchParams.get("quartos"), "2");
});

test("gerador aceita canais canônicos de Google, orgânico e parceiro sem exigir IDs", () => {
  const cases = [
    { channel: "google", source: "google", medium: "cpc" },
    { channel: "organico", source: "apecerto", medium: "organic" },
    { channel: "parceiro", source: "parceiro", medium: "partner" },
  ];
  for (const item of cases) {
    const result = buildTrackingLink({
      channel: item.channel,
      base: "https://apecerto.com/imoveis",
      campaign: `Teste ${item.channel}`,
      trackingRef: `ac-${item.channel}-teste`,
    });
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    const url = new URL(result.link);
    assert.equal(url.searchParams.get("utm_source"), item.source);
    assert.equal(url.searchParams.get("utm_medium"), item.medium);
  }
});
