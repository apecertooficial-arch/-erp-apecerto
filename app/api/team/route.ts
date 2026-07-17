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

type AuditInput = { acao: string; modulo?: string; entidade?: string; entidadeId?: string | number | null; antes?: unknown; depois?: unknown; detalhe?: string };
async function audit(supabase: ReturnType<typeof createServerSupabaseClient>, event: AuditInput) {
  await supabase.rpc("registrar_auditoria", {
    p_acao: event.acao, p_modulo: event.modulo ?? "Usuários", p_entidade: event.entidade ?? null,
    p_entidade_id: event.entidadeId === null || event.entidadeId === undefined ? null : String(event.entidadeId),
    p_antes: event.antes ?? null, p_depois: event.depois ?? null, p_detalhe: event.detalhe ?? null,
  }).then(() => undefined, () => undefined);
}

export async function GET(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Acesso restrito à administração." }, { status: 403 });
  const [users, brokers, instances, links, audits] = await Promise.all([
    auth.supabase.from("usuarios").select("id,nome,role,ativo,permissoes").order("nome"),
    auth.supabase.from("corretores").select("id,nome,email,telefone,usuario_id,ativo,online,no_escritorio,ultima_presenca,doc_rg_path,doc_rg_nome,doc_rg_em,doc_contrato_path,doc_contrato_nome,doc_contrato_em").order("ordem"),
    auth.supabase.from("instancias").select("id,nome,telefone,ativa,conectada,status_dapi,corretor_id").order("nome"),
    auth.supabase.from("corretor_instancias").select("corretor_id,instancia_id"),
    auth.supabase.from("erp_auditoria").select("id,usuario_nome,acao,modulo,entidade,entidade_id,detalhe,criado_em").eq("modulo", "Usuários").order("criado_em", { ascending: false }).limit(60),
  ]);
  const firstError = [users, brokers, instances, links].find((result) => result.error)?.error;
  if (firstError) return Response.json({ error: firstError.message }, { status: 502 });
  return Response.json({ users: users.data ?? [], brokers: brokers.data ?? [], instances: instances.data ?? [], links: links.data ?? [], audits: audits.data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Acesso restrito à administração." }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;

  if (body.action === "saveAccess") {
    const userId = typeof body.userId === "string" && body.userId.length >= 30 ? body.userId : null;
    if (!userId) return Response.json({ error: "Usuário inválido." }, { status: 422 });
    const role = ["admin", "corretor", "executivo"].includes(String(body.role)) ? String(body.role) : null;
    const permissions = body.permissoes && typeof body.permissoes === "object" ? body.permissoes as Record<string, string[]> : null;
    const activeUser = body.activeUser === undefined ? null : body.activeUser === true;
    const { data: before } = await auth.supabase.from("usuarios").select("id,nome,role,ativo,permissoes").eq("id", userId).maybeSingle();
    const update: Record<string, unknown> = {};
    if (role) update.role = role;
    if (permissions !== null) update.permissoes = permissions;
    if (activeUser !== null) update.ativo = activeUser;
    if (Object.keys(update).length === 0) return Response.json({ error: "Nada para salvar." }, { status: 422 });
    const { error } = await auth.supabase.from("usuarios").update(update).eq("id", userId);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    await audit(auth.supabase, { acao: "editar_acesso", entidade: "usuario", entidadeId: userId, antes: before ?? undefined, depois: { ...before, ...update }, detalhe: `Acesso/permissões de ${before?.nome ?? userId} atualizados` });
    return Response.json({ success: true });
  }

  const brokerId = positiveInteger(body.brokerId);
  if (!brokerId) return Response.json({ error: "Corretor inválido." }, { status: 422 });

  if (body.action === "saveBroker") {
    const instanceIds = Array.isArray(body.instanceIds) ? body.instanceIds.map(positiveInteger).filter((id): id is number => id !== null) : [];
    const { data: before } = await auth.supabase.from("corretores").select("id,nome,ativo,online").eq("id", brokerId).maybeSingle();
    const { data: linksBefore } = await auth.supabase.from("corretor_instancias").select("instancia_id").eq("corretor_id", brokerId);
    const { error: brokerError } = await auth.supabase.from("corretores").update({ online: body.online === true, ativo: body.active !== false }).eq("id", brokerId);
    if (brokerError) return Response.json({ error: brokerError.message }, { status: 502 });
    const { error: removeError } = await auth.supabase.from("corretor_instancias").delete().eq("corretor_id", brokerId);
    if (removeError) return Response.json({ error: removeError.message }, { status: 502 });
    if (instanceIds.length) {
      const { error: insertError } = await auth.supabase.from("corretor_instancias").insert(instanceIds.map((instancia_id) => ({ corretor_id: brokerId, instancia_id })));
      if (insertError) return Response.json({ error: insertError.message }, { status: 502 });
    }
    await audit(auth.supabase, { acao: "editar_corretor", entidade: "corretor", entidadeId: brokerId, antes: { ...before, instancias: (linksBefore ?? []).map((link) => link.instancia_id) }, depois: { online: body.online === true, ativo: body.active !== false, instancias: instanceIds }, detalhe: `Status/instâncias de ${before?.nome ?? brokerId} atualizados` });
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
    if (error) return Response.json({ error: error.message }, { status: 502 });
    await audit(auth.supabase, { acao: "enviar_documento", entidade: "corretor", entidadeId: brokerId, depois: { tipo: type, arquivo: name }, detalhe: `Documento ${type} enviado (${name})` });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
