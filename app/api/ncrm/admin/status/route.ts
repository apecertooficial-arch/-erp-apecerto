/**
 * Snapshot ADMIN do piloto (Fase 3, Regra 7). Somente leitura agregada.
 * GET -> ncrm_admin_status: ingestão, checkpoints, fila de reconciliação, operacional, Sara.
 * JWT real do usuário; nunca service_role. Não muta nada.
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
  const { data, error } = await db.rpc("ncrm_admin_status");
  if (error) return Response.json({ ok: false, error: "Falha ao ler o status do piloto." }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) return Response.json({ ok: false, erro: res.erro }, { status: res.erro === "sem_permissao" ? 403 : 409 });
  return Response.json(data);
}
