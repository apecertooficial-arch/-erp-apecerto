/** Fase 6 PR B — central de treinamento: progresso individual e acompanhamento da equipe. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function autenticar(request: Request) {
  const a = request.headers.get("authorization");
  const token = a?.startsWith("Bearer ") ? a.slice(7) : null;
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) };
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error } = await supabase.auth.getUser(token);
  if (error || !auth.user) return { erro: Response.json({ error: "Sessão inválida." }, { status: 401 }) };
  return { db: supabase as unknown as SupabaseClient };
}

function responder(data: unknown, error: unknown) {
  if (error) return Response.json({ ok: false, error: "Falha ao carregar." }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) return Response.json(res, { status: res.erro === "sem_permissao" ? 403 : 422 });
  return Response.json(data);
}

export async function GET(request: Request) {
  const { erro, db } = await autenticar(request);
  if (erro || !db) return erro!;
  const escopo = new URL(request.url).searchParams.get("escopo");
  const { data, error } = await db.rpc(escopo === "equipe" ? "ncrm_treinamento_equipe" : "ncrm_treinamento_meu");
  return responder(data, error);
}

export async function POST(request: Request) {
  const { erro, db } = await autenticar(request);
  if (erro || !db) return erro!;
  let body: { item?: string; concluido?: boolean };
  try { body = await request.json(); } catch { return Response.json({ ok: false, erro: "payload_invalido" }, { status: 400 }); }
  const item = typeof body.item === "string" ? body.item.trim() : "";
  if (item.length < 2 || item.length > 60) return Response.json({ ok: false, erro: "item_invalido" }, { status: 400 });
  const { data, error } = await db.rpc("ncrm_treinamento_marcar", { p_item: item, p_concluido: body.concluido !== false });
  return responder(data, error);
}
