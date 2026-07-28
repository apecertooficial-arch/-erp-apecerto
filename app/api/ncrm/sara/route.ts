/**
 * Sara para o CRM Nova Era — SUGESTÃO apenas (suggestion-only).
 * ---------------------------------------------------------------------------
 * - Reutiliza a inteligência existente (edge function `ia-router`, provedor/chave
 *   server-side). NENHUMA chave de IA no frontend.
 * - A Sara NÃO altera etapa, NÃO envia WhatsApp, NÃO cria visita/proposta.
 * - Persistir a sugestão como evento ncrm (classificacao_sara) exige papel `sara`
 *   (app_metadata.app_role='sara') — isso é feito por um edge function privilegiado,
 *   NÃO por esta rota (que roda com o JWT do corretor). Aqui só geramos e devolvemos.
 * - Rejeição (POST) registra feedback via telemetria existente (perf_log_sessao).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const SCHEMA_PROMPT =
  "Você é a Sara, co-piloto comercial imobiliário. Analise a conversa/lead e responda SOMENTE um JSON " +
  "com as chaves: etapa_sugerida, temperatura, intencao_detectada, proxima_acao, prazo_sugerido, " +
  "objecoes (array), risco_abandono (baixo|medio|alto), possibilidade_visita (baixa|media|alta), " +
  "possibilidade_proposta (baixa|media|alta), justificativa, confianca (0..1), evidencias (array de trechos). " +
  "Você apenas sugere; o humano decide. Não invente dados.";

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

export async function GET(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const nid = Number(new URL(request.url).searchParams.get("negocio"));
  if (!Number.isFinite(nid)) return Response.json({ error: "negocio inválido" }, { status: 400 });

  // Contexto mínimo visível ao usuário (RLS). Nome do lead para orientar a Sara.
  const db = supabase as unknown as SupabaseClient;
  const { data: estado } = await db
    .from("ncrm_estado")
    .select("negocio_id,etapa,respondeu,tentativas_feitas,negocios(lead_id,leads(nome))")
    .eq("negocio_id", nid)
    .maybeSingle();
  if (!estado) return Response.json({ error: "Lead não visível." }, { status: 404 });

  const nome =
    (estado as { negocios?: { leads?: { nome?: string } } }).negocios?.leads?.nome ?? `Negócio ${nid}`;

  // Reutiliza a MESMA inteligência do ERP (edge function ia-router). Chave fica server-side.
  const { data, error } = await supabase.functions.invoke("ia-router", {
    body: {
      agente_nome: "Sara",
      override_prompt: SCHEMA_PROMPT,
      lead_id: (estado as { negocios?: { lead_id?: number } }).negocios?.lead_id ?? null,
      messages: [{ role: "user", content: `Analise o lead "${nome}" (negócio ${nid}) e produza a sugestão estruturada.` }],
    },
  });

  if (error) {
    // Ex.: função sem chave configurada => degrada com clareza, sem quebrar a UI.
    return Response.json({ error: "Sara indisponível (verifique a configuração da IA no ambiente).", detalhe: error.message }, { status: 503 });
  }
  // ia-router pode devolver { ok:false, reason:'sem_chave' } ou um texto/JSON.
  const raw = (data ?? {}) as Record<string, unknown>;
  let sugestao: unknown = raw.json ?? raw.result ?? raw.resposta ?? raw;
  if (typeof sugestao === "string") {
    try { sugestao = JSON.parse(sugestao); } catch { /* mantém string */ }
  }
  return Response.json({ ok: true, negocio: nid, sugestao });
}

export async function POST(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }

  // Feedback de rejeição para melhoria futura (telemetria existente; não escreve em ncrm_*).
  await supabase.rpc("perf_log_sessao", { p_tipo: "ncrm_sara_feedback" }).then(
    () => null,
    () => null, // fire-and-forget
  );
  return Response.json({ ok: true, registrado: true, decisao: body.decisao ?? "rejeitada" });
}
