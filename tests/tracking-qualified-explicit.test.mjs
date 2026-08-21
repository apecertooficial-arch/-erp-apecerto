import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/funil2/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260821190000_tracking_qualified_explicit_transition.sql", import.meta.url), "utf8");

test("LeadQualificado nasce da ação explícita do Funil e não de trigger oculto", () => {
  assert.match(route, /tracking_register_qualified_transition/);
  assert.match(route, /momentoAnterior/);
  assert.match(migration, /private\.enqueue_meta_crm_event\(/);
  assert.match(migration, /'qualified'/);
  assert.match(migration, /CONVERSANDO_QUALIFICANDO/);
  assert.doesNotMatch(migration, /create\s+trigger/i);
  assert.doesNotMatch(migration, /(?:insert\s+into|update|delete\s+from)\s+(?:private\.)?lead_attribution/i);
});
