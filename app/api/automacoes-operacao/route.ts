import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

function bearer(request: Request) {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

async function autenticar(request: Request) {
  const token = bearer(request);
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) };
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { erro: Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 }) };
  }
  return { db: supabase as unknown as SupabaseClient };
}

export async function GET(request: Request) {
  const auth = await autenticar(request);
  if (auth.erro) return auth.erro;
  const { data, error } = await auth.db.rpc("central_saude_operacional");
  if (error) {
    const forbidden = error.message.includes("CENTRAL_ADMIN_REQUIRED") || error.code === "42501";
    return Response.json({ error: forbidden ? "Somente a gestão pode abrir a saúde da Central." : error.message }, { status: forbidden ? 403 : 502 });
  }
  return Response.json(data ?? {}, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await autenticar(request);
  if (auth.erro) return auth.erro;
  const body = await request.json().catch(() => ({})) as { action?: string; fila_id?: number; liberar?: boolean };

  if (body.action === "reprocessar") {
    const filaId = Number(body.fila_id);
    if (!Number.isSafeInteger(filaId) || filaId < 1) {
      return Response.json({ error: "Item de quarentena inválido." }, { status: 422 });
    }
    const { data, error } = await auth.db.rpc("central_reprocessar_fila", { p_fila_id: filaId });
    if (error) return Response.json({ error: error.message }, { status: error.code === "42501" ? 403 : 502 });
    return Response.json(data ?? {});
  }

  if (body.action === "abordagem") {
    if (typeof body.liberar !== "boolean") {
      return Response.json({ error: "Informe se o envio deve ser liberado ou bloqueado." }, { status: 422 });
    }
    const { data, error } = await auth.db.rpc("central_abordagem_emergencia", { p_liberar: body.liberar });
    if (error) return Response.json({ error: error.message }, { status: error.code === "42501" ? 403 : 502 });
    return Response.json(data ?? {});
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 422 });
}
