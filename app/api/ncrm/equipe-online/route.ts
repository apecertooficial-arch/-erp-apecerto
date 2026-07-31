/**
 * Presença da equipe para a tabela de Leads (handoff v3, print 03).
 *
 * "Online" aqui é HONESTO e barato: o corretor abriu o ERP nos últimos
 * 15 minutos (registro de acesso que já existia). Nada de invenção de
 * presença em tempo real — é o dado que temos, dito como ele é.
 */
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
  const { data, error } = await db.rpc("ncrm_equipe_online");
  if (error) return Response.json({ error: "Presença indisponível." }, { status: 502 });
  return Response.json({ ok: true, equipe: data ?? [] });
}
