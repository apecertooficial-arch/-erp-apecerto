/** JUSTIFICATIVA de atraso (Fase 5). POST -> ncrm_justificar_atraso (dono/gestor; auditável). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const a = request.headers.get("authorization");
  const token = a?.startsWith("Bearer ") ? a.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Corpo inválido." }, { status: 400 }); }
  const negocioId = Number(body.negocioId);
  const tipo = typeof body.tipo === "string" ? body.tipo : "acao_vencida";
  const texto = typeof body.texto === "string" ? body.texto.slice(0, 1000) : "";
  if (!Number.isFinite(negocioId) || negocioId <= 0) return Response.json({ error: "Negócio inválido." }, { status: 400 });

  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db.rpc("ncrm_justificar_atraso", { p_negocio_id: negocioId, p_tipo: tipo, p_texto: texto });
  if (error) return Response.json({ ok: false, error: "Falha ao registrar a justificativa." }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) return Response.json({ ok: false, erro: res.erro }, { status: res.erro === "sem_permissao" ? 403 : 422 });
  return Response.json(data);
}
