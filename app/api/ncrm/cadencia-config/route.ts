/** CONFIG DE CADÊNCIA (Fase 5). GET (autenticado) / POST (admin no banco). Auditada. */
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

export async function GET(request: Request) {
  const s = await sessao(request);
  if (s.erro) return s.erro;
  const { data, error } = await s.db.rpc("ncrm_cadencia_config_get");
  if (error) return Response.json({ ok: false, error: "Falha ao ler a configuração." }, { status: 502 });
  return Response.json(data);
}

export async function POST(request: Request) {
  const s = await sessao(request);
  if (s.erro) return s.erro;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Corpo inválido." }, { status: 400 }); }
  const { data, error } = await s.db.rpc("ncrm_cadencia_config_set", { p: body });
  if (error) return Response.json({ ok: false, error: "Falha ao salvar a configuração." }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) return Response.json({ ok: false, erro: res.erro }, { status: res.erro === "sem_permissao" ? 403 : 422 });
  return Response.json(data);
}
