/**
 * Sara para o CRM Nova Era — SUGESTÃO apenas (suggestion-only), no CONTRATO REAL.
 * ---------------------------------------------------------------------------
 * - Usa o MESMO contrato do ia-router já em produção (app/api/agentes/copiloto-lead):
 *   POST {NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ia-router com { agente_slug:"sara", input, override_prompt }.
 *   A Edge Function usa as ferramentas reais (consultar_lead / avaliar_conversa: mensagens,
 *   áudios transcritos, avaliações), com a chave server-side. NENHUMA chave de IA no frontend.
 * - Resposta validada/normalizada por schema explícito (saraSchema). Se não for JSON válido
 *   no formato esperado => FALHA CONTROLADA (nunca devolve string/JSON cru como sugestão).
 * - A Sara NÃO altera etapa, NÃO envia WhatsApp, NÃO cria visita/proposta.
 * - POST (aceitar/rejeitar): persiste o feedback e SÓ responde "registrado" se persistiu.
 *   O evento auditável classificacao_sara (que exige papel `sara`) é persistido pela edge
 *   function service_role `ncrm-ingest` (fora do JWT do corretor) — ver docs.
 */
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { normalizarSugestaoSara } from "../saraSchema";
import { inteiroPositivo, textoLimitado } from "../validate";

export const dynamic = "force-dynamic";

const MAX_SUGESTAO_BYTES = 6000; // limita o tamanho total do JSON da sugestão

/** Hash estável (djb2) para idempotência por sugestão+decisão. */
function hashEstavel(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const OVERRIDE =
  "Você é a Sara, co-piloto comercial imobiliário da Apecerto. Use as ferramentas consultar_lead e " +
  "avaliar_conversa (mensagens reais, áudios transcritos e avaliações). Responda SOMENTE um JSON válido " +
  "com as chaves: etapa_sugerida (novo|tentando_contato|em_atendimento|em_acompanhamento), " +
  "temperatura (frio|morno|quente|negociando), intencao_detectada, proxima_acao (1 frase concreta), " +
  "prazo_sugerido (ISO 8601), objecoes (array), risco_abandono (baixo|medio|alto), " +
  "possibilidade_visita (baixa|media|alta), possibilidade_proposta (baixa|media|alta), justificativa, " +
  "confianca (0..1), evidencias (array de trechos reais da conversa). Nada além do JSON. Você apenas sugere.";

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

/** Chama o ia-router no contrato real e devolve o valor cru da IA (saida/resposta). */
async function chamarIaRouter(token: string, input: string): Promise<{ ok: true; raw: unknown } | { ok: false; erro: string }> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return { ok: false, erro: "supabase_url_ausente" };
  try {
    const r = await fetch(`${base}/functions/v1/ia-router`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ agente_slug: "sara", input, override_prompt: OVERRIDE }),
    });
    if (!r.ok) return { ok: false, erro: `ia_router_http_${r.status}` };
    const j = (await r.json()) as Record<string, unknown>;
    if (j && (j as { ok?: boolean }).ok === false) return { ok: false, erro: String((j as { reason?: string }).reason ?? "ia_indisponivel") };
    // contrato real: { saida: object } ou { resposta: string com JSON }
    const raw = (j && typeof (j as { saida?: unknown }).saida === "object") ? (j as { saida: unknown }).saida : (j as { resposta?: unknown }).resposta ?? j;
    return { ok: true, raw };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "falha_de_rede" };
  }
}

export async function GET(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const nid = inteiroPositivo(new URL(request.url).searchParams.get("negocio"));
  if (nid === null) return Response.json({ error: "negocio inválido" }, { status: 422 });

  // Contexto visível ao usuário (RLS): nome do lead para orientar a ferramenta consultar_lead.
  const db = supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
  const { data: estado } = await db.from("ncrm_estado").select("negocio_id,negocios(lead_id,leads(nome,telefone))").eq("negocio_id", nid).maybeSingle();
  if (!estado) return Response.json({ error: "Lead não visível." }, { status: 404 });
  const leadObj = (estado as { negocios?: { leads?: { nome?: string; telefone?: string } } }).negocios?.leads ?? null;
  const input = (leadObj?.nome || leadObj?.telefone || `negócio ${nid}`) as string;

  void supabase.rpc("perf_log_sessao", { p_tipo: "ncrm_sara_pergunta" }).then(() => {}, () => {});

  const ia = await chamarIaRouter(token, input);
  if (!ia.ok) return Response.json({ error: "Sara indisponível no momento.", motivo: ia.erro }, { status: 503 });

  const norm = normalizarSugestaoSara(ia.raw);
  if (!norm.ok) return Response.json({ error: "A Sara não retornou uma sugestão válida.", motivo: norm.erro }, { status: 422 });

  return Response.json({ ok: true, negocio: nid, sugestao: norm.sugestao });
}

export async function POST(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }

  const decisao = body.decisao === "aceita" ? "aceita" : body.decisao === "rejeitada" ? "rejeitada" : null;
  if (!decisao) return Response.json({ error: "decisao inválida (aceita|rejeitada)" }, { status: 422 });
  const negocioId = inteiroPositivo(body.negocioId);
  if (negocioId === null) return Response.json({ error: "negocio inválido" }, { status: 422 });
  const sugestao = (body.sugestao && typeof body.sugestao === "object" && !Array.isArray(body.sugestao)) ? body.sugestao : null;
  if (!sugestao) return Response.json({ error: "sugestão inválida" }, { status: 422 });
  // Limite de tamanho: não aceitar objeto arbitrário enorme.
  const sugestaoStr = JSON.stringify(sugestao);
  if (sugestaoStr.length > MAX_SUGESTAO_BYTES) return Response.json({ error: "sugestão excede o tamanho máximo permitido." }, { status: 413 });
  // Revalida a sugestão pelo MESMO schema explícito do GET.
  const norm = normalizarSugestaoSara(sugestao);
  if (!norm.ok) return Response.json({ error: "sugestão inválida para persistência.", motivo: norm.erro }, { status: 422 });
  const confianca = norm.sugestao.confianca;
  const justificativa = textoLimitado(body.justificativa, 500);
  const baseVersao = inteiroPositivo(body.baseVersao) ?? 1;
  // Idempotência ESTÁVEL por (decisão, negócio, sugestão): mesma decisão sobre a mesma sugestão não duplica.
  const idem = `sara:${decisao}:${negocioId}:${hashEstavel(sugestaoStr)}`;

  // Persiste a DECISÃO HUMANA de forma AUDITÁVEL via RPC autenticada (pode_operar no banco).
  // registrado=true SÓ depois da persistência real. Sem engolir erro.
  const db = supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
  const { data, error } = await db.rpc("ncrm_registrar_decisao_sara", {
    p_negocio_id: negocioId, p_base_versao: baseVersao, p_decisao: decisao,
    p_sugestao: sugestao, p_confianca: confianca, p_justificativa: justificativa, p_idem: idem,
  });
  if (error) return Response.json({ ok: false, error: "Falha ao registrar a decisão da Sara.", detalhe: error.message }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) return Response.json({ ok: false, erro: res.erro, error: "Decisão não permitida." }, { status: 409 });

  return Response.json({ ok: true, registrado: true, decisao, justificativa });
}
