import { createServerSupabaseClient } from "../../lib/supabase/server";
import { normalizarPapel, papelNoGrupo } from "../../lib/papeis";

export const dynamic = "force-dynamic";

type TeamError = { code?: string; message?: string } | null | undefined;

function falhaTeam(error: TeamError, operacao: string, parcial = false) {
  const semPermissao = error?.code === "42501" || /permission|policy|acesso negado/i.test(error?.message ?? "");
  console.error("team_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
    parcial,
  });
  return Response.json({
    error: semPermissao
      ? "Você não tem permissão para concluir esta operação."
      : parcial
        ? "A alteração foi iniciada, mas todas as etapas não foram confirmadas. Não repita a ação; atualize a tela e solicite reconciliação."
        : "Não foi possível concluir a operação de usuários no momento.",
    erro: semPermissao ? "sem_permissao" : parcial ? "reconciliacao_necessaria" : "falha_banco",
    ...(parcial ? { parcial: true } : {}),
  }, { status: semPermissao ? 403 : 502 });
}

async function authenticatedClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { status: "unauthenticated" as const };
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { status: "unauthenticated" as const };
  const { data: profile, error: profileError } = await supabase.from("usuarios").select("role,ativo").eq("id", data.user.id).maybeSingle();
  if (profileError) return { status: "auth_error" as const, error: profileError };
  if (!profile?.ativo || !papelNoGrupo(profile.role, "admin")) return { status: "forbidden" as const };
  return { status: "authorized" as const, supabase, user: data.user };
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AuditInput = { acao: string; modulo?: string; entidade?: string; entidadeId?: string | number | null; antes?: unknown; depois?: unknown; detalhe?: string };
async function audit(supabase: ReturnType<typeof createServerSupabaseClient>, event: AuditInput) {
  const { error } = await supabase.rpc("registrar_auditoria", {
    p_acao: event.acao, p_modulo: event.modulo ?? "Usuários", p_entidade: event.entidade ?? undefined,
    p_entidade_id: event.entidadeId === null || event.entidadeId === undefined ? undefined : String(event.entidadeId),
    p_antes: (event.antes ?? undefined) as never, p_depois: (event.depois ?? undefined) as never, p_detalhe: event.detalhe ?? undefined,
  });
  return error;
}

