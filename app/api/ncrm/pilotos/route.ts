/**
 * GESTÃO DE PILOTOS (Fase 6). Admin libera/remove POR NOME — a interface lista
 * os usuários e envia o id internamente; o administrador nunca digita UUID.
 * GET  -> ncrm_pilotos_listar
 * POST -> { action: "liberar"|"remover"|"limite", usuarioId?, limite? }
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function sessao(request: Request) {
  const a = request.headers.get("authorization");
  const token = a?.startsWith("Bearer ") ? a.slice(7) : null;
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) };
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error } = await supabase.auth.getUser(token);
  if (error || !auth.user) return { erro: Response.json({ error: "Sessão inválida." }, { status: 401 }) };
  return { db: supabase as unknown as SupabaseClient };
}

function resposta(data: unknown, error: { message: string } | null, falha: string) {
  if (error) return Response.json({ ok: false, error: falha }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) return Response.json(res, { status: res.erro === "sem_permissao" ? 403 : 422 });
  return Response.json(data);
}

export async function GET(request: Request) {
  const s = await sessao(request);
  if (s.erro) return s.erro;
  const { data, error } = await s.db.rpc("ncrm_pilotos_listar");
  return resposta(data, error, "Falha ao listar os usuários.");
}

export async function POST(request: Request) {
  const s = await sessao(request);
  if (s.erro) return s.erro;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Corpo inválido." }, { status: 400 }); }
  const action = String(body.action ?? "");
  const usuarioId = typeof body.usuarioId === "string" ? body.usuarioId : null;

  if (action === "liberar" || action === "remover") {
    if (!usuarioId) return Response.json({ error: "Usuário não informado." }, { status: 400 });
    const rpc = action === "liberar" ? "ncrm_piloto_liberar" : "ncrm_piloto_remover";
    const { data, error } = await s.db.rpc(rpc, { p_usuario_id: usuarioId });
    return resposta(data, error, "Falha ao atualizar o acesso.");
  }
  if (action === "limite") {
    const limite = Number(body.limite);
    if (!Number.isFinite(limite)) return Response.json({ error: "Limite inválido." }, { status: 400 });
    const { data, error } = await s.db.rpc("ncrm_piloto_limite", { p_limite: limite });
    return resposta(data, error, "Falha ao salvar o limite.");
  }
  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
