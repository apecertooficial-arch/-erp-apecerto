import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

// Passo de disparo já normalizado (uma linha em mensagens_agendadas).
type DispatchStep = { tipo: string; texto?: string | null; url?: string | null; file_name?: string | null; mimetype?: string | null; delayMs?: number };

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
  const [leads, deals, stages, approaches, products, recent, instances, brokers, instanceLinks] = await Promise.all([
    auth.supabase.from("leads").select("id,nome,telefone,tags,status,origem,corretor_id,disparo_optout").order("atualizado_em", { ascending: false }).limit(1500),
    auth.supabase.from("negocios").select("id,lead_id,stage_id,empreendimento_id,status"),
    auth.supabase.from("pipeline_stages").select("id,nome,rotulo,pipeline_id,ordem").order("ordem"),
    auth.supabase.from("abordagens").select("id,nome,mensagens,produto_id,ativo,ordem").eq("ativo", true).order("ordem"),
    auth.supabase.from("empreendimentos").select("id,nome,bairro,status").eq("rascunho", false).order("nome"),
    auth.supabase.from("mensagens_agendadas").select("id,lead_id,telefone,texto,quando,status,resultado,criado_em").order("criado_em", { ascending: false }).limit(80),
    auth.supabase.from("instancias").select("id,nome,conectada,corretor_id").eq("ativa", true).order("nome"),
    auth.supabase.from("corretores").select("id,nome").order("nome"),
    auth.supabase.from("corretor_instancias").select("corretor_id,instancia_id"),
  ]);
  const firstError = [leads, deals, stages, approaches, products, recent, instances, brokers, instanceLinks].find((result) => result.error)?.error;
  if (firstError) return Response.json({ error: firstError.message }, { status: 502 });
  return Response.json({ leads: leads.data ?? [], deals: deals.data ?? [], stages: stages.data ?? [], approaches: approaches.data ?? [], products: products.data ?? [], recent: recent.data ?? [], instances: instances.data ?? [], brokers: brokers.data ?? [], instanceLinks: instanceLinks.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const leadIds = Array.isArray(body.leadIds) ? body.leadIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 500) : [];
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
  const messages = Array.isArray(body.messages) ? body.messages.map((m: unknown) => String(m ?? "").trim().slice(0, 4000)).filter(Boolean).slice(0, 20) : [];
  const approachIds = Array.isArray(body.approachIds) ? body.approachIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 20) : [];
  const pool = messages.length ? messages : (message ? [message] : []);
  const rate = Math.max(1, Math.min(60, Number(body.rate) || 20));
  const sourceStageId = Number(body.sourceStageId);
  const destinationStageId = Number(body.destinationStageId);
  const start = typeof body.start === "string" && !Number.isNaN(Date.parse(body.start)) ? new Date(body.start) : new Date(Date.now() + 60_000);
  if (!leadIds.length || (!pool.length && !approachIds.length) || !Number.isSafeInteger(sourceStageId) || !Number.isSafeInteger(destinationStageId) || sourceStageId === destinationStageId) {
    return Response.json({ error: "Escolha a etapa de saída, a etapa de destino e ao menos uma mensagem/abordagem." }, { status: 422 });
  }
  const { data: stages, error: stagesError } = await auth.supabase.from("pipeline_stages").select("id,pipeline_id").in("id", [sourceStageId, destinationStageId]);
  if (stagesError) return Response.json({ error: stagesError.message }, { status: 502 });
  if (stages?.length !== 2 || stages[0].pipeline_id !== stages[1].pipeline_id) return Response.json({ error: "As etapas de saída e destino precisam pertencer ao mesmo funil." }, { status: 422 });
  const { data: deals, error: dealsError } = await auth.supabase.from("negocios").select("lead_id").in("lead_id", leadIds).eq("stage_id", sourceStageId).neq("status", "perdido");
  if (dealsError) return Response.json({ error: dealsError.message }, { status: 502 });
  const dealLeadIds = new Set((deals ?? []).map((deal) => deal.lead_id));
  const scopedLeadIds = leadIds.filter((id) => dealLeadIds.has(id));
  if (!scopedLeadIds.length) return Response.json({ error: "Nenhum dos leads selecionados continua na etapa de saída escolhida." }, { status: 422 });
  const { data: leads, error: leadsError } = await auth.supabase.from("leads").select("id,nome,telefone,disparo_optout").in("id", scopedLeadIds);
  if (leadsError) return Response.json({ error: leadsError.message }, { status: 502 });
  const valid = (leads ?? []).filter((lead) => lead.telefone && !lead.disparo_optout);
  if (!valid.length) return Response.json({ error: "Nenhum lead elegível possui telefone e autorização para disparo." }, { status: 422 });
  // CORRETORES escolhidos → o sistema deriva as instâncias ativas deles (link + dono direto).
  // Compatível com o formato antigo (instanceIds) caso ainda venha.
  const brokerIds = Array.isArray(body.brokerIds) ? body.brokerIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0) : [];
  const rawInstanceIds = Array.isArray(body.instanceIds) ? body.instanceIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0) : [];
  let instanceIds: number[] = [];
  if (brokerIds.length) {
    const [{ data: ownRows, error: ownErr }, { data: linkRows, error: linkErr }] = await Promise.all([
      auth.supabase.from("instancias").select("id").in("corretor_id", brokerIds).eq("ativa", true),
      auth.supabase.from("corretor_instancias").select("instancia_id").in("corretor_id", brokerIds),
    ]);
    if (ownErr || linkErr) return Response.json({ error: (ownErr || linkErr)!.message }, { status: 502 });
    const candidate = new Set<number>();
    (ownRows ?? []).forEach((row) => candidate.add(row.id));
    (linkRows ?? []).forEach((row) => candidate.add(row.instancia_id));
    if (candidate.size) {
      const { data: activeRows, error: activeErr } = await auth.supabase.from("instancias").select("id").in("id", [...candidate]).eq("ativa", true);
      if (activeErr) return Response.json({ error: activeErr.message }, { status: 502 });
      instanceIds = (activeRows ?? []).map((row) => row.id);
    }
    if (!instanceIds.length) return Response.json({ error: "Os corretores escolhidos não têm instância ativa para o envio." }, { status: 422 });
  } else if (rawInstanceIds.length) {
    const { data: instRows, error: instErr } = await auth.supabase.from("instancias").select("id").in("id", rawInstanceIds).eq("ativa", true);
    if (instErr) return Response.json({ error: instErr.message }, { status: 502 });
    const allowed = new Set((instRows ?? []).map((row) => row.id));
    instanceIds = rawInstanceIds.filter((id) => allowed.has(id));
  }
  if (!instanceIds.length) return Response.json({ error: "Selecione ao menos um corretor com instância ativa para o envio." }, { status: 422 });
  const { data: brokerRow } = await auth.supabase.from("corretores").select("nome").eq("usuario_id", auth.user.id).maybeSingle();
  const corretorNome = brokerRow?.nome ?? null;

  // Nome do corretor que ASSINA cada instância (dono da instância). Assim, numa campanha
  // com vários corretores, cada mensagem é assinada por quem realmente envia.
  const { data: instOwners } = await auth.supabase.from("instancias").select("id, corretor_id").in("id", instanceIds);
  const ownerIds = [...new Set((instOwners ?? []).map((r) => r.corretor_id).filter((x): x is number => Number.isSafeInteger(x)))];
  const { data: corrNames } = ownerIds.length || brokerIds.length
    ? await auth.supabase.from("corretores").select("id, nome").in("id", [...new Set([...ownerIds, ...brokerIds])])
    : { data: [] as Array<{ id: number; nome: string }> };
  const nameByCorretor = new Map((corrNames ?? []).map((c) => [c.id, c.nome]));
  const nameByInstance = new Map<number, string | null>();
  for (const inst of instOwners ?? []) {
    nameByInstance.set(inst.id, (inst.corretor_id && nameByCorretor.get(inst.corretor_id)) || (brokerIds.length ? nameByCorretor.get(brokerIds[0]) : null) || corretorNome);
  }

  // Variantes de conteúdo: cada abordagem (com mídia + texto) e/ou a mensagem digitada.
  const variants: DispatchStep[][] = [];
  if (approachIds.length) {
    const { data: aps } = await auth.supabase.from("abordagens").select("id, mensagens, ativo").in("id", approachIds).eq("ativo", true);
    for (const id of approachIds) { const ap = (aps ?? []).find((x) => x.id === id); if (!ap) continue; const steps = normalizeSteps(ap.mensagens); if (steps.some((s) => s.tipo !== "__delay")) variants.push(steps); }
  }
  for (const txt of pool) variants.push([{ tipo: "text", texto: txt }]);
  if (!variants.length) return Response.json({ error: "As abordagens selecionadas não têm conteúdo para envio." }, { status: 422 });

  // ritmo POR INSTÂNCIA: cada instância envia na velocidade escolhida (vazão total = rate * nº de instâncias)
  const gapMs = Math.ceil(3_600_000 / rate);
  const instanceCount = instanceIds.length;
  const campaignId = crypto.randomUUID();
  const rows: Array<Record<string, unknown>> = [];
  valid.forEach((lead, index) => {
    const instanciaId = instanceIds[index % instanceCount];
    const corr = nameByInstance.get(instanciaId) ?? corretorNome;
    const primeiroLead = (lead.nome ?? "cliente").split(/\s+/)[0] || "cliente";
    const primeiroCorr = (corr ?? "").split(/\s+/)[0] || "";
    const sub = (t: string) => t.replaceAll("{primeiro_nome}", primeiroLead).replaceAll("{corretor_primeiro_nome}", primeiroCorr).replaceAll("{corretor_nome}", corr ?? "").replaceAll("{primeiro_nome_corretor}", primeiroCorr);
    const baseWhen = start.getTime() + Math.floor(index / instanceCount) * gapMs;
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
  const { error } = await auth.supabase.from("mensagens_agendadas").insert(rows);
  return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true, campaignId, scheduled: rows.length, leads: valid.length, instances: instanceCount, ignored: leadIds.length - valid.length });
}
