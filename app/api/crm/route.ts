import { createServerSupabaseClient } from "../../lib/supabase/server";
import type { Database } from "../../lib/supabase/database.types";
import { resolveEffectiveAccess, accessCan, denyIfCannot, type EffectiveAccess } from "../../lib/supabase/authz";

export const dynamic = "force-dynamic";

type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];

async function authenticatedClient(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanText(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

type Authenticated = NonNullable<Awaited<ReturnType<typeof authenticatedClient>>>;

const getEffectiveAccess = (auth: Authenticated) => resolveEffectiveAccess(auth.supabase, auth.user.id);

// "atribuir"/"transferir" fazem sentido em crm, leads ou pipeline — basta um conceder.
function canCrm(access: EffectiveAccess, action: "atribuir" | "transferir") {
  return ["crm", "leads", "pipeline"].some((moduleName) => accessCan(access, moduleName, action));
}

// O PostgREST/Supabase corta QUALQUER consulta em 1000 linhas (max-rows padrão),
// mesmo com .limit() maior. Para tabelas que já passaram disso (leads/negócios),
// buscamos em páginas de 1000 até esgotar.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<{ data: T[] | null; error: any }> {
  const rows: T[] = [];
  for (let page = 0; page < 30; page++) {
    const { data, error } = await build(page * 1000, page * 1000 + 999);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { data: rows, error: null };
}

export async function GET(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  // Leads do aquário (sem corretor, esperando pescaria) NÃO entram no payload do
  // CRM — só o contador. Com milhares de leads no aquário, mandá-los para a tela
  // estoura o kanban e o limite de linhas. Depois de pescado (corretor definido),
  // o lead aparece normalmente.
  const { data: aquarioData } = await auth.supabase.rpc("aquario_status");
  const aqInfo = aquarioData && typeof aquarioData === "object" ? aquarioData as { stage_id?: number | null } : {};
  const aqStage = Number(aqInfo.stage_id ?? 0) || 0;
  const foraDoAquarioNegocios = aqStage ? `corretor_id.not.is.null,stage_id.neq.${aqStage}` : "";

  const [pipelinesResult, momentoCatalogoResult, stagesResult, leadsResult, dealsResult, brokersResult, activitiesResult, historicoResult, tasksResult, linksResult, visitsResult, productsResult, slaResult, alertsResult, leiturasResult] = await Promise.all([
    auth.supabase.from("pipelines").select("id,nome,grupo,ordem").order("ordem"),
    auth.supabase.from("lead_momento_catalogo").select("slug,rotulo,grupo,ordem,cor,prazo_dias").eq("ativo", true).order("ordem"),
    auth.supabase.from("pipeline_stages").select("id,pipeline_id,nome,rotulo,ordem,cor,tipo,grupo,chave").order("ordem"),
    fetchAll((from, to) => auth.supabase.from("leads").select("id,nome,telefone,email,instagram,corretor_id,pipeline_id,status,origem,tags,extras,criado_em,atualizado_em,disparo_optout").or("corretor_id.not.is.null,origem.is.null,origem.neq.Aquário").order("atualizado_em", { ascending: false, nullsFirst: false }).order("id").range(from, to)),
    fetchAll((from, to) => { let q = auth.supabase.from("negocios").select("id,lead_id,corretor_id,pipeline_id,stage_id,empreendimento_id,valor,status,motivo_perda,criado_em,ultima_movimentacao,estagio_desde,tentativa,max_tentativas"); if (foraDoAquarioNegocios) q = q.or(foraDoAquarioNegocios); return q.order("ultima_movimentacao", { ascending: false, nullsFirst: false }).order("id").range(from, to); }),
    auth.supabase.rpc("listar_corretores_transferencia"),
    auth.supabase.from("crm_atividades").select("id,lead_id,negocio_id,corretor_id,tipo,texto,criado_em").order("criado_em", { ascending: false }).limit(500),
    auth.supabase.from("atendimento_acoes").select("id,lead_id,negocio_id,corretor_id,tipo,canal,texto,resultado,criado_em").order("criado_em", { ascending: false }).limit(500),
    auth.supabase.from("crm_tarefas").select("id,lead_id,negocio_id,corretor_id,titulo,descricao,vencimento,concluida,prioridade,criado_em").order("criado_em", { ascending: false }).limit(500),
    auth.supabase.from("lead_produtos").select("lead_id,empreendimento_id,created_at,empreendimentos(id,nome,bairro,cidade,status,preco)").order("created_at", { ascending: false }),
    auth.supabase.from("visitas").select("id,created_by,lead_id,negocio_id,corretor_id,cliente_nome,empreendimento_id,produto,unidade,data,hora_inicio,hora_fim,local,observacoes,participantes,lembrete,com_gerente,gerente_id,status,criado_em").order("data").order("hora_inicio"),
    auth.supabase.from("empreendimentos").select("id,nome,bairro,cidade,status,preco,origem,rascunho").order("nome").limit(300),
    fetchAll((from, to) => { let q = auth.supabase.from("vw_sla_leads").select("negocio_id,lead_id,stage_id,sla_situacao,aguardando_humano,min_aguardando,min_no_estagio,min_sem_interacao,min_ativo_int,cor_ativa,alarme_ativo,ultima_interacao,cliente_ultima,humano_ultima"); if (foraDoAquarioNegocios) q = q.or(foraDoAquarioNegocios); return q.order("negocio_id").range(from, to); }),
    auth.supabase.from("crm_lead_alertas").select("id,negocio_id,corretor_id,criado_em,reconhecido_em,reconhecido_por").is("reconhecido_em", null).order("criado_em", { ascending: false }),
    auth.supabase.from("crm_lead_leituras").select("negocio_id,lido_em").eq("usuario_id", auth.user.id),
  ]);

  const firstError = [pipelinesResult, stagesResult, leadsResult, dealsResult, brokersResult, activitiesResult, historicoResult, tasksResult, linksResult, visitsResult, productsResult, slaResult, alertsResult].find((result) => result.error)?.error;
  if (firstError) return Response.json({ error: firstError.message }, { status: 502 });

  const { data: gerentesData } = await auth.supabase.from("gerentes").select("id,nome,geral,corretor_id").eq("ativo", true).order("geral", { ascending: false });
  const { data: meProfile } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();

  // Visibilidade da agenda:
  //  - Visitas: todos veem todas (agenda compartilhada da equipe).
  //  - Tarefas: privadas por corretor — cada corretor só vê as suas; gestão
  //    (admin/gestor/executivo) continua vendo todas.
  const role = meProfile?.role ?? "";
  const restrictTasks = role === "corretor";
  let myCorretorId: number | null = null;
  if (restrictTasks) {
    const { data: myBroker } = await auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle();
    myCorretorId = (myBroker?.id as number | undefined) ?? null;
  }
  const allTasks = tasksResult.data ?? [];
  const visibleTasks = restrictTasks ? allTasks.filter((task) => task.corretor_id === myCorretorId) : allTasks;

  return Response.json({
    mode: "production",
    role,
    gerentes: gerentesData ?? [],
    pipelines: pipelinesResult.data ?? [],
    momentoCatalogo: momentoCatalogoResult.data ?? [],
    stages: stagesResult.data ?? [],
    leads: leadsResult.data ?? [],
    deals: dealsResult.data ?? [],
    brokers: brokersResult.data ?? [],
    activities: activitiesResult.data ?? [],
    historico: historicoResult.data ?? [],
    tasks: visibleTasks,
    productLinks: linksResult.data ?? [],
    visits: visitsResult.data ?? [],
    products: productsResult.data ?? [],
    sla: slaResult.data ?? [],
    alerts: alertsResult.data ?? [],
    leituras: leiturasResult.data ?? [],
    aquario: aquarioData ?? null,
  });
}

export async function PATCH(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = cleanText(body.action, 40);

  // Acesso efetivo do usuário resolvido uma única vez; cada ação de escrita é
  // validada contra o par (módulo, ação) correspondente. admin sempre passa e,
  // sem mapa de permissões, libera (fail-open) — o RLS continua sendo a trava dura.
  const access = await getEffectiveAccess(auth);
  const guard = (pairs: Array<[string, string]>, msg: string) => denyIfCannot(access, pairs, msg);

  if (action === "updateLead") {
    const leadId = positiveInteger(body.leadId);
    if (!leadId) return Response.json({ error: "Lead inválido." }, { status: 400 });
    const denied = guard([["leads", "editar"], ["crm", "editar"]], "Você não tem permissão para editar leads.");
    if (denied) return denied;
    const input = body.lead && typeof body.lead === "object" ? body.lead as Record<string, unknown> : {};
    const update: LeadUpdate = {
      nome: cleanText(input.nome, 160) || null,
      telefone: cleanText(input.telefone, 40) || null,
      email: cleanText(input.email, 180).toLowerCase() || null,
      instagram: cleanText(input.instagram, 120) || null,
      origem: cleanText(input.origem, 100) || null,
      status: cleanText(input.status, 80) || "novo",
      tags: Array.isArray(input.tags) ? input.tags.map((tag) => cleanText(tag, 50)).filter(Boolean).slice(0, 30) : [],
      atualizado_em: new Date().toISOString(),
    };
    if (input.corretor_id !== undefined) {
      if (!canCrm(access, "transferir")) return Response.json({ error: "Você não tem permissão para trocar o corretor responsável." }, { status: 403 });
      update.corretor_id = input.corretor_id === null || input.corretor_id === "" ? null : positiveInteger(input.corretor_id);
    }
    if (!update.nome || !update.telefone) return Response.json({ error: "Nome e telefone são obrigatórios." }, { status: 422 });
    const { error } = await auth.supabase.from("leads").update(update).eq("id", leadId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  // ===== Momento do lead =====
  // Registrar o momento NÃO move o card, não troca etapa e não troca funil.
  // É um atributo do lead: em que ponto do atendimento ele está, e quando isso
  // foi dito pela última vez — é a data que denuncia lead esquecido.
  if (action === "registrarMomento") {
    const leadId = positiveInteger(body.leadId);
    const momento = cleanText(body.momento, 40);
    if (!leadId || !momento) return Response.json({ error: "Informe o lead e o momento." }, { status: 400 });
    const denied = guard([["leads", "editar"], ["crm", "editar"]], "Você não tem permissão para atualizar o momento do lead.");
    if (denied) return denied;
    const dealId = positiveInteger(body.dealId);
    const { data, error } = await auth.supabase.rpc("registrar_momento_lead", {
      p_lead_id: leadId,
      p_momento: momento,
      p_observacao: cleanText(body.observacao, 1000) || undefined,
      p_negocio_id: dealId || undefined,
    });
    if (error) return Response.json({ error: error.message }, { status: 502 });
    const r = (data ?? {}) as { ok?: boolean; erro?: string; rotulo?: string };
    if (!r.ok) {
      const msg = r.erro === "momento_invalido" ? "Momento inválido."
        : r.erro === "sem_permissao" ? "Você só pode atualizar o momento dos seus próprios leads."
        : r.erro === "lead_nao_encontrado" ? "Lead não encontrado."
        : "Não foi possível atualizar o momento.";
      return Response.json({ error: msg }, { status: r.erro === "sem_permissao" ? 403 : 422 });
    }
    return Response.json({ success: true, rotulo: r.rotulo });
  }

  if (action === "moveDeal") {
    const dealId = positiveInteger(body.dealId);
    const stageId = positiveInteger(body.stageId);
    if (!dealId || !stageId) return Response.json({ error: "Negócio ou etapa inválida." }, { status: 400 });
    const denied = guard([["pipeline", "mover"]], "Você não tem permissão para mover negócios no funil.");
    if (denied) return denied;
    const { data, error } = await auth.supabase.rpc("mover_negocio", { p_negocio_id: dealId, p_stage_id: stageId });
    const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
    if (error || result.ok === false) return Response.json({ error: error?.message || cleanText(result.error, 300) || "Não foi possível mover o negócio." }, { status: 502 });
    return Response.json({ success: true, result });
  }

  if (action === "bulkMoveStage") {
    const pipelineId = positiveInteger(body.pipelineId);
    const fromStageId = positiveInteger(body.fromStageId);
    const toStageId = positiveInteger(body.toStageId);
    if (!pipelineId || !fromStageId || !toStageId || fromStageId === toStageId) return Response.json({ error: "Escolha etapas de origem e destino diferentes." }, { status: 422 });
    const denied = guard([["pipeline", "reordenar"], ["pipeline", "editar"]], "Você não tem permissão para mover negócios em massa.");
    if (denied) return denied;
    const { data, error } = await auth.supabase.rpc("transferir_negocios_massa", {
      p_from_pipeline: pipelineId,
      p_to_pipeline: pipelineId,
      p_to_stage: toStageId,
      p_only_stage: fromStageId,
    });
    if (error) return Response.json({ error: error.message }, { status: error.code === "42501" ? 403 : 502 });
    return Response.json({ success: true, result: data });
  }

  if (action === "addNote") {
    const leadId = positiveInteger(body.leadId);
    const dealId = body.dealId === null || body.dealId === "" ? null : positiveInteger(body.dealId);
    const texto = cleanText(body.texto, 2000);
    if (!leadId || !texto) return Response.json({ error: "Escreva uma observação." }, { status: 422 });
    const denied = guard([["crm", "editar"], ["crm", "criar"]], "Você não tem permissão para registrar observações.");
    if (denied) return denied;
    const { data: broker } = await auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle();
    const { error } = await auth.supabase.from("crm_atividades").insert({ lead_id: leadId, negocio_id: dealId, corretor_id: broker?.id ?? null, tipo: "observacao", texto, criado_por: auth.user.id });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "createTask") {
    const leadId = positiveInteger(body.leadId);
    const dealId = body.dealId === null || body.dealId === "" ? null : positiveInteger(body.dealId);
    const titulo = cleanText(body.titulo, 180);
    const vencimento = cleanText(body.vencimento, 40);
    if (!leadId || !titulo) return Response.json({ error: "Informe o título da tarefa." }, { status: 422 });
    const denied = guard([["calendario", "criar"], ["crm", "criar"]], "Você não tem permissão para criar tarefas.");
    if (denied) return denied;
    const { data: broker } = await auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle();
    const { error } = await auth.supabase.from("crm_tarefas").insert({ lead_id: leadId, negocio_id: dealId, corretor_id: broker?.id ?? null, titulo, vencimento: vencimento ? new Date(vencimento).toISOString() : null, prioridade: cleanText(body.prioridade, 30) || "normal", criado_por: auth.user.id });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "toggleTask") {
    const taskId = positiveInteger(body.taskId);
    if (!taskId) return Response.json({ error: "Tarefa inválida." }, { status: 400 });
    const denied = guard([["calendario", "editar"], ["crm", "editar"]], "Você não tem permissão para atualizar tarefas.");
    if (denied) return denied;
    const { error } = await auth.supabase.from("crm_tarefas").update({ concluida: body.completed === true }).eq("id", taskId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "updateDeal") {
    const dealId = positiveInteger(body.dealId);
    if (!dealId) return Response.json({ error: "Negócio inválido." }, { status: 400 });
    const valor = body.valor === "" || body.valor === null ? null : Number(body.valor);
    if (valor !== null && (!Number.isFinite(valor) || valor < 0)) return Response.json({ error: "Valor inválido." }, { status: 422 });
    const denied = guard([["crm", "editar"], ["pipeline", "editar"]], "Você não tem permissão para editar negócios.");
    if (denied) return denied;
    const { error } = await auth.supabase.from("negocios").update({ valor, ultima_movimentacao: new Date().toISOString() }).eq("id", dealId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "transferDeal") {
    const dealId = positiveInteger(body.dealId);
    const brokerId = positiveInteger(body.brokerId);
    if (!dealId || !brokerId) return Response.json({ error: "Negócio ou corretor inválido." }, { status: 400 });
    if (!canCrm(access, "transferir")) return Response.json({ error: "Você não tem permissão para trocar o corretor responsável." }, { status: 403 });
    const { data, error } = await auth.supabase.rpc("transferir_negocio", { p_negocio_id: dealId, p_corretor_id: brokerId });
    const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
    if (error || result.ok === false) return Response.json({ error: error?.message || cleanText(result.error, 300) || "Não foi possível transferir o negócio." }, { status: 502 });
    return Response.json({ success: true, result });
  }

  if (action === "acknowledgeLead") {
    const dealId = positiveInteger(body.dealId);
    if (!dealId) return Response.json({ error: "Negócio inválido." }, { status: 400 });
    const { error } = await auth.supabase.from("crm_lead_alertas").update({ reconhecido_em: new Date().toISOString(), reconhecido_por: auth.user.id }).eq("negocio_id", dealId).is("reconhecido_em", null);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "markRead") {
    const dealId = positiveInteger(body.dealId);
    if (!dealId) return Response.json({ error: "Negócio inválido." }, { status: 400 });
    const { error } = await auth.supabase.from("crm_lead_leituras").upsert({ negocio_id: dealId, usuario_id: auth.user.id, lido_em: new Date().toISOString() }, { onConflict: "negocio_id,usuario_id" });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "acknowledgeResponse") {
    const dealId = positiveInteger(body.dealId);
    if (!dealId) return Response.json({ error: "Negócio inválido." }, { status: 400 });
    const { data, error } = await auth.supabase.rpc("registrar_acao", { p_negocio: dealId, p_tipo: "resposta", p_canal: "whatsapp", p_resultado: "respondido", p_texto: "Resposta ao cliente registrada no CRM" });
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ success: true, result: data });
  }

  if (action === "discardDeal") {
    const dealId = positiveInteger(body.dealId);
    const reason = cleanText(body.reason, 180);
    const observation = cleanText(body.observation, 1000);
    if (!dealId || !reason) return Response.json({ error: "Selecione o motivo do descarte." }, { status: 422 });
    const denied = guard([["crm", "editar"], ["pipeline", "editar"]], "Você não tem permissão para descartar negócios.");
    if (denied) return denied;
    const { data: deal } = await auth.supabase.from("negocios").select("id,lead_id,pipeline_id").eq("id", dealId).maybeSingle();
    if (!deal) return Response.json({ error: "Negócio não encontrado." }, { status: 404 });
    const { data: lostStage } = await auth.supabase.from("pipeline_stages").select("id").eq("pipeline_id", deal.pipeline_id).eq("tipo", "perdido").order("ordem").limit(1).maybeSingle();
    const now = new Date().toISOString();
    const { error } = await auth.supabase.from("negocios").update({ stage_id: lostStage?.id ?? null, status: "perdido", motivo_perda: reason, descarte_status: "concluido", descarte_motivo: reason, ultima_movimentacao: now, estagio_desde: now }).eq("id", dealId);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    if (observation) await auth.supabase.from("crm_atividades").insert({ lead_id: deal.lead_id, negocio_id: dealId, tipo: "descarte", texto: `${reason}: ${observation}`, criado_por: auth.user.id });
    return Response.json({ success: true });
  }

  if (action === "linkProduct" || action === "unlinkProduct") {
    const leadId = positiveInteger(body.leadId);
    const productId = cleanText(body.productId, 40);
    if (!leadId || !productId) return Response.json({ error: "Lead ou produto inválido." }, { status: 400 });
    const denied = guard([["crm", "editar"], ["leads", "editar"]], "Você não tem permissão para vincular produtos ao lead.");
    if (denied) return denied;
    const result = action === "linkProduct"
      ? await auth.supabase.from("lead_produtos").insert({ lead_id: leadId, empreendimento_id: productId, vinculado_por: auth.user.id })
      : await auth.supabase.from("lead_produtos").delete().eq("lead_id", leadId).eq("empreendimento_id", productId);
    return result.error ? Response.json({ error: result.error.message }, { status: 502 }) : Response.json({ success: true });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
