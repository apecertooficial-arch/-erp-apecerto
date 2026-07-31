/**
 * Registro do aparelho para receber aviso de lead novo.
 *
 * POST { endpoint, p256dh, auth, userAgent? } -> ncrm_push_registrar.
 *
 * O dono da inscricao e decidido DENTRO do banco, por auth.uid(). O corpo do
 * pedido nao carrega usuario_id nem corretor_id de proposito: aceitar isso aqui
 * deixaria um corretor inscrever o proprio aparelho no lugar de outro e receber
 * os avisos da carteira alheia.
 *
 * JWT real do usuario; nunca service_role.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { validarInscricao } from "./logica";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const a = request.headers.get("authorization");
  const token = a?.startsWith("Bearer ") ? a.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }

  const dados = validarInscricao(body);
  if (!dados) return Response.json({ error: "Inscrição inválida." }, { status: 422 });

  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db.rpc("ncrm_push_registrar", {
    p_endpoint: dados.endpoint,
    p_p256dh: dados.p256dh,
    p_auth: dados.auth,
    p_user_agent: dados.userAgent,
  });

  if (error) return Response.json({ ok: false, error: "Falha ao registrar o aparelho." }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) {
    return Response.json({ ok: false, erro: res.erro }, { status: res.erro === "nao_autenticado" ? 403 : 409 });
  }
  return Response.json(data);
}
