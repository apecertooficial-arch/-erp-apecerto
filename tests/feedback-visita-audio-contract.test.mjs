import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const sqlUrl = new URL("../supabase/migrations/20260924170000_feedback_visita_audio_privado.sql", import.meta.url);
const edgeUrl = new URL("../supabase/functions/f2-feedback-visita-transcrever/index.ts", import.meta.url);
const apiUrl = new URL("../app/api/agenda/route.ts", import.meta.url);
const componentUrl = new URL("../app/features/calendar/FeedbackVisitaAudio.tsx", import.meta.url);
const formUrl = new URL("../app/features/calendar/ResultadoVisitaForm.tsx", import.meta.url);
const desktopUrl = new URL("../app/features/calendar/CalendarWorkspace.tsx", import.meta.url);
const mobileUrl = new URL("../app/features/calendar/TelaAgendaMobile.tsx", import.meta.url);

const sql = await readFile(sqlUrl, "utf8");
const edge = await readFile(edgeUrl, "utf8");
const api = await readFile(apiUrl, "utf8").catch(() => "");
const component = await readFile(componentUrl, "utf8").catch(() => "");
const form = await readFile(formUrl, "utf8");
const desktop = await readFile(desktopUrl, "utf8");
const mobile = await readFile(mobileUrl, "utf8");

test("áudio usa bucket privado e restrito, nunca chat-midia público", () => {
  assert.match(sql, /'visita-feedback-audio'[\s\S]*false/);
  assert.match(sql, /audio\/ogg/);
  assert.match(sql, /audio\/webm/);
  assert.doesNotMatch(sql, /bucket_id\s*=\s*'chat-midia'/);
  assert.doesNotMatch(sql, /for delete to authenticated/i);
});

test("metadado é append-only, vinculado à visita e protegido pelo dono", () => {
  assert.match(sql, /create table public\.f2_visita_feedback_audio/);
  assert.match(sql, /colisao_feedback_audio/);
  assert.match(sql, /visita_id uuid not null references public\.f2_visita\(id\)/);
  assert.match(sql, /sha256 text not null/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /current_broker_id\(\)[\s\S]*funil_lead_id/);
  assert.match(sql, /revoke all on table public\.f2_visita_feedback_audio from public,anon,authenticated/);
  assert.doesNotMatch(sql, /grant\s+(update|delete).*authenticated/i);
});

test("transcrição é service-only, idempotente e preserva falha explícita", () => {
  assert.match(sql, /f2_feedback_audio_reservar/);
  assert.match(sql, /f2_feedback_audio_concluir/);
  assert.match(sql, /grant execute on function public\.f2_feedback_audio_concluir[\s\S]*service_role/i);
  assert.doesNotMatch(sql, /grant execute on function public\.f2_feedback_audio_concluir[^\n]*to authenticated/i);
  assert.match(sql, /unique\s*\(visita_id,sha256\)/i);
  assert.match(sql, /status in \('reservado','enviado','transcrevendo','transcrito','falhou'\)/i);
  assert.match(sql, /proxima_tentativa_em/);
  assert.match(sql, /least\(60/);
  assert.match(sql, /tentativas>=5/);
});

test("Edge valida segredo, hash e tamanho antes de enviar à transcrição", () => {
  assert.match(edge, /x-cron-secret/);
  assert.match(edge, /timingSafeEqual/);
  assert.match(edge, /CRON_SECRET/);
  assert.match(edge, /const UUID = \/\^\[0-9a-f\]/);
  assert.match(edge, /storage\.from\(BUCKET\)\.download/);
  assert.match(edge, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(edge, /AbortSignal\.timeout/);
  assert.match(edge, /f2_feedback_audio_concluir/);
  assert.match(edge, /from\("app_secrets"\)\.select\("valor"\)\.eq\("chave","OPENAI_API_KEY"\)/);
  assert.doesNotMatch(edge, /console\.(log|error)\([^)]*(transcricao|texto|audio)/i);
});

test("capacidade e consulta são owner-scoped e falham fechadas antes da migration", () => {
  assert.match(sql, /f2_feedback_audio_consultar/);
  assert.match(sql, /f2_pode_acessar_audio_visita\(p_visita_id\)/);
  assert.match(sql, /'disponivel',coalesce\([\s\S]*f2_visita_feedback_audio_config/);
  assert.match(api, /feedbackAudioVisitaId/);
  assert.match(api, /disponivel:\s*false/);
});

test("upload passa pela API autenticada, calcula hash e preserva RLS do usuário", () => {
  assert.match(api, /export async function POST/);
  assert.match(api, /uploadVisitFeedbackAudio/);
  assert.match(api, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(api, /f2_feedback_audio_reservar/);
  assert.match(api, /storage\.from\("visita-feedback-audio"\)/);
  assert.match(api, /bucket\.upload\(/);
  assert.match(api, /f2_feedback_audio_marcar_enviado/);
  assert.doesNotMatch(api, /createServerSupabaseServiceClient/);
});

test("desktop e aplicativo compartilham gravador fail-closed e exigem confirmação da transcrição", () => {
  assert.match(component, /startOpusRecorder/);
  assert.match(component, /disponivel !== true/);
  assert.match(component, /Usar no resumo adicional/);
  assert.match(component, /onConfirmarTranscricao/);
  assert.match(form, /FeedbackVisitaAudio/);
  assert.match(desktop, /visitId=\{resultadoPendente\.id\}/);
  assert.match(mobile, /visitId=\{resultadoPendente\.id\}/);
});

test("dispatcher é service-only, limitado, desligado por padrão e reutiliza o segredo da Sara", () => {
  assert.match(sql, /f2_visita_feedback_audio_config/);
  assert.match(sql, /values\(true,false,5\)/i);
  assert.match(sql, /f2_feedback_audio_tick/);
  assert.match(sql, /if v_cfg\.enabled is not true then/i);
  assert.match(sql, /ncrm_sara_cron_secret/);
  assert.match(sql, /vault\.decrypted_secrets/);
  assert.match(sql, /net\.http_post/);
  assert.match(sql, /x-cron-secret/);
  assert.match(sql, /limit v_cfg\.lote/i);
  assert.match(sql, /grant execute on function public\.f2_feedback_audio_tick\(\) to service_role/i);
  assert.doesNotMatch(sql, /grant execute on function public\.f2_feedback_audio_tick\(\)[^\n]*authenticated/i);
});

test("reserva fica fechada até o cutover explícito", () => {
  assert.match(sql, /enabled\) then[\s\S]*'audio_indisponivel'/i);
});
