import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const router = ler("../supabase/functions/ia-router/index.ts");
const migration = ler("../supabase/migrations/20260825012000_sara_operacao_completa_v2.sql");
const widget = ler("../app/components/SaraWidget.tsx");
const lab = ler("../app/features/agents/AgentTrainingWorkspace.tsx");
const api = ler("../app/api/agentes/route.ts");

test("confirmacao e atomica, expira e compara a previa exata", () => {
  assert.match(migration, /create table if not exists public\.sara_previews/i);
  assert.match(migration, /for update/);
  assert.match(migration, /v\.payload<>p_payload/);
  assert.match(migration, /previa_ja_utilizada/);
  assert.match(router, /pending_preview_id/);
  assert.match(widget, /pendingPreviewId/);
});

test("agenda conversacional consulta, detecta conflito, altera e desfaz", () => {
  for (const nome of ["consultar_agenda","alterar_visita","desfazer_acao"]) assert.match(router, new RegExp(nome));
  assert.match(router, /ia_conflitos_visita_seguro/);
  assert.match(router, /userSupabase\.rpc\("f2_salvar_visita"/);
  assert.match(migration, /tstzrange/);
  assert.match(migration, /sara_acoes_audit/);
});

test("WhatsApp exige previa e separa envio de comprovante real", () => {
  assert.match(router, /criarPrevia\("enviar_whatsapp"/);
  assert.match(router, /\/functions\/v1\/dapi-enviar/);
  assert.match(router, /enviado_aguardando_confirmacao/);
  assert.match(router, /consultar_comprovante_whatsapp/);
  assert.match(migration, /status in \('entregue','lida'\)/);
});

test("piloto, satisfacao, metricas e duvidas reais ficam instrumentados", () => {
  assert.match(migration, /sara_piloto_participantes/);
  assert.match(migration, /limit 5/);
  assert.match(widget, /Isso ajudou\?/);
  assert.match(lab, /Tempo economizado/);
  assert.match(lab, /PILOTO CONTROLADO/);
  assert.match(api, /promoverDuvidas/);
  assert.match(api, /anonimizar/);
});

test("novas tabelas sensiveis nao ficam abertas ao Data API", () => {
  assert.match(migration, /revoke all on table public\.sara_previews from public,anon,authenticated/);
  assert.match(migration, /revoke all on table public\.sara_acoes_audit from public,anon,authenticated/);
  assert.match(migration, /grant all on table public\.sara_previews to service_role/);
});
