/**
 * Sara — DECISÃO HUMANA sobre uma análise automática (Fase 3, P0-C).
 * POST { analiseId, decisao: "aprovada"|"rejeitada", justificativa? }
 *   -> ncrm_sara_decidir_analise (authenticated + pode_operar, fail-closed).
 * Marca a decisão e registra evento auditável classificacao_sara vinculado à análise.
 * NÃO muta operacional. JWT real do usuário; nunca service_role.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

export async function POST(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  const analiseId = Number(body.analiseId);
  if (!Number.isInteger(analiseId) || analiseId <= 0) return Response.json({ error: "analiseId inválido." }, { status: 422 });
  const decisao = body.decisao === "aprovada" ? "aprovada" : body.decisao === "rejeitada" ? "rejeitada" : null;
  if (!decisao) return Response.json({ error: "decisao inválida (aprovada|rejeitada)." }, { status: 422 });
  const justificativa = typeof body.justificativa === "string" ? body.justificativa.slice(0, 500) : null;

  const { data, error } = await db.rpc("ncrm_sara_decidir_analise", { p_analise_id: analiseId, p_decisao: decisao, p_justificativa: justificativa });
  if (error) return Response.json({ ok: false, error: "Falha ao registrar a decisão." }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) return Response.json({ ok: false, erro: res.erro }, { status: res.erro === "sem_permissao" || res.erro === "nao_autenticado" ? 403 : 409 });
  return Response.json(data);
}
