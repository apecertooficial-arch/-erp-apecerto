import { createServerSupabaseClient } from "../../lib/supabase/server";
import type { TablesInsert } from "../../lib/supabase/database.types";
import { denyIfCannot, resolveEffectiveAccess } from "../../lib/supabase/authz";
import { planejarSlotsCampanha, type DiasCampanha } from "../../lib/campaign-schedule";

export const dynamic = "force-dynamic";

type ErroCampanha = { code?: string; message?: string } | null | undefined;

function falhaCampanha(error: ErroCampanha, operacao: string, status = 502) {
  const semPermissao = error?.code === "42501" || /permission|policy|acesso negado/i.test(error?.message ?? "");
  console.error("campanha_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
  });
  return Response.json({
    error: semPermissao
      ? "Você não tem permissão para concluir esta operação."
      : "Não foi possível concluir esta operação de campanhas no momento.",
    erro: semPermissao ? "sem_permissao" : "falha_banco",
  }, { status: semPermissao ? 403 : status });
}

// Passo de disparo já normalizado (uma linha em mensagens_agendadas).
type DispatchStep = { tipo: string; texto?: string | null; url?: string | null; file_name?: string | null; mimetype?: string | null; delayMs?: number };
const MAX_CAMPAIGN_ROWS = 5_000;

// Converte a estrutura d-api de uma abordagem (vídeo/delay/texto/imagem/documento/áudio)
// numa lista de passos. '__delay' vira intervalo entre os passos seguintes.
function normalizeSteps(mensagens: unknown): DispatchStep[] {
  if (typeof mensagens === "string") return mensagens.trim() ? [{ tipo: "text", texto: mensagens.trim() }] : [];
  if (!Array.isArray(mensagens)) return [];
  const steps: DispatchStep[] = [];
  for (const raw of mensagens) {
    if (typeof raw === "string") { if (raw.trim()) steps.push({ tipo: "text", texto: raw.trim() }); continue; }
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const name = String(s.name ?? "").toLowerCase();
    const o = (s.options && typeof s.options === "object" ? s.options : {}) as Record<string, unknown>;
    const url = o.url ?? s.url;
    const fileName = (o.filename ?? o.fileName ?? s.filename) as string | undefined;
    const mimetype = (o.mimetype ?? s.mimetype) as string | undefined;
    if (name === "delay") { const val = Number(o.valor ?? o.value) || 0; const un = String(o.unidade ?? o.unit ?? "segundos").toLowerCase(); steps.push({ tipo: "__delay", delayMs: Math.min(un.startsWith("min") ? val * 60000 : val * 1000, 60000) }); continue; }
    const text = String(o.text ?? o.texto ?? s.texto ?? s.text ?? o.mensagem ?? "");
    if (name === "send-text-message" || (!name && text)) { if (text) steps.push({ tipo: "text", texto: text }); continue; }
    if (name === "send-video-message") { if (url) steps.push({ tipo: "video", url: String(url), file_name: fileName ?? null, mimetype: mimetype ?? null }); continue; }
    if (name === "send-image-message") { if (url) steps.push({ tipo: "image", url: String(url), file_name: fileName ?? null, mimetype: mimetype ?? null }); continue; }
    if (name === "send-audio-message") { if (url) steps.push({ tipo: "audio", url: String(url) }); continue; }
    if (name === "send-document-message") { if (url) steps.push({ tipo: "document", url: String(url), file_name: fileName ?? null, mimetype: mimetype ?? null }); continue; }
    if (text) { steps.push({ tipo: "text", texto: text }); continue; }
    if (url) steps.push({ tipo: "document", url: String(url), file_name: fileName ?? null, mimetype: mimetype ?? null });
  }
  return steps;
}

async function authenticatedClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

