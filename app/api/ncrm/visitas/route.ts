/**
 * Visitas para o CRM 3.0 — leitura enxuta da agenda comercial.
 *
 * A tela de Visitas do protótipo é uma lista simples (data, cliente,
 * empreendimento, local, hora, situação). Ler o CRM inteiro para isso
 * seria desperdício: esta rota devolve SÓ as visitas, sob a RLS do
 * usuário (quem não pode ver, não vê — a regra é do banco).
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

  /* Da semana passada em diante: o passado recente dá contexto (realizadas),
     o futuro é o que interessa. Limite alto o bastante para a operação real. */
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await db
    .from("visitas")
    .select("id,negocio_id,cliente_nome,produto,local,data,hora_inicio,status,resultado")
    .gte("data", desde)
    .order("data", { ascending: true })
    .order("hora_inicio", { ascending: true })
    .limit(200);
  if (error) return Response.json({ error: "Não foi possível carregar as visitas." }, { status: 502 });

  const { count } = await db.from("visitas").select("id", { count: "exact", head: true }).gte("data", desde);
  return Response.json({ ok: true, visitas: data ?? [], total: count ?? (data?.length ?? 0) });
}
