import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authenticatedClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await supabase.from("usuarios").select("role,ativo").eq("id", data.user.id).maybeSingle();
  return profile?.ativo && profile.role === "admin" ? { supabase, user: data.user } : null;
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Acesso restrito à administração." }, { status: 403 });
  const [users, brokers, instances, links] = await Promise.all([
    auth.supabase.from("usuarios").select("id,nome,role,ativo").order("nome"),
    auth.supabase.from("corretores").select("id,nome,email,telefone,usuario_id,ativo,online,no_escritorio,ultima_presenca,doc_rg_path,doc_rg_nome,doc_rg_em,doc_contrato_path,doc_contrato_nome,doc_contrato_em").order("ordem"),
    auth.supabase.from("instancias").select("id,nome,telefone,ativa,conectada,status_dapi,corretor_id").order("nome"),
    auth.supabase.from("corretor_instancias").select("corretor_id,instancia_id"),
  ]);
  const firstError = [users, brokers, instances, links].find((result) => result.error)?.error;
  if (firstError) return Response.json({ error: firstError.message }, { status: 502 });
  return Response.json({ users: users.data ?? [], brokers: brokers.data ?? [], instances: instances.data ?? [], links: links.data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Acesso restrito à administração." }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const brokerId = positiveInteger(body.brokerId);
  if (!brokerId) return Response.json({ error: "Corretor inválido." }, { status: 422 });

  if (body.action === "saveBroker") {
    const instanceIds = Array.isArray(body.instanceIds) ? body.instanceIds.map(positiveInteger).filter((id): id is number => id !== null) : [];
    const { error: brokerError } = await auth.supabase.from("corretores").update({ online: body.online === true, ativo: body.active !== false }).eq("id", brokerId);
    if (brokerError) return Response.json({ error: brokerError.message }, { status: 502 });
    const { error: removeError } = await auth.supabase.from("corretor_instancias").delete().eq("corretor_id", brokerId);
    if (removeError) return Response.json({ error: removeError.message }, { status: 502 });
    if (instanceIds.length) {
      const { error: insertError } = await auth.supabase.from("corretor_instancias").insert(instanceIds.map((instancia_id) => ({ corretor_id: brokerId, instancia_id })));
      if (insertError) return Response.json({ error: insertError.message }, { status: 502 });
    }
    return Response.json({ success: true });
  }

  if (body.action === "saveDocument") {
    const type = body.type === "contrato" ? "contrato" : "rg";
    const path = typeof body.path === "string" ? body.path.slice(0, 500) : "";
    const name = typeof body.name === "string" ? body.name.slice(0, 240) : "";
    if (!path || !name) return Response.json({ error: "Documento inválido." }, { status: 422 });
    const now = new Date().toISOString();
    const update = type === "rg" ? { doc_rg_path: path, doc_rg_nome: name, doc_rg_em: now } : { doc_contrato_path: path, doc_contrato_nome: name, doc_contrato_em: now };
    const { error } = await auth.supabase.from("corretores").update(update).eq("id", brokerId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
