import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  page: await readFile(new URL("../app/(erp)/tracking/page.tsx", import.meta.url), "utf8"),
  api: await readFile(new URL("../app/api/tracking-360/route.ts", import.meta.url), "utf8"),
  ui: await readFile(new URL("../app/features/tracking/Tracking360Workspace.tsx", import.meta.url), "utf8"),
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
