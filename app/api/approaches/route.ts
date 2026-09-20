import { createServerSupabaseClient } from "../../lib/supabase/server";
import type { TablesUpdate } from "../../lib/supabase/database.types";
import { resolveEffectiveAccess } from "../../lib/supabase/authz";
import { papelNoGrupo } from "../../lib/papeis";

export const dynamic = "force-dynamic";

type ErroAbordagens = { code?: string; message?: string } | null | undefined;

function falhaAbordagens(error: ErroAbordagens, operacao: string, status = 502) {
  const semPermissao = error?.code === "42501" || /permission|policy|acesso negado/i.test(error?.message ?? "");
  console.error("abordagens_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
  });
  return Response.json({
    error: semPermissao
      ? "Você não tem permissão para concluir esta operação."
      : "Não foi possível concluir esta operação de abordagens no momento.",
    erro: semPermissao ? "sem_permissao" : "falha_banco",
  }, { status: semPermissao ? 403 : status });
}

function falhaReconciliacaoAbordagens(operacao: string) {
  console.error("abordagens_operacao_falhou", { operacao, codigo: "sem_linha_retornada" });
  return Response.json({
    error: "A alteração não pôde ser confirmada. Recarregue antes de repetir.",
    erro: "reconciliacao_necessaria",
  }, { status: 409 });
}

async function authenticatedClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
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
  if (error) return falhaAbordagens(error, "carregar_abordagens");
  return Response.json({ approaches: approaches.data ?? [], products: products.data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const access = await resolveEffectiveAccess(auth.supabase, auth.user.id);
  if (!access.resolved) return falhaAbordagens(null, "validar_autorizacao");
  if (!papelNoGrupo(access.role, "gestao")) {
    return Response.json({ error: "A biblioteca de abordagens só pode ser alterada pela gestão." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = text(body.action, 40);

  if (action === "createProduct") {
    return Response.json({ error: "Produtos devem ser cadastrados no módulo Produtos; esta ação foi aposentada." }, { status: 410 });
  }

  if (action === "createApproach") {
    const name = text(body.name, 120);
    const empreendimentoId = body.empreendimentoId ? text(body.empreendimentoId, 60) : null;
    const grupo = text(body.grupo, 80) || null;
    if (!name || (empreendimentoId !== null && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(empreendimentoId))) return Response.json({ error: "Dados da abordagem inválidos." }, { status: 422 });
    const messages = Array.isArray(body.messages) ? body.messages.slice(0, 60) : [];
    const countQuery = auth.supabase.from("abordagens").select("*", { count: "exact", head: true });
    const { data: countData, count, error: countError } = empreendimentoId === null ? await countQuery.is("empreendimento_id", null) : await countQuery.eq("empreendimento_id", empreendimentoId);
    void countData;
    if (countError) return falhaAbordagens(countError, "contar_abordagens");
    const { data: created, error } = await auth.supabase.from("abordagens").insert({ nome: name, empreendimento_id: empreendimentoId, grupo, produto_id: null, mensagens: messages, ordem: count ?? 0 }).select("id").maybeSingle();
    if (error) return falhaAbordagens(error, "criar_abordagem");
    if (!created) return falhaReconciliacaoAbordagens("criar_abordagem");
    return Response.json({ success: true, id: created.id });
  }

  if (action === "updateApproach") {
    const id = Number(body.id); const name = text(body.name, 120);
    const messages = Array.isArray(body.messages) ? body.messages.slice(0, 60) : [];
    if (!Number.isSafeInteger(id) || !name) return Response.json({ error: "Abordagem inválida." }, { status: 422 });
    const update: TablesUpdate<"abordagens"> = { nome: name, mensagens: messages };
    if (body.grupo !== undefined) update.grupo = text(body.grupo, 80) || null;
    const { data: updated, error } = await auth.supabase.from("abordagens").update(update).eq("id", id).select("id").maybeSingle();
    if (error) return falhaAbordagens(error, "atualizar_abordagem");
    if (!updated) return Response.json({ error: "A abordagem não existe ou não está disponível.", erro: "abordagem_nao_encontrada" }, { status: 404 });
    return Response.json({ success: true });
  }

  if (action === "toggleApproach") {
    const id = Number(body.id); const active = body.active === true;
    if (!Number.isSafeInteger(id)) return Response.json({ error: "Abordagem inválida." }, { status: 422 });
    const { data: updated, error } = await auth.supabase.from("abordagens").update({ ativo: active }).eq("id", id).select("id").maybeSingle();
    if (error) return falhaAbordagens(error, "alternar_abordagem");
    if (!updated) return Response.json({ error: "A abordagem não existe ou não está disponível.", erro: "abordagem_nao_encontrada" }, { status: 404 });
    return Response.json({ success: true });
  }

  if (action === "deleteApproach") {
    return Response.json({ error: "A exclusão foi desativada para preservar o histórico. Arquive a abordagem." }, { status: 409 });
  }

  /* Doc §11 — CRUD de grupos: renomear/dissolver move todas as abordagens do grupo */
  if (action === "renameGroup") {
    const from = text(body.from, 80) || null;
    const to = body.to === null ? null : text(body.to, 80) || null;
    const empreendimentoId = body.empreendimentoId ? text(body.empreendimentoId, 60) : null;
    let update = auth.supabase.from("abordagens").update({ grupo: to });
    update = from === null ? update.is("grupo", null) : update.eq("grupo", from);
    update = empreendimentoId === null ? update.is("empreendimento_id", null) : update.eq("empreendimento_id", empreendimentoId);
    const { data: updated, error } = await update.select("id");
    if (error) return falhaAbordagens(error, "renomear_grupo");
    if (!updated?.length) return Response.json({ error: "Nenhuma abordagem foi encontrada neste grupo.", erro: "grupo_nao_encontrado" }, { status: 404 });
    return Response.json({ success: true, updated: updated.length });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
