import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authenticatedClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase };
}

const text = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const [approaches, products] = await Promise.all([
    auth.supabase.from("abordagens").select("id,nome,mensagens,produto_id,empreendimento_id,grupo,ativo,ordem,criado_em").order("ordem"),
    auth.supabase.from("empreendimentos").select("id,nome").eq("rascunho", false).order("nome").limit(400),
  ]);
  const error = approaches.error ?? products.error;
  return error
    ? Response.json({ error: error.message }, { status: 502 })
    : Response.json({ approaches: approaches.data ?? [], products: products.data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = text(body.action, 40);

  if (action === "createProduct") {
    const name = text(body.name, 120);
    if (!name) return Response.json({ error: "Informe o nome do produto." }, { status: 422 });
    const { error } = await auth.supabase.from("produtos").insert({ nome: name });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "createApproach") {
    const name = text(body.name, 120);
    const empreendimentoId = body.empreendimentoId ? text(body.empreendimentoId, 60) : null;
    const grupo = text(body.grupo, 80) || null;
    if (!name) return Response.json({ error: "Dados da abordagem inválidos." }, { status: 422 });
    const messages = Array.isArray(body.messages) ? body.messages.slice(0, 60) : [];
    const countQuery = auth.supabase.from("abordagens").select("*", { count: "exact", head: true });
    const { count } = empreendimentoId === null ? await countQuery.is("empreendimento_id", null) : await countQuery.eq("empreendimento_id", empreendimentoId);
    const { error } = await auth.supabase.from("abordagens").insert({ nome: name, empreendimento_id: empreendimentoId, grupo, produto_id: null, mensagens: messages, ordem: count ?? 0 });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "updateApproach") {
    const id = Number(body.id); const name = text(body.name, 120);
    const messages = Array.isArray(body.messages) ? body.messages.slice(0, 60) : [];
    if (!Number.isSafeInteger(id) || !name) return Response.json({ error: "Abordagem inválida." }, { status: 422 });
    const update: Record<string, unknown> = { nome: name, mensagens: messages };
    if (body.grupo !== undefined) update.grupo = text(body.grupo, 80) || null;
    const { error } = await auth.supabase.from("abordagens").update(update).eq("id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "toggleApproach") {
    const id = Number(body.id); const active = body.active === true;
    if (!Number.isSafeInteger(id)) return Response.json({ error: "Abordagem inválida." }, { status: 422 });
    const { error } = await auth.supabase.from("abordagens").update({ ativo: active }).eq("id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "deleteApproach") {
    const id = Number(body.id);
    if (!Number.isSafeInteger(id)) return Response.json({ error: "Abordagem inválida." }, { status: 422 });
    const { error } = await auth.supabase.from("abordagens").delete().eq("id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  /* Doc §11 — CRUD de grupos: renomear/dissolver move todas as abordagens do grupo */
  if (action === "renameGroup") {
    const from = text(body.from, 80) || null;
    const to = body.to === null ? null : text(body.to, 80) || null;
    const empreendimentoId = body.empreendimentoId ? text(body.empreendimentoId, 60) : null;
    let update = auth.supabase.from("abordagens").update({ grupo: to });
    update = from === null ? update.is("grupo", null) : update.eq("grupo", from);
    update = empreendimentoId === null ? update.is("empreendimento_id", null) : update.eq("empreendimento_id", empreendimentoId);
    const { error } = await update;
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
