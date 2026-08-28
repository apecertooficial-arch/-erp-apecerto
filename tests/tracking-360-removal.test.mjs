import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("Tracking 360 não possui mais rota, API, tela ou estilos no ERP", () => {
  for (const path of [
    "app/(erp)/tracking/page.tsx",
    "app/api/tracking-360/route.ts",
    "app/features/tracking/Tracking360Workspace.tsx",
    "app/features/tracking/TrackingLeadJourney.tsx",
    "app/features/tracking/TrackingLinkBuilder.tsx",
    "app/features/tracking/tracking-link.ts",
    "app/styles/tracking-360.css",
  ]) assert.equal(existsSync(new URL(path, root)), false, `${path} ainda existe`);

  const moduleMap = read("app/features/system/module-map.ts");
  const routes = read("app/features/system/erp-routes.ts");
  const shell = read("app/components/AppShell.tsx");
  const layout = read("app/layout.tsx");
  assert.doesNotMatch(moduleMap, /Tracking 360/);
  assert.doesNotMatch(routes, /\/tracking|Tracking 360/);
  assert.doesNotMatch(shell, /Tracking 360/);
  assert.doesNotMatch(layout, /tracking-360\.css/);
});

test("Central de Comando não depende das RPCs removidas", () => {
  const api = read("app/api/central-comando/route.ts");
  const prototype = read("public/central-comando/prototype.html");
  assert.doesNotMatch(api, /tracking_360_/);
  assert.match(api, /central_comando_site_marketing/);
  assert.match(api, /central_comando_atribuicao_marketing/);
  assert.match(api, /central_comando_qualidade_dados/);
  assert.doesNotMatch(prototype, /<span class="cc-navlabel">Tracking<\/span>/);
});

test("migração remove somente a camada gerencial e preserva dados operacionais", () => {
  const migration = read("supabase/migrations/20260828104449_remover_tracking_360.sql");
  for (const name of [
    "tracking_360_dashboard",
    "tracking_360_attribution_scope",
    "tracking_360_quality",
    "tracking_360_lead_search",
    "tracking_360_lead_journey",
  ]) assert.match(migration, new RegExp(`drop function if exists public\\.${name}`));

  assert.doesNotMatch(migration, /drop table/i);
  assert.doesNotMatch(migration, /drop function if exists public\.tracking_register_qualified_transition/i);
  assert.doesNotMatch(migration, /drop function if exists public\.tracking_delivery_/i);
  assert.doesNotMatch(migration, /drop function if exists public\.tracking_lead_attribution/i);
  assert.match(migration, /update public\.agente_fontes/);
  assert.match(migration, /Menu principal: Inicio; Central de Comando; CRM - Meu Dia; Produtos; Financeiro\./);
});
