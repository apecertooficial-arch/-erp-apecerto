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
  for (let page = 0; page < 10; page++) {
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

  const [pipelinesResult, stagesResult, leadsResult, dealsResult, brokersResult, activitiesResult, historicoResult, tasksResult, linksResult, visitsResult, productsResult, slaResult, alertsResult, leiturasResult] = await Promise.all([
    auth.supabase.from("pipelines").select("id,nome,grupo,ordem").order("ordem"),
    auth.supabase.from("pipeline_stages").select("id,pipeline_id,nome,rotulo,ordem,cor,tipo,grupo,chave").order("ordem"),
    fetchAll((from, to) => auth.supabase.from("leads").select("id,nome,telefone,email,instagram,corretor_id,pipeline_id,status,origem,tags,extras,criado_em,atualizado_em,disparo_optout").order("atualizado_em", { ascending: false, nullsFirst: false }).order("id").range(from, to)),
    fetchAll((from, to) => auth.supabase.from("negocios").select("id,lead_id,corretor_id,pipeline_id,stage_id,empreendimento_id,valor,status,motivo_perda,criado_em,ultima_movimentacao,estagio_desde,tentativa,max_tentativas").order("ultima_movimentacao", { ascending: false, nullsFirst: false }).order("id").range(from, to)),
    auth.supabase.rpc("listar_corretores_transferencia"),
    auth.supabase.from("crm_atividades").select("id,lead_id,negocio_id,corretor_id,tipo,texto,criado_em").order("criado_em", { ascending: false }).limit(500),
    auth.supabase.from("atendimento_acoes").select("id,lead_id,negocio_id,corretor_id,tipo,canal,texto,resultado,criado_em").order("criado_em", { ascending: false }).limit(500),
    auth.supabase.from("crm_tarefas").select("id,lead_id,negocio_id,corretor_id,titulo,descricao,vencimento,concluida,prioridade,criado_em").order("criado_em", { ascending: false }).limit(500),
    auth.supabase.from("lead_produtos").select("lead_id,empreendimento_id,created_at,empreendimentos(id,nome,bairro,cidade,status,preco)").order("created_at", { ascending: false }),
    auth.supabase.from("visitas").select("id,created_by,lead_id,negocio_id,corretor_id,cliente_nome,empreendimento_id,produto,unidade,data,hora_inicio,hora_fim,local,observacoes,participantes,lembrete,com_gerente,gerente_id,status,criado_em").order("data").order("hora_inicio"),
    auth.supabase.from("empreendimentos").select("id,nome,bairro,cidade,status,preco,origem,rascunho").order("nome").limit(300),
    auth.supabase.from("vw_sla_leads").select("negocio_id,lead_id,stage_id,sla_situacao,aguardando_humano,min_aguardando,min_no_estagio,min_sem_interacao,min_ativo_int,cor_ativa,alarme_ativo,ultima_interacao,cliente_ultima,humano_ultima"),
    auth.supabase.from("crm_lead_alertas").select("id,negocio_id,corretor_id,criado_em,reconhecido_em,reconhecido_por").is("reconhecido_em", null).order("criado_em", { ascending: false }),
    auth.supabase.from("crm_lead_leituras").select("negocio_id,lido_em").eq("usuario_id", auth.user.id),
  ]);

  const firstError = [pipelinesResult, stagesResult, leadsResult, dealsResult, brokersResult, activitiesResult, historicoResult, tasksResult, linksResult, visitsResult, productsResult, slaResult, alertsResult].find((result) => result.error)?.error;
  if (firstError) return Response.json({ error: firstError.message }, { status: 502 });

  const { data: gerentesData } = await auth.supabase.from("gerentes").select("id,nome,geral,corretor_id").eq("ativo", true).order("geral", { ascending: false });
  const { data: meProfile } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
  const { data: aquarioData } = await auth.supabase.rpc("aquario_status");

  return Response.json({
    mode: "production",
    role: meProfile?.role ?? "",
    gerentes: gerentesData ?? [],
    pipelines: pipelinesResult.data ?? [],
    stages: stagesResult.data ?? [],
    leads: leadsResult.data ?? [],
    deals: dealsResult.data ?? [],
    brokers: brokersResult.data ?? [],
    activities: activitiesResult.data ?? [],
    historico: historicoResult.data ?? [],
    tasks: tasksResult.data ?? [],
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

  // ===== Funil Inteligente: o momento do lead é quem move o card =====
  // Arrastar não é mais o mecanismo desse funil; a etapa é derivada do momento
  // escolhido dentro do lead. A RPC valida momento, temperatura e permissão.
  if (action === "atualizarMomento") {
    const leadId = positiveInteger(body.leadId);
    const dealId = positiveInteger(body.dealId);
    const momento = cleanText(body.momento, 40);
    if (!leadId || !dealId || !momento) return Response.json({ error: "Informe o lead, o negócio e o momento." }, { status: 400 });
    const denied = guard([["leads", "editar"], ["crm", "editar"]], "Você não tem permissão para atualizar o momento do lead.");
    if (denied) return denied;
    const quando = cleanText(body.proximaAcaoEm, 40);
    const { data, error } = await auth.supabase.rpc("atualizar_momento_lead", {
      p_lead_id: leadId,
      p_negocio_id: dealId,
      p_momento: momento,
      p_resultado: cleanText(body.resultado, 120) || undefined,
      p_observacao: cleanText(body.observacao, 1000) || undefined,
      p_proxima_acao: cleanText(body.proximaAcao, 200) || undefined,
      p_proxima_acao_em: quando || undefined,
      p_temperatura: cleanText(body.temperatura, 20) || undefined,
    });
    if (error) {
      const msg = error.message || "";
      if (msg.includes("somente ao Funil Inteligente")) return Response.json({ error: "Este negócio não está no Funil Inteligente." }, { status: 409 });
      if (msg.includes("seus próprios leads")) return Response.json({ error: "Você só pode atualizar o momento dos seus próprios leads." }, { status: 403 });
      if (msg.includes("Momento do lead inválido")) return Response.json({ error: "Momento inválido." }, { status: 422 });
      if (msg.includes("corretor responsável")) return Response.json({ error: "Defina o corretor responsável antes de atualizar o momento." }, { status: 422 });
      return Response.json({ error: msg || "Não foi possível atualizar o momento." }, { status: 502 });
    }
    return Response.json({ success: true, result: data ?? {} });
  }

  if (action === "moveDeal") {
    const dealId = positiveInteger(body.dealId);
    const stageId = positiveInteger(body.stageId);
    if (!dealId || !stageId) return Response.json({ error: "Negócio ou etapa inválida." }, { status: 400 });
    const denied = guard([["pipeline", "mover"]], "Você não tem permissão para mover negócios no funil.");
    if (denied) return denied;
    // No Funil Inteligente a etapa é consequência do momento do lead, nunca do arraste.
    const { data: alvo } = await auth.supabase.from("negocios").select("pipeline_id, pipelines!inner(grupo)").eq("id", dealId).maybeSingle();
    const grupoPipe = (alvo as { pipelines?: { grupo?: string | null } } | null)?.pipelines?.grupo ?? null;
    if (grupoPipe === "crm_inteligente") {
      return Response.json({ error: "No Funil Inteligente a etapa muda pelo momento do lead — abra o lead e atualize o momento." }, { status: 409 });
    }
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

  if (action === "createLead") {
    const nome = cleanText(body.nome, 160);
    // Normaliza telefone BR: só dígitos e prefixa 55 quando vier sem DDI (10/11 dígitos).
    // Evita salvar número sem código do país (o WhatsApp não entrega e o lead não responde).
    const telDigits = cleanText(body.telefone, 40).replace(/\D/g, "");
    const telefone = (telDigits.length === 10 || telDigits.length === 11) ? `55${telDigits}` : telDigits;
    const email = cleanText(body.email, 180).toLowerCase();
    const origem = cleanText(body.origem, 100) || "manual";
    const pipelineId = positiveInteger(body.pipelineId);
    const selectedBrokerId = body.corretorId === null || body.corretorId === "" ? null : positiveInteger(body.corretorId);
    if (!nome || !telefone || !pipelineId) return Response.json({ error: "Informe nome, telefone e funil." }, { status: 422 });
    const denied = guard([["leads", "criar"], ["crm", "criar"]], "Você não tem permissão para criar leads.");
    if (denied) return denied;
    const { data: pipeline } = await auth.supabase.from("pipelines").select("id").eq("id", pipelineId).maybeSingle();
    if (!pipeline) return Response.json({ error: "Funil inválido." }, { status: 422 });
    const canChooseBroker = canCrm(access, "atribuir") || canCrm(access, "transferir");
    if (selectedBrokerId && !canChooseBroker) return Response.json({ error: "Você não tem permissão para atribuir este lead a outro corretor." }, { status: 403 });
    let brokerId = canChooseBroker ? selectedBrokerId : null;
    if (!brokerId) {
      const { data: ownBroker } = await auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle();
      brokerId = ownBroker?.id ?? null;
    }
    const { data: lead, error: leadError } = await auth.supabase.from("leads").insert({ nome, telefone, email: email || null, origem, pipeline_id: pipelineId, corretor_id: brokerId, status: "novo", atualizado_em: new Date().toISOString(), tags: [] }).select("id").single();
    if (leadError) return Response.json({ error: leadError.message }, { status: 502 });
    const { data: firstStage } = await auth.supabase.from("pipeline_stages").select("id").eq("pipeline_id", pipelineId).order("ordem").limit(1).maybeSingle();
    if (firstStage) {
      const { error: dealError } = await auth.supabase.from("negocios").insert({ lead_id: lead.id, pipeline_id: pipelineId, stage_id: firstStage.id, corretor_id: brokerId, status: "aberto", estagio_desde: new Date().toISOString(), ultima_movimentacao: new Date().toISOString() });
      if (dealError) return Response.json({ error: `Lead criado, mas o negócio não foi aberto: ${dealError.message}` }, { status: 502 });
    }
    return Response.json({ success: true, leadId: lead.id });
  }

  if (action === "aquarioPescar") {
    const { data, error } = await auth.supabase.rpc("aquario_pescar");
    const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
    if (error || result.ok === false) return Response.json({ error: error?.message || cleanText(result.error, 300) || "Não foi possível pescar um lead." }, { status: 409 });
    return Response.json({ success: true, lead: { id: result.lead_id, nome: result.nome, telefone: result.telefone } });
  }

  if (action === "aquarioImportar") {
    const denied = guard([["leads", "importar"]], "Você não tem permissão para importar leads.");
    if (denied) return denied;
    const rowsInput = Array.isArray(body.rows) ? body.rows : [];
    const rows = rowsInput.slice(0, 2000).map((row) => {
      const r = row && typeof row === "object" ? row as Record<string, unknown> : {};
      return { nome: cleanText(r.nome, 160), telefone: cleanText(r.telefone, 40), email: cleanText(r.email, 180).toLowerCase() };
    }).filter((r) => r.nome || r.telefone);
    if (!rows.length) return Response.json({ error: "Nenhum lead válido para importar." }, { status: 422 });
    const { data, error } = await auth.supabase.rpc("aquario_importar", { p_rows: rows });
    const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
    if (error || result.ok === false) return Response.json({ error: error?.message || cleanText(result.error, 300) || "Não foi possível importar." }, { status: 502 });
    return Response.json({ success: true, importados: result.importados, duplicados: result.duplicados, invalidos: result.invalidos });
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

  if (action === "createVisit") {
    const leadId = positiveInteger(body.leadId);
    const dealId = positiveInteger(body.dealId);
    const date = cleanText(body.date, 10);
    const startTime = cleanText(body.startTime, 8);
    const productId = cleanText(body.productId, 40) || null;
    if (!leadId || !dealId || !date || !startTime) return Response.json({ error: "Informe data e horário da visita." }, { status: 422 });
    const denied = guard([["calendario", "criar"], ["crm", "criar"]], "Você não tem permissão para agendar visitas.");
    if (denied) return denied;
    const [{ data: lead }, { data: deal }, { data: product }] = await Promise.all([
      auth.supabase.from("leads").select("nome").eq("id", leadId).maybeSingle(),
      auth.supabase.from("negocios").select("corretor_id").eq("id", dealId).maybeSingle(),
      productId ? auth.supabase.from("empreendimentos").select("id,nome,endereco,numero,bairro,cidade").eq("id", productId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!lead || !deal) return Response.json({ error: "Lead ou negócio não encontrado." }, { status: 404 });
    const local = cleanText(body.local, 300) || (product ? [product.endereco, product.numero, product.bairro, product.cidade].filter(Boolean).join(", ") : null);
    const comGerente = body.withManager === true;
    let gerenteId: number | null = null;
    if (comGerente) {
      const chosen = positiveInteger(body.gerenteId);
      if (chosen) gerenteId = chosen;
      else { const { data: gg } = await auth.supabase.from("gerentes").select("id").eq("ativo", true).eq("geral", true).maybeSingle(); gerenteId = (gg?.id as number | undefined) ?? null; }
    }
    const { error } = await auth.supabase.from("visitas").insert({
      created_by: auth.user.id, lead_id: leadId, negocio_id: dealId, corretor_id: deal.corretor_id, cliente_nome: lead.nome,
      empreendimento_id: product?.id ?? null, produto: product?.nome ?? (cleanText(body.productName, 180) || null),
      data: date, hora_inicio: startTime, hora_fim: cleanText(body.endTime, 8) || null,
      local, observacoes: cleanText(body.observations, 1200) || null,
      participantes: cleanText(body.participants, 500) || null,
      lembrete: body.reminder !== false, com_gerente: comGerente, gerente_id: gerenteId, status: "agendada",
    });
    if (error) return Response.json({ error: error.message }, { status: 502 });
    // #9 — ao agendar, move o lead para o funil "Visita ApeCerto" na etapa "Visita Agendada" (best-effort).
    try {
      const { data: pipe } = await auth.supabase.from("pipelines").select("id").ilike("nome", "%visita ape%").order("ordem").limit(1).maybeSingle();
      if (pipe?.id) {
        const { data: stage } = await auth.supabase.from("pipeline_stages").select("id").eq("pipeline_id", pipe.id).ilike("nome", "%agendada%").order("ordem").limit(1).maybeSingle();
        if (stage?.id) await auth.supabase.rpc("mover_negocio", { p_negocio_id: dealId, p_stage_id: stage.id });
      }
    } catch { /* mover é best-effort — a visita já foi criada */ }
    return Response.json({ success: true });
  }

  if (action === "updateVisit") {
    const visitId = cleanText(body.visitId, 40);
    if (!visitId) return Response.json({ error: "Visita inválida." }, { status: 400 });
    const denied = guard([["calendario", "editar"], ["crm", "editar"]], "Você não tem permissão para editar visitas.");
    if (denied) return denied;
    const { data: cur } = await auth.supabase.from("visitas").select("corretor_id,com_gerente,gerente_id").eq("id", visitId).maybeSingle();
    if (!cur) return Response.json({ error: "Visita não encontrada." }, { status: 404 });
    const isAdmin = access.role === "admin" || access.role === "gestor";
    const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
    if (typeof body.date === "string" && body.date) patch.data = cleanText(body.date, 10);
    if (body.startTime !== undefined) patch.hora_inicio = cleanText(body.startTime, 8) || null;
    if (body.endTime !== undefined) patch.hora_fim = cleanText(body.endTime, 8) || null;
    if (body.local !== undefined) patch.local = cleanText(body.local, 300) || null;
    if (body.observations !== undefined) patch.observacoes = cleanText(body.observations, 1200) || null;
    // Produto da visita (empreendimento que o lead vai visitar); auto-preenche o local pelo endereço se vazio.
    if (body.productId !== undefined) {
      const pid = cleanText(body.productId, 40) || null;
      if (pid) {
        const { data: product } = await auth.supabase.from("empreendimentos").select("id,nome,endereco,numero,bairro,cidade").eq("id", pid).maybeSingle();
        patch.empreendimento_id = product?.id ?? null;
        patch.produto = product?.nome ?? null;
        const localEnviado = body.local !== undefined ? cleanText(body.local, 300) : "";
        if (!localEnviado && product) patch.local = [product.endereco, product.numero, product.bairro, product.cidade].filter(Boolean).join(", ") || null;
      } else { patch.empreendimento_id = null; patch.produto = null; }
    }
    // "com gerente" só o admin/gestor altera; corretor não mexe nisso.
    let comGerente = cur.com_gerente === true;
    if (isAdmin && body.withManager !== undefined) { comGerente = body.withManager === true; patch.com_gerente = comGerente; }
    // gerente do acompanhamento: admin escolhe explicitamente; senão mantém o atual, e se estiver vazio usa o geral (Djair)
    if (comGerente) {
      const chosen = positiveInteger(body.gerenteId);
      if (isAdmin && chosen) patch.gerente_id = chosen;
      else if (cur.gerente_id == null) { const { data: gg } = await auth.supabase.from("gerentes").select("id").eq("ativo", true).eq("geral", true).maybeSingle(); patch.gerente_id = (gg?.id as number | undefined) ?? null; }
    } else patch.gerente_id = null;
    const { error } = await auth.supabase.from("visitas").update(patch).eq("id", visitId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "gerenteDisponibilidade") {
    const corretorId = positiveInteger(body.corretorId);
    const date = cleanText(body.date, 10);
    const startTime = cleanText(body.startTime, 8);
    const endTime = cleanText(body.endTime, 8) || null;
    const exclude = cleanText(body.visitId, 40) || null;
    if (!corretorId || !date || !startTime) return Response.json({ ok: true, conflitos: [] });
    let gerenteId = positiveInteger(body.gerenteId) || null;
    if (!gerenteId) { const { data: g } = await auth.supabase.rpc("corretor_gerente", { p_corretor: corretorId }); gerenteId = (g as number | null) ?? null; }
    if (!gerenteId) return Response.json({ ok: true, gerente_id: null, conflitos: [] });
    const { data: conf } = await auth.supabase.rpc("gerente_conflitos", { p_gerente: gerenteId, p_data: date, p_inicio: startTime, p_fim: endTime, p_exclude: exclude });
    return Response.json({ ok: true, gerente_id: gerenteId, conflitos: conf ?? [] });
  }

  if (action === "updateVisitStatus") {
    const visitId = cleanText(body.visitId, 40);
    const status = cleanText(body.status, 30);
    if (!visitId || !["agendada", "realizada", "cancelada"].includes(status)) return Response.json({ error: "Visita ou status inválido." }, { status: 400 });
    const denied = guard([["calendario", "editar"], ["crm", "editar"]], "Você não tem permissão para alterar o status de visitas.");
    if (denied) return denied;
    const { error } = await auth.supabase.from("visitas").update({ status, motivo_cancelamento: status === "cancelada" ? cleanText(body.reason, 500) || null : null, atualizado_em: new Date().toISOString() }).eq("id", visitId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
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
