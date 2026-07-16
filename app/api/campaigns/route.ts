import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

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
  const [leads, deals, stages, approaches, products, recent] = await Promise.all([
    auth.supabase.from("leads").select("id,nome,telefone,tags,status,origem,corretor_id,disparo_optout").order("atualizado_em", { ascending: false }).limit(1500),
    auth.supabase.from("negocios").select("id,lead_id,stage_id,empreendimento_id,status"),
    auth.supabase.from("pipeline_stages").select("id,nome,rotulo,pipeline_id,ordem").order("ordem"),
    auth.supabase.from("abordagens").select("id,nome,mensagens,produto_id,ativo,ordem").eq("ativo", true).order("ordem"),
    auth.supabase.from("empreendimentos").select("id,nome,bairro,status").eq("rascunho", false).order("nome"),
    auth.supabase.from("mensagens_agendadas").select("id,lead_id,telefone,texto,quando,status,resultado,criado_em").order("criado_em", { ascending: false }).limit(80),
  ]);
  const firstError = [leads, deals, stages, approaches, products, recent].find((result) => result.error)?.error;
  if (firstError) return Response.json({ error: firstError.message }, { status: 502 });
  return Response.json({ leads: leads.data ?? [], deals: deals.data ?? [], stages: stages.data ?? [], approaches: approaches.data ?? [], products: products.data ?? [], recent: recent.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const leadIds = Array.isArray(body.leadIds) ? body.leadIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 500) : [];
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
  const messages = Array.isArray(body.messages) ? body.messages.map((m: unknown) => String(m ?? "").trim().slice(0, 4000)).filter(Boolean).slice(0, 20) : [];
  const pool = messages.length ? messages : (message ? [message] : []);
  const rate = Math.max(1, Math.min(60, Number(body.rate) || 20));
  const sourceStageId = Number(body.sourceStageId);
  const destinationStageId = Number(body.destinationStageId);
  const start = typeof body.start === "string" && !Number.isNaN(Date.parse(body.start)) ? new Date(body.start) : new Date(Date.now() + 60_000);
  if (!leadIds.length || !pool.length || !Number.isSafeInteger(sourceStageId) || !Number.isSafeInteger(destinationStageId) || sourceStageId === destinationStageId) {
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
  const gapMs = Math.ceil(3_600_000 / rate);
  const campaignId = crypto.randomUUID();
  const rows = valid.map((lead, index) => ({
    lead_id: lead.id, telefone: lead.telefone!, tipo: "text", status: "agendado", criado_por: auth.user.id,
    campanha_id: campaignId, etapa_origem_id: sourceStageId, etapa_destino_id: destinationStageId,
    quando: new Date(start.getTime() + index * gapMs).toISOString(),
    texto: pool[index % pool.length].replaceAll("{primeiro_nome}", (lead.nome ?? "cliente").split(/\s+/)[0] || "cliente"),
  }));
  const { error } = await auth.supabase.from("mensagens_agendadas").insert(rows);
  return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true, campaignId, scheduled: rows.length, ignored: leadIds.length - rows.length });
}
