/**
 * FILA DE TRABALHO do CRM Nova Era (Fase 5). GET -> ncrm_fila_trabalho.
 * JWT real; escopo por carteira/papel garantido no banco (SECURITY DEFINER fail-closed).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const FILTROS = new Set(["agora", "vencidos", "hoje", "proximos", "respondeu", "sem_resposta", "risco", "quente"]);

export async function GET(request: Request) {
  const a = request.headers.get("authorization");
  const token = a?.startsWith("Bearer ") ? a.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const url = new URL(request.url);
  const filtro = url.searchParams.get("filtro") ?? "agora";
  const corretor = url.searchParams.get("corretor");
  if (!FILTROS.has(filtro)) return Response.json({ error: "Filtro inválido." }, { status: 400 });

  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db.rpc("ncrm_fila_trabalho", {
    p_filtro: filtro,
    p_corretor: corretor ? Number(corretor) : null,
    p_limite: 150,
  });
  if (error) return Response.json({ ok: false, error: "Falha ao carregar a fila." }, { status: 502 });
  return Response.json(data);
}
