/**
 * Manual Operacional — o texto único que orienta a operação.
 *
 * GET  -> { ok, conteudo, atualizado_em } — qualquer autenticado lê (RLS).
 * POST -> { conteudo } — SÓ admin grava, e quem decide é o banco
 *         (ncrm_manual_salvar checa is_admin() por dentro; fail-closed).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

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
  const db = supabase as unknown as SupabaseClient;

  const { data, error } = await db
    .from("ncrm_manual_operacional")
    .select("conteudo,atualizado_em")
    .eq("id", true)
    .maybeSingle();
  if (error) return Response.json({ error: "Não foi possível carregar o manual." }, { status: 502 });
  const m = (data ?? { conteudo: "", atualizado_em: null }) as { conteudo: string; atualizado_em: string | null };
  return Response.json({ ok: true, conteudo: m.conteudo ?? "", atualizado_em: m.atualizado_em });
}

export async function POST(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  const conteudo = typeof body.conteudo === "string" ? body.conteudo : null;
  if (conteudo === null || conteudo.length > 20000) return Response.json({ error: "Conteúdo inválido (máximo 20.000 caracteres)." }, { status: 422 });

  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db.rpc("ncrm_manual_salvar", { p_conteudo: conteudo });
  if (error) return Response.json({ error: "Falha ao salvar o manual." }, { status: 502 });
  const r = (data ?? {}) as { ok?: boolean; erro?: string };
  if (r.ok !== true) {
    const msg = r.erro === "somente_admin" ? "Somente o administrador edita o manual." : "Não foi possível salvar.";
    return Response.json({ ok: false, erro: r.erro, error: msg }, { status: 403 });
  }
  return Response.json({ ok: true });
}
