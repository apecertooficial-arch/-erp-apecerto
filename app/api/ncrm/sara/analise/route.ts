/**
 * Sara — ANÁLISES em modo observador (Fase 3, Regra 5).
 * GET  -> ncrm_sara_analises_recentes (admin): últimas análises.
 * POST -> ncrm_sara_registrar_analise: INSERT-ONLY na auditoria. NUNCA muta operacional
 *         (não move lead, não cria visita/proposta, não envia WhatsApp). Validada por schema puro.
 * JWT real do usuário; nunca service_role.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { normalizarAnaliseSara } from "../../../../features/crm-nova-era/lib/saraModo";

export const dynamic = "force-dynamic";
const MAX_ANALISE_BYTES = 8000;

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

async function sessao(request: Request): Promise<{ db: SupabaseClient } | { erro: Response }> {
  const token = tokenDe(request);
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) };
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { erro: Response.json({ error: "Sessão inválida." }, { status: 401 }) };
  return { db: supabase as unknown as SupabaseClient };
}

export async function GET(request: Request) {
  const s = await sessao(request);
  if ("erro" in s) return s.erro;
  const limite = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? "50") || 50));
  const { data, error } = await s.db.rpc("ncrm_sara_analises_recentes", { p_limite: limite });
  if (error) return Response.json({ ok: false, error: "Falha ao ler análises." }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) return Response.json({ ok: false, erro: res.erro }, { status: res.erro === "sem_permissao" ? 403 : 409 });
  return Response.json(data);
}

export async function POST(request: Request) {
  const s = await sessao(request);
  if ("erro" in s) return s.erro;
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  if (JSON.stringify(body).length > MAX_ANALISE_BYTES) return Response.json({ error: "Análise excede o tamanho máximo." }, { status: 413 });
  const norm = normalizarAnaliseSara(body);
  if (!norm.ok || !norm.analise) return Response.json({ error: "Análise inválida.", motivo: norm.erros }, { status: 422 });
  const a = norm.analise;
  const { data, error } = await s.db.rpc("ncrm_sara_registrar_analise", {
    p_negocio_id: a.negocioId, p_etapa_atual: a.etapaAtual, p_etapa_sugerida: a.etapaSugerida,
    p_proxima_acao_sugerida: a.proximaAcaoSugerida, p_prazo_sugerido: a.prazoSugerido,
    p_justificativa: a.justificativa, p_evidencias: a.evidencias, p_confianca: a.confianca,
    p_cliente_aguardando: a.clienteAguardandoResposta, p_promessa_retorno: a.promessaRetorno,
    p_visita_mencionada: a.visitaMencionada, p_proposta_mencionada: a.propostaMencionada, p_versao_prompt: a.versaoPrompt,
  });
  if (error) return Response.json({ ok: false, error: "Falha ao registrar análise." }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) return Response.json({ ok: false, erro: res.erro }, { status: res.erro === "sem_permissao" || res.erro === "nao_autenticado" ? 403 : 409 });
  return Response.json(data);
}
