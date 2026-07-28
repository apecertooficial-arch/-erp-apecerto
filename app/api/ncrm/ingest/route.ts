/**
 * Controle ADMINISTRATIVO do ingest (kill-switch da reconciliação) — SEMPRE autenticado.
 * Usa o JWT REAL do usuário; valida a sessão com auth.getUser(token); NUNCA usa service_role.
 * A autorização dura (admin/executivo via can_manage_all) é reforçada no banco pelas RPCs
 * ncrm_status_ingest / ncrm_ativar_ingest / ncrm_desativar_ingest (SECURITY DEFINER, fail-closed).
 *
 * GET  -> status atual (ncrm_status_ingest)
 * POST { action: "ativar" }    -> ncrm_ativar_ingest(true)      (ativo_desde = agora; nunca arbitrário no frontend)
 * POST { action: "desativar" } -> ncrm_desativar_ingest(true)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

const ERRO_HUMANO: Record<string, string> = {
  nao_autenticado: "Sessão inválida. Faça login novamente.",
  sem_permissao: "Apenas administradores podem operar o ingest.",
  confirmacao_obrigatoria: "Confirmação explícita é obrigatória.",
  ativo_desde_retroativo_nao_permitido: "Ativação retroativa não é permitida.",
  ativo_desde_futuro_invalido: "Data de ativação inválida.",
};

async function sessao(request: Request) {
  const token = tokenDe(request);
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) };
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error } = await supabase.auth.getUser(token);
  if (error || !auth.user) return { erro: Response.json({ error: "Sessão inválida." }, { status: 401 }) };
  return { db: supabase as unknown as SupabaseClient };
}

/** Mapeia a resposta da RPC (ok:false/erro) para HTTP + mensagem clara, sem vazar detalhes internos. */
function resposta(data: unknown, rpcError: { message: string } | null) {
  if (rpcError) return Response.json({ ok: false, error: "Falha ao consultar o ingest." }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) {
    const status = res.erro === "sem_permissao" || res.erro === "nao_autenticado" ? 403 : 409;
    return Response.json({ ok: false, erro: res.erro, mensagem: (res.erro && ERRO_HUMANO[res.erro]) || "Operação não permitida." }, { status });
  }
  return Response.json(data);
}

export async function GET(request: Request) {
  const s = await sessao(request);
  if (s.erro) return s.erro;
  const { data, error } = await s.db.rpc("ncrm_status_ingest");
  return resposta(data, error);
}

export async function POST(request: Request) {
  const s = await sessao(request);
  if (s.erro) return s.erro;

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  const action = body.action;

  if (action === "ativar") {
    // ativo_desde NÃO é aceito do frontend nesta versão: o banco usa now() (default true = confirmação).
    const { data, error } = await s.db.rpc("ncrm_ativar_ingest", { p_confirmar: true });
    return resposta(data, error);
  }
  if (action === "desativar") {
    const { data, error } = await s.db.rpc("ncrm_desativar_ingest", { p_confirmar: true });
    return resposta(data, error);
  }
  return Response.json({ error: "Ação inválida (ativar|desativar)." }, { status: 422 });
}