export async function GET(request: Request) {
  const auth = await authenticatedClient(request);
  if (auth.status === "unauthenticated") return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  if (auth.status === "auth_error") return falhaTeam(auth.error, "autorizar_listagem");
  if (auth.status === "forbidden") return Response.json({ error: "Acesso restrito à administração." }, { status: 403 });
  const [users, brokers, instances, links, audits] = await Promise.all([
    auth.supabase.from("usuarios").select("id,nome,role,ativo,permissoes,email,telefone,superior_id").order("nome"),
    auth.supabase.from("corretores").select("id,nome,email,telefone,usuario_id,ativo,online,no_escritorio,ultima_presenca,doc_rg_path,doc_rg_nome,doc_rg_em,doc_contrato_path,doc_contrato_nome,doc_contrato_em").order("ordem"),
    auth.supabase.from("instancias").select("id,nome,telefone,ativa,conectada,status_dapi,corretor_id").order("nome"),
    auth.supabase.from("corretor_instancias").select("corretor_id,instancia_id"),
    auth.supabase.from("erp_auditoria").select("id,usuario_nome,acao,modulo,entidade,entidade_id,detalhe,criado_em").eq("modulo", "Usuários").order("criado_em", { ascending: false }).limit(60),
  ]);
  const firstError = [users, brokers, instances, links, audits].find((result) => result.error)?.error;
  if (firstError) return falhaTeam(firstError, "carregar_equipe");
  return Response.json({ users: users.data ?? [], brokers: brokers.data ?? [], instances: instances.data ?? [], links: links.data ?? [], audits: audits.data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await authenticatedClient(request);
  if (auth.status === "unauthenticated") return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  if (auth.status === "auth_error") return falhaTeam(auth.error, "autorizar_alteracao");
  if (auth.status === "forbidden") return Response.json({ error: "Acesso restrito à administração." }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  if (body.action === "saveAccess") {
    const userId = typeof body.userId === "string" && UUID.test(body.userId) ? body.userId : null;
    if (!userId) return Response.json({ error: "Usuário inválido." }, { status: 422 });
    if ("permissoes" in body) return Response.json({ error: "Permissões individuais devem ser alteradas em Perfis e Permissões.", erro: "autoridade_permissoes" }, { status: 409 });
    const role = normalizarPapel(body.role);
    if (body.role !== undefined && !role) return Response.json({ error: "Papel inválido." }, { status: 422 });
    const activeUser = body.activeUser === undefined ? null : body.activeUser === true;
    let superiorId: string | null | undefined;
    if (body.superiorId === undefined) superiorId = undefined;
    else if (body.superiorId === null || body.superiorId === "") superiorId = null;
    else if (typeof body.superiorId === "string" && UUID.test(body.superiorId)) superiorId = body.superiorId;
    else return Response.json({ error: "Superior inválido." }, { status: 422 });
    if (superiorId !== undefined && superiorId === userId) return Response.json({ error: "Um usuário não pode ser superior de si mesmo." }, { status: 422 });
    if (userId === auth.user.id && ((role !== null && role !== "admin") || activeUser === false)) {
      return Response.json({ error: "Não é permitido remover o próprio acesso administrativo.", erro: "auto_bloqueio" }, { status: 409 });
    }
    const { data: before, error: beforeError } = await auth.supabase.from("usuarios").select("id,nome,role,ativo,permissoes,superior_id").eq("id", userId).maybeSingle();
    if (beforeError) return falhaTeam(beforeError, "ler_usuario_antes_alteracao");
    if (!before) return Response.json({ error: "Usuário não encontrado.", erro: "usuario_nao_encontrado" }, { status: 404 });
    type UsuarioUpdate = { role?: "admin" | "corretor" | "executivo" | "gerente" | "diretor"; ativo?: boolean; superior_id?: string | null };
    const update: UsuarioUpdate = {};
    if (role) update.role = role;
    if (activeUser !== null) update.ativo = activeUser;
    if (superiorId !== undefined) update.superior_id = superiorId;
    if (Object.keys(update).length === 0) return Response.json({ error: "Nada para salvar." }, { status: 422 });
    const { data: updated, error } = await auth.supabase.from("usuarios").update(update).eq("id", userId).select("id").maybeSingle();
    if (error) return falhaTeam(error, "salvar_acesso");
    if (!updated) return Response.json({ error: "O usuário deixou de existir antes da alteração.", erro: "usuario_conflito" }, { status: 409 });
    const auditError = await audit(auth.supabase, { acao: "editar_acesso", entidade: "usuario", entidadeId: userId, antes: before, depois: { ...before, ...update }, detalhe: `Acesso de ${before.nome ?? userId} atualizado` });
    if (auditError) return falhaTeam(auditError, "auditar_acesso", true);
    return Response.json({ success: true });
  }

  const brokerId = positiveInteger(body.brokerId);
  if (!brokerId) return Response.json({ error: "Corretor inválido." }, { status: 422 });

  if (body.action === "saveBroker") {
    const rawInstanceIds = Array.isArray(body.instanceIds) ? body.instanceIds : [];
    const parsedInstanceIds = rawInstanceIds.map(positiveInteger);
    if (parsedInstanceIds.some((id) => id === null)) return Response.json({ error: "Lista de instâncias inválida." }, { status: 422 });
    const instanceIds = [...new Set(parsedInstanceIds as number[])];
    const { data: before, error: beforeError } = await auth.supabase.from("corretores").select("id,nome,ativo,online").eq("id", brokerId).maybeSingle();
    if (beforeError) return falhaTeam(beforeError, "ler_corretor_antes_alteracao");
    if (!before) return Response.json({ error: "Corretor não encontrado.", erro: "corretor_nao_encontrado" }, { status: 404 });
    const { data: linksBefore, error: linksBeforeError } = await auth.supabase.from("corretor_instancias").select("instancia_id").eq("corretor_id", brokerId);
    if (linksBeforeError) return falhaTeam(linksBeforeError, "ler_vinculos_antes_alteracao");
    if (instanceIds.length) {
      const { data: validInstances, error: instancesError } = await auth.supabase.from("instancias").select("id").in("id", instanceIds);
      if (instancesError) return falhaTeam(instancesError, "validar_instancias_solicitadas");
      if ((validInstances ?? []).length !== instanceIds.length) return Response.json({ error: "Uma ou mais instâncias não existem.", erro: "instancias_solicitadas_invalidas" }, { status: 422 });
    }
    const { data: updatedBroker, error: brokerError } = await auth.supabase.from("corretores").update({ online: body.online === true, ativo: body.active !== false }).eq("id", brokerId).select("id").maybeSingle();
    if (brokerError) return falhaTeam(brokerError, "salvar_corretor");
    if (!updatedBroker) return Response.json({ error: "O corretor deixou de existir antes da alteração.", erro: "corretor_conflito" }, { status: 409 });
    const { error: removeError } = await auth.supabase.from("corretor_instancias").delete().eq("corretor_id", brokerId);
    if (removeError) return falhaTeam(removeError, "remover_vinculos_anteriores", true);
    if (instanceIds.length) {
      const { error: insertError } = await auth.supabase.from("corretor_instancias").insert(instanceIds.map((instancia_id) => ({ corretor_id: brokerId, instancia_id })));
      if (insertError) return falhaTeam(insertError, "salvar_novos_vinculos", true);
    }
    const auditError = await audit(auth.supabase, { acao: "editar_corretor", entidade: "corretor", entidadeId: brokerId, antes: { ...before, instancias: (linksBefore ?? []).map((link) => link.instancia_id) }, depois: { online: body.online === true, ativo: body.active !== false, instancias: instanceIds }, detalhe: `Status/instâncias de ${before.nome ?? brokerId} atualizados` });
    if (auditError) return falhaTeam(auditError, "auditar_corretor", true);
    return Response.json({ success: true });
  }

  if (body.action === "saveDocument") {
    const type = body.type === "contrato" ? "contrato" : body.type === "rg" ? "rg" : null;
    if (!type) return Response.json({ error: "Tipo de documento inválido." }, { status: 422 });
    const path = typeof body.path === "string" ? body.path.trim().slice(0, 500) : "";
    const name = typeof body.name === "string" ? body.name.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 240) : "";
    if (!path || !name) return Response.json({ error: "Documento inválido." }, { status: 422 });
    const expectedPrefix = `corretor/${brokerId}/${type}_`;
    if (!path.startsWith(expectedPrefix) || path.includes("..") || path.startsWith("/")) return Response.json({ error: "Caminho do documento inválido.", erro: "documento_caminho_invalido" }, { status: 422 });
    const { data: before, error: beforeError } = await auth.supabase.from("corretores").select("id,nome,doc_rg_path,doc_rg_nome,doc_contrato_path,doc_contrato_nome").eq("id", brokerId).maybeSingle();
    if (beforeError) return falhaTeam(beforeError, "ler_corretor_antes_documento");
    if (!before) return Response.json({ error: "Corretor não encontrado.", erro: "corretor_nao_encontrado" }, { status: 404 });
    const now = new Date().toISOString();
    const update = type === "rg" ? { doc_rg_path: path, doc_rg_nome: name, doc_rg_em: now } : { doc_contrato_path: path, doc_contrato_nome: name, doc_contrato_em: now };
    const { data: updated, error } = await auth.supabase.from("corretores").update(update).eq("id", brokerId).select("id").maybeSingle();
    if (error) return falhaTeam(error, "vincular_documento");
    if (!updated) return Response.json({ error: "O corretor deixou de existir antes do vínculo.", erro: "corretor_conflito" }, { status: 409 });
    const auditError = await audit(auth.supabase, { acao: "enviar_documento", entidade: "corretor", entidadeId: brokerId, antes: before, depois: { tipo: type, arquivo: name, caminho: path }, detalhe: `Documento ${type} enviado (${name})` });
    if (auditError) return falhaTeam(auditError, "auditar_documento", true);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
