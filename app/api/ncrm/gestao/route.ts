/** PAINEL DE GESTÃO (Fase 5). GET -> ncrm_gestao_painel (agregação real no banco, por papel). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const a = request.headers.get("authorization");
  const token = a?.startsWith("Bearer ") ? a.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db.rpc("ncrm_gestao_painel");
  if (error) return Response.json({ ok: false, error: "Falha ao carregar a gestão." }, { status: 502 });
  return Response.json(data);
}
