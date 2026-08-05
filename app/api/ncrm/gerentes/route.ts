/**
 * Gerentes ativos, para o corretor escolher quem vai junto na visita.
 *
 * A lista existe em `gerentes` (hoje: Djair, geral, e Eliz). Ate agora o
 * formulario da visita no CRM 3.0 nao perguntava isso, entao a coluna
 * `visitas.gerente_id` ficava nula e nao havia como checar conflito de agenda.
 * Leitura pura, sob a RLS do usuario.
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
    .from("gerentes")
    .select("id,nome,geral")
    .eq("ativo", true)
    .order("geral", { ascending: false })
    .order("nome", { ascending: true });
  if (error) return Response.json({ error: "Não foi possível carregar os gerentes." }, { status: 502 });

  return Response.json({ ok: true, gerentes: data ?? [] });
}