export async function GET(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const access = await resolveEffectiveAccess(auth.supabase, auth.user.id);
  if (!access.resolved) return falhaCampanha(null, "validar_permissao_leitura");
  const denied = denyIfCannot(access, [["disparos", "ver"]]);
  if (denied) return denied;
  const [leads, deals, stages, approaches, products, recent, instances, brokers, instanceLinks] = await Promise.all([
    auth.supabase.from("leads").select("id,nome,telefone,tags,status,origem,corretor_id,disparo_optout").order("atualizado_em", { ascending: false }).limit(1500),
    auth.supabase.from("negocios").select("id,lead_id,stage_id,empreendimento_id,status"),
    auth.supabase.from("pipeline_stages").select("id,nome,rotulo,pipeline_id,ordem").order("ordem"),
    auth.supabase.from("abordagens").select("id,nome,mensagens,produto_id,ativo,ordem").eq("ativo", true).order("ordem"),
    auth.supabase.from("empreendimentos").select("id,nome,bairro,status").eq("rascunho", false).order("nome"),
    auth.supabase.from("mensagens_agendadas").select("id,lead_id,telefone,texto,quando,status,resultado,criado_em").order("criado_em", { ascending: false }).limit(80),
    auth.supabase.from("instancias").select("id,nome,conectada,corretor_id").eq("ativa", true).order("nome"),
    auth.supabase.from("corretores").select("id,nome,apelido").order("nome"),
    auth.supabase.from("corretor_instancias").select("corretor_id,instancia_id"),
  ]);
  const firstError = [leads, deals, stages, approaches, products, recent, instances, brokers, instanceLinks].find((result) => result.error)?.error;
  if (firstError) return falhaCampanha(firstError, "carregar_campanhas");
  return Response.json({ leads: leads.data ?? [], deals: deals.data ?? [], stages: stages.data ?? [], approaches: approaches.data ?? [], products: products.data ?? [], recent: recent.data ?? [], instances: instances.data ?? [], brokers: brokers.data ?? [], instanceLinks: instanceLinks.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const access = await resolveEffectiveAccess(auth.supabase, auth.user.id);
  if (!access.resolved) return falhaCampanha(null, "validar_permissao_envio");
  const denied = denyIfCannot(access, [["disparos", "enviar"]]);
  if (denied) return denied;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Envie uma configuração de campanha válida." }, { status: 422 });
  const leadIds = Array.isArray(body.leadIds) ? [...new Set(body.leadIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 500) : [];
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
  const messages = Array.isArray(body.messages) ? body.messages.map((m: unknown) => String(m ?? "").trim().slice(0, 4000)).filter(Boolean).slice(0, 20) : [];
  const approachIds = Array.isArray(body.approachIds) ? body.approachIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 20) : [];
  const pool = messages.length ? messages : (message ? [message] : []);
  const rate = Number(body.rate);
  const sourceStageId = Number(body.sourceStageId);
  const destinationStageId = Number(body.destinationStageId);
  const start = typeof body.start === "string" ? body.start : "";
  const endTime = typeof body.endTime === "string" ? body.endTime : "";
  const periodDays = Number(body.periodDays);
  const days = typeof body.days === "string" ? body.days as DiasCampanha : "" as DiasCampanha;
  if (!leadIds.length || (!pool.length && !approachIds.length) || !Number.isSafeInteger(sourceStageId) || !Number.isSafeInteger(destinationStageId) || sourceStageId === destinationStageId) {
    return Response.json({ error: "Escolha a etapa de saída, a etapa de destino e ao menos uma mensagem/abordagem." }, { status: 422 });
  }
  const { data: stages, error: stagesError } = await auth.supabase.from("pipeline_stages").select("id,pipeline_id").in("id", [sourceStageId, destinationStageId]);
  if (stagesError) return falhaCampanha(stagesError, "validar_etapas");
  if (stages?.length !== 2 || stages[0].pipeline_id !== stages[1].pipeline_id) return Response.json({ error: "As etapas de saída e destino precisam pertencer ao mesmo funil." }, { status: 422 });
  const { data: deals, error: dealsError } = await auth.supabase.from("negocios").select("lead_id").in("lead_id", leadIds).eq("stage_id", sourceStageId).neq("status", "perdido");
  if (dealsError) return falhaCampanha(dealsError, "validar_leads_da_etapa");
  const dealLeadIds = new Set((deals ?? []).map((deal) => deal.lead_id));
  const scopedLeadIds = leadIds.filter((id) => dealLeadIds.has(id));
  if (!scopedLeadIds.length) return Response.json({ error: "Nenhum dos leads selecionados continua na etapa de saída escolhida." }, { status: 422 });
  const { data: leads, error: leadsError } = await auth.supabase.from("leads").select("id,nome,telefone,disparo_optout").in("id", scopedLeadIds);
  if (leadsError) return falhaCampanha(leadsError, "carregar_leads");
  const valid = (leads ?? []).filter((lead) => lead.telefone && !lead.disparo_optout);
  if (!valid.length) return Response.json({ error: "Nenhum lead elegível possui telefone e autorização para disparo." }, { status: 422 });
  // CORRETORES escolhidos → o sistema deriva as instâncias ativas deles (link + dono direto).
  // Compatível com o formato antigo (instanceIds) caso ainda venha.
  const brokerIds = Array.isArray(body.brokerIds) ? [...new Set(body.brokerIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))] : [];
  const rawInstanceIds = Array.isArray(body.instanceIds) ? [...new Set(body.instanceIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))] : [];
  let instanceIds: number[] = [];
  if (brokerIds.length) {
    const [{ data: ownRows, error: ownErr }, { data: linkRows, error: linkErr }] = await Promise.all([
      auth.supabase.from("instancias").select("id").in("corretor_id", brokerIds).eq("ativa", true),
      auth.supabase.from("corretor_instancias").select("instancia_id").in("corretor_id", brokerIds),
    ]);
    if (ownErr || linkErr) return falhaCampanha(ownErr || linkErr, "carregar_instancias_dos_corretores");
    const candidate = new Set<number>();
    (ownRows ?? []).forEach((row) => candidate.add(row.id));
    (linkRows ?? []).forEach((row) => candidate.add(row.instancia_id));
    if (candidate.size) {
      const { data: activeRows, error: activeErr } = await auth.supabase.from("instancias").select("id").in("id", [...candidate]).eq("ativa", true);
      if (activeErr) return falhaCampanha(activeErr, "validar_instancias_ativas");
      instanceIds = (activeRows ?? []).map((row) => row.id);
    }
    if (!instanceIds.length) return Response.json({ error: "Os corretores escolhidos não têm instância ativa para o envio." }, { status: 422 });
  } else if (rawInstanceIds.length) {
    const { data: instRows, error: instErr } = await auth.supabase.from("instancias").select("id").in("id", rawInstanceIds).eq("ativa", true);
    if (instErr) return falhaCampanha(instErr, "validar_instancias_informadas");
    const allowed = new Set((instRows ?? []).map((row) => row.id));
    instanceIds = rawInstanceIds.filter((id) => allowed.has(id));
  }
  if (!instanceIds.length) return Response.json({ error: "Selecione ao menos um corretor com instância ativa para o envio." }, { status: 422 });
  const { data: brokerRow, error: brokerError } = await auth.supabase.from("corretores").select("nome,apelido").eq("usuario_id", auth.user.id).maybeSingle();
  if (brokerError) return falhaCampanha(brokerError, "carregar_corretor_autor");
  // Assinatura = apelido (ex.: "Eliz") quando houver, senão o nome.
  const corretorNome = brokerRow?.apelido || brokerRow?.nome || null;

  // Nome do corretor que ASSINA cada instância (dono da instância). Assim, numa campanha
  // com vários corretores, cada mensagem é assinada por quem realmente envia.
  const { data: instOwners, error: instOwnersError } = await auth.supabase.from("instancias").select("id, corretor_id").in("id", instanceIds);
  if (instOwnersError) return falhaCampanha(instOwnersError, "carregar_donos_das_instancias");
  const ownerIds = [...new Set((instOwners ?? []).map((r) => r.corretor_id).filter((x): x is number => Number.isSafeInteger(x)))];
  const corrNamesResult = ownerIds.length || brokerIds.length
    ? await auth.supabase.from("corretores").select("id, nome, apelido").in("id", [...new Set([...ownerIds, ...brokerIds])])
    : { data: [] as Array<{ id: number; nome: string; apelido: string | null }>, error: null };
  if (corrNamesResult.error) return falhaCampanha(corrNamesResult.error, "carregar_nomes_dos_corretores");
  const corrNames = corrNamesResult.data;
  const nameByCorretor = new Map((corrNames ?? []).map((c) => [c.id, c.apelido || c.nome]));
  const nameByInstance = new Map<number, string | null>();
  for (const inst of instOwners ?? []) {
    nameByInstance.set(inst.id, (inst.corretor_id && nameByCorretor.get(inst.corretor_id)) || (brokerIds.length ? nameByCorretor.get(brokerIds[0]) : null) || corretorNome);
  }

  // Variantes de conteúdo: cada abordagem (com mídia + texto) e/ou a mensagem digitada.
  const variants: DispatchStep[][] = [];
  if (approachIds.length) {
    const { data: aps, error: approachesError } = await auth.supabase.from("abordagens").select("id, mensagens, ativo").in("id", approachIds).eq("ativo", true);
    if (approachesError) return falhaCampanha(approachesError, "carregar_abordagens");
    if ((aps ?? []).length !== approachIds.length) return Response.json({ error: "Uma abordagem mudou ou deixou de estar ativa. Recarregue antes de agendar.", erro: "configuracao_alterada" }, { status: 409 });
    for (const id of approachIds) { const ap = (aps ?? []).find((x) => x.id === id); if (!ap) continue; const steps = normalizeSteps(ap.mensagens); if (steps.some((s) => s.tipo !== "__delay")) variants.push(steps); }
  }
  for (const txt of pool) variants.push([{ tipo: "text", texto: txt }]);
  if (!variants.length) return Response.json({ error: "As abordagens selecionadas não têm conteúdo para envio." }, { status: 422 });

  const variantTailMs = Math.max(...variants.map((steps) => {
    let offset = 0;
    let lastMessageOffset = 0;
    for (const step of steps) {
      if (step.tipo === "__delay") offset += step.delayMs ?? 0;
      else { lastMessageOffset = offset; offset += 1500; }
    }
    return lastMessageOffset;
  }));

  // ritmo POR INSTÂNCIA: cada instância envia na velocidade escolhida (vazão total = rate * nº de instâncias)
  const instanceCount = instanceIds.length;
  const schedule = planejarSlotsCampanha({ start, endTime, periodDays, days, rate, instanceCount, recipientCount: valid.length, tailMs: variantTailMs });
  if (!schedule.ok) return Response.json({ error: schedule.error }, { status: 422 });
  const campaignId = crypto.randomUUID();
  const rows: Array<TablesInsert<"mensagens_agendadas">> = [];
  valid.forEach((lead, index) => {
    const instanciaId = instanceIds[index % instanceCount];
    const corr = nameByInstance.get(instanciaId) ?? corretorNome;
    const primeiroLead = (lead.nome ?? "cliente").split(/\s+/)[0] || "cliente";
    const primeiroCorr = (corr ?? "").split(/\s+/)[0] || "";
    const sub = (t: string) => t.replaceAll("{primeiro_nome}", primeiroLead).replaceAll("{corretor_primeiro_nome}", primeiroCorr).replaceAll("{corretor_nome}", corr ?? "").replaceAll("{primeiro_nome_corretor}", primeiroCorr);
    const baseWhen = new Date(schedule.slots[Math.floor(index / instanceCount)]).getTime();
    const steps = variants[index % variants.length];
    let offset = 0;
    for (const st of steps) {
      if (st.tipo === "__delay") { offset += st.delayMs ?? 0; continue; }
      rows.push({
        lead_id: lead.id, telefone: lead.telefone!, tipo: st.tipo, status: "pendente", criado_por: auth.user.id,
        instancia_id: instanciaId, corretor_nome: corr, campanha_id: campaignId,
        etapa_origem_id: sourceStageId, etapa_destino_id: destinationStageId,
        quando: new Date(baseWhen + offset).toISOString(),
        texto: st.texto ? sub(st.texto) : null,
        url: st.url ?? null, file_name: st.file_name ?? null, mimetype: st.mimetype ?? null,
      });
      offset += 1500; // 1,5s entre passos sem delay explícito — mantém a ordem (mídia antes do texto)
    }
  });
  if (rows.length > MAX_CAMPAIGN_ROWS) return Response.json({ error: "A campanha excede o limite seguro de 5.000 mensagens. Divida os leads em lotes menores." }, { status: 422 });
  const { data: inserted, error } = await auth.supabase.from("mensagens_agendadas").insert(rows).select("id");
  if (error) return falhaCampanha(error, "agendar_campanha");
  if (inserted?.length !== rows.length) {
    console.error("campanha_operacao_falhou", { operacao: "confirmar_agendamento", codigo: "contagem_incompleta" });
    return Response.json({
      error: "O agendamento não pôde ser confirmado por completo. Recarregue antes de repetir.",
      erro: "reconciliacao_necessaria",
    }, { status: 409 });
  }
  return Response.json({ success: true, campaignId, scheduled: inserted.length, leads: valid.length, instances: instanceCount, ignored: leadIds.length - valid.length });
}
