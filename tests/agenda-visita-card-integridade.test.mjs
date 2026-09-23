import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260923163000_visita_exige_card_original.sql", import.meta.url), "utf8");
const agendaApi = await readFile(new URL("../app/api/agenda/route.ts", import.meta.url), "utf8");

test("edição exige que a visita pertença ao card informado", () => {
  assert.match(migration, /IF p_id IS NOT NULL THEN/);
  assert.match(migration, /FROM public\.f2_visita v[\s\S]*v\.id=p_id[\s\S]*v\.funil_lead_id=p_lead_id[\s\S]*FOR UPDATE/);
  assert.match(migration, /RETURN pg_catalog\.jsonb_build_object\('ok',false,'erro','visita_incompativel'\)/);
});

test("API explica a incompatibilidade sem declarar sucesso", () => {
  assert.match(agendaApi, /visita_incompativel: "Esta visita não corresponde ao atendimento informado\."/);
  assert.match(agendaApi, /chave === "visita_incompativel" \? 409/);
});
