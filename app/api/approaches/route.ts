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
    auth.supabase.from("abordagens").select("id,nome,mensagens,produto_id,ativo,ordem,criado_em").order("ordem"),
    auth.supabase.from("produtos").select("id,nome,ativo,criado_em").order("nome"),
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
    const productId = body.productId === null || body.productId === undefined ? null : Number(body.productId);
    if (!name || (productId !== null && !Number.isSafeInteger(productId))) return Response.json({ error: "Dados da abordagem inválidos." }, { status: 422 });
    const countQuery = auth.supabase.from("abordagens").select("*", { count: "exact", head: true });
    const { count } = productId === null ? await countQuery.is("produto_id", null) : await countQuery.eq("produto_id", productId);
    const { error } = await auth.supabase.from("abordagens").insert({ nome: name, produto_id: productId, mensagens: [], ordem: count ?? 0 });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "updateApproach") {
    const id = Number(body.id); const name = text(body.name, 120);
    const messages = Array.isArray(body.messages) ? body.messages.slice(0, 60) : [];
    if (!Number.isSafeInteger(id) || !name) return Response.json({ error: "Abordagem inválida." }, { status: 422 });
    const { error } = await auth.supabase.from("abordagens").update({ nome: name, mensagens: messages }).eq("id", id);
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

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
