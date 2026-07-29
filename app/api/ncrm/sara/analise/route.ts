/**
 * Sara — ANÁLISES em modo observador (Fase 3, Regra 5 / P0-C): LEITURA admin.
 * GET -> ncrm_sara_analises_recentes (admin): últimas análises.
 * NÃO expõe POST: a análise AUTOMÁTICA é gravada SOMENTE pelo runner (service_role),
 * nunca pelo navegador — corretor não pode fabricar análise. A decisão humana
 * (aprovar/rejeitar) fica em /api/ncrm/sara/decidir. JWT real; nunca service_role aqui.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

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
  const limite = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? "50") || 50));
  const { data, error } = await db.rpc("ncrm_sara_analises_recentes", { p_limite: limite });
  if (error) return Response.json({ ok: false, error: "Falha ao ler análises." }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) return Response.json({ ok: false, erro: res.erro }, { status: res.erro === "sem_permissao" ? 403 : 409 });
  return Response.json(data);
}
